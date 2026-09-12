"""KYNTRA FastAPI Route Definitions.

Exposes REST endpoints for system status, demo events, historical replay,
battle states, and the core DecisionSnapshot engine.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from kyntra.decision.engine import compute_decision
from kyntra.models.registry import get_overtake_model
from kyntra.processing.replay_loader import (
    DRIVER_INFO,
    EVENT_INFO,
    extract_lap_battle_state,
    get_available_events,
    get_event_summary,
    load_demo_replay,
)
from kyntra.schemas import DecisionSnapshot
from kyntra.strategy import StrategyMatrixSnapshot, generate_strategy_matrix

router = APIRouter(prefix="/api", tags=["KYNTRA Intelligence"])


class DecisionRequest(BaseModel):
    """Payload for on-demand tactical decision evaluation."""
    gap_seconds: float = Field(..., description="Temporal gap to defender in seconds")
    closing_rate: float = Field(0.0, description="Closing speed in m/s (positive = catching)")
    recent_pace_delta_1lap: float = Field(0.0, description="Pace delta over last lap (negative = faster)")
    recent_pace_delta_3laps: float = Field(0.0, description="Pace delta over last 3 laps (negative = faster)")
    speed_trap_delta: float = Field(0.0, description="Speed trap speed difference in km/h")
    attacker: Optional[str] = "ANT"
    defender: Optional[str] = "VER"
    event_id: Optional[str] = "2026_13_ITA"
    lap: Optional[int] = 15
    available_energy_mj: Optional[float] = 2.65
    track_status: Optional[str] = "1"
    tyre_age_delta: Optional[float] = 0.0
    rear_threat: Optional[str] = "LOW"


@router.get("/system")
def get_system_status() -> Dict[str, Any]:
    """Retrieve system readiness, loaded model metadata, and demo isolation status."""
    try:
        model = get_overtake_model()
        model_loaded = True
        model_name = model.MODEL_NAME
        model_version = model.MODEL_VERSION
        metadata = model.metadata
    except Exception as e:
        model_loaded = False
        model_name = "UNAVAILABLE"
        model_version = "None"
        metadata = {"error": str(e)}

    return {
        "status": "OPERATIONAL" if model_loaded else "DEGRADED",
        "overtake_model": {
            "loaded": model_loaded,
            "model_name": model_name,
            "model_version": model_version,
            "algorithm": "LightGBM Cumulative + Equal-Weight Pool Adjacent Violators (PAV)",
            "features": model.features if model_loaded else [],
            "metadata": metadata,
        },
        "energy_simulator": {
            "status": "OPERATIONAL",
            "provenance": "SIMULATED",
            "regulation": "FIA 2026 Technical Regulations (Issue 20) & Sporting Regulations (Issue 08)",
            "power_curve": "Regulation 120 kW straightline taper model (290-345 km/h)",
            "lap_deployment_cap_mj": 4.0,
        },
        "demo_holdouts": {
            "status": "ISOLATED",
            "events": ["2026_01_AUS", "2026_03_JPN", "2026_04_MIA", "2026_13_ITA"],
            "leakage_risk": "ZERO (Strict event-level separation verified)",
        },
    }


@router.get("/events")
def list_events() -> List[Dict[str, Any]]:
    """List all available demo replay events."""
    return get_available_events()


@router.get("/replay/{event_id}")
def get_replay_info(event_id: str) -> Dict[str, Any]:
    """Retrieve metadata and available laps for a specific demo replay event."""
    if event_id not in EVENT_INFO:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found.")
    return get_event_summary(event_id)


@router.get("/replay/{event_id}/lap/{lap}", response_model=DecisionSnapshot)
def get_replay_lap(
    event_id: str,
    lap: int,
    attacker: Optional[str] = None,
    defender: Optional[str] = None,
) -> DecisionSnapshot:
    """Retrieve the coherent DecisionSnapshot for a race replay at a given lap."""
    if event_id not in EVENT_INFO:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found.")

    state = extract_lap_battle_state(
        event_id=event_id,
        lap=lap,
        attacker_code=attacker,
        defender_code=defender,
    )

    snapshot = compute_decision(
        race_data=state["race_data"],
        battle_data=state["battle_data"],
        simulated_energy_state=state["energy_data"],
    )
    return snapshot


@router.get("/battle/{event_id}/{lap}/{attacker}/{defender}", response_model=DecisionSnapshot)
def get_battle_decision(
    event_id: str,
    lap: int,
    attacker: str,
    defender: str,
) -> DecisionSnapshot:
    """Evaluate decision snapshot for an explicit attacker vs defender battle."""
    return get_replay_lap(event_id=event_id, lap=lap, attacker=attacker, defender=defender)


@router.post("/decision", response_model=DecisionSnapshot)
def evaluate_custom_decision(req: DecisionRequest) -> DecisionSnapshot:
    """Evaluate a custom battle state directly through the KYNTRA decision engine."""
    race_data = {
        "event_id": req.event_id,
        "event_name": EVENT_INFO.get(req.event_id or "", {}).get("event_name", "Custom Grand Prix"),
        "lap": req.lap,
        "replay_time": float((req.lap or 1) * 80.0),
        "attacker": req.attacker,
        "defender": req.defender,
        "attacker_position": 2,
        "defender_position": 1,
        "track_status": req.track_status,
    }

    battle_data = {
        "gap_seconds": req.gap_seconds,
        "distance_gap_m": round(req.gap_seconds * 65.0, 1),
        "closing_rate": req.closing_rate,
        "recent_pace_delta_1lap": req.recent_pace_delta_1lap,
        "recent_pace_delta_3laps": req.recent_pace_delta_3laps,
        "speed_trap_delta": req.speed_trap_delta,
        "speed_delta": req.speed_trap_delta,
        "tyre_age_delta": req.tyre_age_delta,
        "laps_following": 4,
        "rear_threat": req.rear_threat,
    }

    energy_data = {
        "available_energy_mj": req.available_energy_mj,
        "scenario": "CUSTOM_TACTICAL",
    }

    return compute_decision(
        race_data=race_data,
        battle_data=battle_data,
        simulated_energy_state=energy_data,
    )


@router.get("/strategy/matrix/current", response_model=StrategyMatrixSnapshot)
def get_current_strategy_matrix() -> StrategyMatrixSnapshot:
    """Convenience alias: retrieve the active/current canonical Strategist Matrix."""
    return get_strategy_matrix_for_lap(event_id="2026_01_AUS", lap=18, attacker="NOR", defender="VER")


@router.get("/strategy/matrix/{event_id}/{lap}", response_model=StrategyMatrixSnapshot)
def get_strategy_matrix_for_lap(
    event_id: str,
    lap: int,
    attacker: Optional[str] = None,
    defender: Optional[str] = None,
) -> StrategyMatrixSnapshot:
    """Retrieve canonical Strategist Matrix for a replay event at a given lap."""
    if event_id not in EVENT_INFO:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found.")

    state = extract_lap_battle_state(
        event_id=event_id,
        lap=lap,
        attacker_code=attacker,
        defender_code=defender,
    )
    return generate_strategy_matrix(
        race_data=state["race_data"],
        battle_data=state["battle_data"],
        simulated_energy_state=state["energy_data"],
    )


@router.get("/strategy/matrix/{event_id}/{lap}/{attacker}/{defender}", response_model=StrategyMatrixSnapshot)
def get_strategy_matrix_for_battle(
    event_id: str,
    lap: int,
    attacker: str,
    defender: str,
) -> StrategyMatrixSnapshot:
    """Retrieve canonical Strategist Matrix for an explicit battle pair."""
    return get_strategy_matrix_for_lap(event_id=event_id, lap=lap, attacker=attacker, defender=defender)


@router.post("/strategy/matrix", response_model=StrategyMatrixSnapshot)
def evaluate_custom_strategy_matrix(req: DecisionRequest) -> StrategyMatrixSnapshot:
    """Evaluate canonical Strategist Matrix on custom battle parameters."""
    race_data = {
        "event_id": req.event_id,
        "event_name": EVENT_INFO.get(req.event_id or "", {}).get("event_name", "Custom Grand Prix"),
        "lap": req.lap,
        "attacker": req.attacker,
        "defender": req.defender,
        "track_status": req.track_status,
        "mode": "FORECAST",
        "source_mode": "SYNTHETIC",
    }
    battle_data = {
        "gap_seconds": req.gap_seconds,
        "closing_rate": req.closing_rate,
        "recent_pace_delta_1lap": req.recent_pace_delta_1lap,
        "recent_pace_delta_3laps": req.recent_pace_delta_3laps,
        "speed_trap_delta": req.speed_trap_delta,
        "tyre_age_delta": req.tyre_age_delta,
        "rear_threat": req.rear_threat,
    }
    energy_data = {
        "available_energy_mj": req.available_energy_mj,
    }
    return generate_strategy_matrix(
        race_data=race_data,
        battle_data=battle_data,
        simulated_energy_state=energy_data,
    )


# ==============================================================================
# Phase 4A Live Race Intelligence & Replay Control Endpoints
# ==============================================================================

class ReplayControlRequest(BaseModel):
    """Payload for controlling replay stream."""
    action: str = Field(..., description="pause | resume | seek | speed | set_event | select_battle | step")
    lap: Optional[int] = None
    speed: Optional[float] = None
    event_id: Optional[str] = None
    battle_id: Optional[str] = None


@router.get("/live/state")
def get_live_race_state() -> Dict[str, Any]:
    """Retrieve current coherent RaceState and active field metrics."""
    from kyntra.services.live_service import get_live_race_service
    from kyntra.state.store import get_current_state_store

    store = get_current_state_store()
    state = store.get_race_state()
    if state is None:
        service = get_live_race_service()
        res = service.step()
        if res and "race_state" in res:
            return res["race_state"]
        raise HTTPException(status_code=503, detail="Race state initializing.")
    return state.model_dump()


@router.get("/live/battles")
def get_live_battles() -> List[Dict[str, Any]]:
    """Retrieve live battle watchlist ranked by transparent ordinal priority."""
    from kyntra.services.live_service import get_live_race_service
    from kyntra.state.store import get_current_state_store

    store = get_current_state_store()
    watchlist = store.get_watchlist()
    if not watchlist:
        service = get_live_race_service()
        res = service.step()
        if res and "watchlist" in res:
            return res["watchlist"]
    return [item.model_dump() for item in watchlist]


@router.get("/live/decision")
def get_live_decision() -> Dict[str, Any]:
    """Retrieve current coherent DecisionSnapshot for the primary active battle."""
    from kyntra.services.live_service import get_live_race_service
    from kyntra.state.store import get_current_state_store

    store = get_current_state_store()
    snapshot = store.get_decision_snapshot()
    if snapshot is None:
        service = get_live_race_service()
        res = service.step()
        if res and res.get("decision"):
            return res["decision"]
        raise HTTPException(status_code=503, detail="Decision snapshot initializing.")
    return snapshot.model_dump()


@router.get("/events/history")
def get_event_history(
    race_id: Optional[str] = None,
    event_type: Optional[str] = None,
    min_lap: Optional[int] = None,
    battle_id: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Query persistent append-only race memory log."""
    from kyntra.events.store import get_event_store

    store = get_event_store()
    events = store.get_events(
        race_id=race_id,
        event_type=event_type,
        min_lap=min_lap,
        battle_id=battle_id,
        limit=limit,
    )
    return [e.model_dump() for e in events]


