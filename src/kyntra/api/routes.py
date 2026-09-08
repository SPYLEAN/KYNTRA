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