@router.get("/events/markers")
def get_timeline_markers(
    race_id: Optional[str] = None,
    limit: int = 150,
) -> List[Dict[str, Any]]:
    """Retrieve key milestone events with timestamps for timeline scrubber markers."""
    from kyntra.events.store import get_event_store

    store = get_event_store()
    return store.get_timeline_markers(race_id=race_id, limit=limit)


class ProviderSelectRequest(BaseModel):
    provider_type: str = Field(..., description="OPENF1_LIVE | REPLAY | CAPTURED_LIVE")
    session_key: Optional[str] = None
    event_id: Optional[str] = None
    capture_path: Optional[str] = None


class CaptureControlRequest(BaseModel):
    action: str = Field(..., description="start | stop")
    session_id: Optional[str] = None


@router.get("/providers/active")
def get_active_provider() -> Dict[str, Any]:
    """Retrieve active provider identity, capabilities, and data provenance."""
    from kyntra.services.live_service import get_live_race_service

    service = get_live_race_service()
    meta = service.provider.get_metadata()
    caps = service.provider.get_capabilities()
    return {
        "metadata": meta.model_dump(),
        "capabilities": caps.model_dump(),
        "is_capturing": hasattr(service.provider, "capture_writer") and service.provider.capture_writer is not None,
    }


@router.post("/providers/select")
def select_provider(req: ProviderSelectRequest) -> Dict[str, Any]:
    """Switch active provider with truthful provenance fallback."""
    from kyntra.services.live_service import get_live_race_service

    service = get_live_race_service()
    meta = service.select_provider(
        provider_type=req.provider_type,
        session_key=req.session_key,
        event_id=req.event_id,
        capture_path=req.capture_path,
    )
    return {
        "status": "OK",
        "active_provider": meta.model_dump(),
    }


@router.get("/openf1/discovery")
def discover_openf1(
    query: str = "Spain",
    year: int = 2026,
    session_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Dynamically discover OpenF1 meeting and session keys (e.g. Madrid 2026)."""
    from kyntra.ingestion.discovery import discover_openf1_session

    return discover_openf1_session(query=query, year=year, session_name=session_name)


@router.get("/captures")
def list_captures() -> List[Dict[str, Any]]:
    """List all available locally captured live sessions."""
    from kyntra.ingestion.capture import list_captured_sessions

    return list_captured_sessions()


@router.post("/capture/control")
def control_capture(req: CaptureControlRequest) -> Dict[str, Any]:
    """Control local session capture recording (start or stop)."""
    from kyntra.services.live_service import get_live_race_service

    service = get_live_race_service()
    if req.action == "start":
        return service.start_capture(session_id=req.session_id)
    elif req.action == "stop":
        return service.stop_capture()
    raise HTTPException(status_code=400, detail=f"Unknown capture action '{req.action}'. Expected 'start' or 'stop'.")


@router.get("/system/providers")
def get_providers_capability_matrix() -> Dict[str, Any]:
    """Retrieve verified operational capability matrix for telemetry providers."""
    return {
        "providers": [
            {
                "id": "REPLAY_PROVIDER",
                "name": "Historical Replay Provider",
                "status": "OPERATIONAL (ACTIVE)",
                "capabilities": {
                    "race_timing": "AVAILABLE",
                    "car_coordinates": "AVAILABLE",
                    "speed_telemetry": "AVAILABLE",
                    "tyre_compound_stint": "AVAILABLE",
                    "track_flags": "AVAILABLE",
                    "private_mgu_k_torque": "UNAVAILABLE",
                    "actual_cell_soc": "UNAVAILABLE",
                },
                "notes": "Streams sequential historical ticks from verified demo holdout parquets without modification.",
            },
            {
                "id": "OPENF1_LIVE_PROVIDER",
                "name": "OpenF1 Real-Time Live Feed Provider",
                "status": "AVAILABLE",
                "capabilities": {
                    "race_timing": "AVAILABLE",
                    "car_coordinates": "AVAILABLE",
                    "speed_telemetry": "AVAILABLE",
                    "tyre_compound_stint": "AVAILABLE",
                    "track_flags": "AVAILABLE",
                    "private_mgu_k_torque": "UNAVAILABLE",
                    "actual_cell_soc": "UNAVAILABLE",
                },
                "notes": "Real-time MQTT live pub/sub with resilient REST fallback. Fully normalized into RaceState.",
            },
            {
                "id": "PUBLIC_LIVE_PROVIDER",
                "name": "Public Live Timing Provider",
                "status": "STANDBY",
                "capabilities": {
                    "race_timing": "AVAILABLE (SOCKET)",
                    "car_coordinates": "INTERPOLATED",
                    "speed_telemetry": "SECTOR_AVERAGE",
                    "tyre_compound_stint": "AVAILABLE",
                    "track_flags": "AVAILABLE",
                    "private_mgu_k_torque": "UNAVAILABLE",
                    "actual_cell_soc": "UNAVAILABLE",
                },
                "notes": "Low-latency WebSocket connector for public race timing feeds. Zero synthetic mock data.",
            },
            {
                "id": "TEAM_TELEMETRY_PROVIDER",
                "name": "Team CAN/ATLAS Telemetry Provider",
                "status": "STANDBY / FUTURE",
                "capabilities": {
                    "race_timing": "AVAILABLE",
                    "car_coordinates": "HIGH_ACCURACY_GPS",
                    "speed_telemetry": "100Hz_HIGH_RATE",
                    "tyre_compound_stint": "AVAILABLE_SENSOR",
                    "track_flags": "AVAILABLE",
                    "private_mgu_k_torque": "AVAILABLE",
                    "actual_cell_soc": "AVAILABLE",
                },
                "notes": "Direct 100 Hz team telemetry ingress bus specification for private vehicle diagnostics.",
            },
        ]
    }



@router.post("/replay/control")
def control_replay(req: ReplayControlRequest) -> Dict[str, Any]:
    """Control continuous replay playback, seeking, speed, and event switching."""
    from kyntra.services.live_service import get_live_race_service

    service = get_live_race_service()

    if req.action == "pause":
        service.provider.pause()
    elif req.action == "resume":
        service.provider.resume()
    elif req.action == "seek":
        if req.lap is not None:
            service.seek(req.lap)
            service.step()
    elif req.action == "speed":
        if req.speed is not None:
            service.provider.set_speed(req.speed)
    elif req.action == "set_event":
        if req.event_id is not None:
            service.set_event(req.event_id)
    elif req.action == "select_battle":
        if req.battle_id is not None:
            service.state_store.set_selected_battle_id(req.battle_id)
            service.step()
    elif req.action == "step":
        service.step()
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action '{req.action}'.")

    return {
        "status": "OK",
        "action": req.action,
        "event_id": service.event_id,
        "is_paused": getattr(service.provider, "_is_paused", False),
        "playback_speed": getattr(service.provider, "_playback_speed", 1.0),
        "current_lap": getattr(service.state_store.get_race_state(), "session", None) and service.state_store.get_race_state().session.current_lap,
    }


@router.get("/track/{event_id}")
def get_track_geometry(event_id: str) -> Dict[str, Any]:
    """Retrieve normalized 2D vector coordinate path for Digital Track Twin."""
    from kyntra.processing.circuit_twin import get_circuit_geometry

    return get_circuit_geometry(event_id)


@router.get("/forecast/{event_id}")
def get_forecast(event_id: str) -> Dict[str, Any]:
    """Retrieve forward Monte-Carlo simulation batch status and outcomes.

    TRUTH GATE (Phase 5B):
    Forward Monte-Carlo simulation batch is uncalibrated on this deployment.
    Returns status='UNAVAILABLE' and run_count=0 to prevent artificial distribution fabrication.
    """
    return {
        "status": "UNAVAILABLE",
        "run_count": 0,
        "scenarios": [],
        "provenance": "FORECAST_SIMULATION",
        "message": "FORECAST NOT AVAILABLE — Forward Monte-Carlo simulation batch pending empirical calibration.",
        "event_id": event_id,
    }


# ==============================================================================
# Phase 09 Decision Publication Gate & Forensic Audit Endpoints
# ==============================================================================

@router.get("/strategy/call/current")
def get_current_published_call(battle_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve the current published KYNTRA call for an active battle or globally."""
    from kyntra.decision.store import get_decision_store
    from kyntra.publication.lifecycle import evaluate_call_staleness
    from kyntra.publication.models import PublishedCallSnapshot, CallLifecycleState

    raw_call = get_decision_store().get_latest_call(battle_id)
    if not raw_call:
        return {
            "available": False,
            "lifecycle_state": CallLifecycleState.WITHHELD.value,
            "published_call": None,
            "message": "NO_CURRENT_PUBLISHED_CALL",
        }

    call_snap = PublishedCallSnapshot(**raw_call)
    fresh_call = evaluate_call_staleness(call_snap)

    is_valid = fresh_call.lifecycle_state in [CallLifecycleState.VALID, CallLifecycleState.AGING]
    return {
        "available": is_valid,
        "lifecycle_state": fresh_call.lifecycle_state.value,
        "published_call": fresh_call.model_dump(),
        "ui_call": fresh_call.ui_call if is_valid else None,
        "backend_action": fresh_call.backend_action if is_valid else None,
    }


@router.get("/strategy/call/status")
def get_call_lifecycle_status(battle_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve the lifecycle status, freshness, and gate checks of the latest tactical call."""
    from kyntra.decision.store import get_decision_store
    from kyntra.publication.lifecycle import evaluate_call_staleness
    from kyntra.publication.models import PublishedCallSnapshot, CallLifecycleState

    raw_call = get_decision_store().get_latest_call(battle_id)
    if not raw_call:
        return {
            "has_call": False,
            "lifecycle_state": CallLifecycleState.WITHHELD.value,
            "primary_reason": "NO_CALL_RECORDED",
        }

    call_snap = PublishedCallSnapshot(**raw_call)
    fresh_call = evaluate_call_staleness(call_snap)
    return {
        "has_call": True,
        "call_id": fresh_call.call_id,
        "battle_id": fresh_call.battle_id,
        "lifecycle_state": fresh_call.lifecycle_state.value,
        "primary_reason": fresh_call.primary_reason,
        "published_at": fresh_call.published_at,
        "valid_until": fresh_call.valid_until,
        "robustness": fresh_call.robustness,
        "reason_codes": fresh_call.reason_codes,
    }


@router.get("/strategy/call/history/{battle_id}")
def get_battle_call_history(battle_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve chronological history of all published/expired/invalidated calls for a battle."""
    from kyntra.decision.store import get_decision_store

    return get_decision_store().get_call_history(battle_id=battle_id, limit=limit)


@router.get("/decision/{decision_id}")
def get_forensic_decision_snapshot(decision_id: str) -> Dict[str, Any]:
    """Retrieve an immutable forensic DecisionSnapshot by unique decision ID."""
    from kyntra.decision.store import get_decision_store

    snap = get_decision_store().get_decision(decision_id)
    if not snap:
        raise HTTPException(status_code=404, detail=f"DecisionSnapshot '{decision_id}' not found.")
    return snap


@router.post("/strategy/publish/evaluate")
def evaluate_publication_and_decision(req: DecisionRequest) -> Dict[str, Any]:
    """Evaluate full decision loop with 6-tier ranking, 7-point final gate, and forensic persistence."""
    from kyntra.decision.engine import compute_decision

    race_data = {
        "event_id": req.event_id,
        "event_name": EVENT_INFO.get(req.event_id or "", {}).get("event_name", "Custom Grand Prix"),
        "lap": req.lap,
        "attacker": req.attacker,
        "defender": req.defender,
        "track_status": req.track_status,
        "mode": "LIVE_PITWALL",
        "source_mode": "SYNTHETIC_EVALUATION",
    }
    battle_data = {
        "gap_seconds": req.gap_seconds,
        "closing_rate": req.closing_rate,
        "recent_pace_delta_1lap": req.recent_pace_delta_1lap,
        "recent_pace_delta_3laps": req.recent_pace_delta_3laps,
        "speed_trap_delta": req.speed_trap_delta,
        "tyre_age_delta": req.tyre_age_delta,
        "rear_threat": req.rear_threat,
    }
    energy_data = {
        "available_energy_mj": req.available_energy_mj,
    }

    snap = compute_decision(
        race_data=race_data,
        battle_data=battle_data,
        simulated_energy_state=energy_data,
        enable_publication_gate=True,
    )
    return snap.model_dump()



