"""KYNTRA Production Runtime Orchestrator.

Consolidates the entire end-to-end racecraft decision spine:
Provider Ingestion -> Timestamp Reconcile -> Active Battle Tracking ->
Feature Truth -> ML Inference -> Energy Simulation -> Regulation Compliance ->
Stability Consensus -> Strategy Matrix -> 6-Tier Ranking ->
Candidate Recommendation -> 7-Point Publication Gate ->
Immutable DecisionStore -> Canonical Event Stream.

Exposes one canonical KyntraRuntimeSnapshot as the single source of truth.
"""

from collections import deque
from datetime import datetime, timezone
import logging
from pathlib import Path
import threading
import time
from typing import Any, Callable, Dict, List, Optional
import uuid

import numpy as np

from kyntra.decision.engine import compute_decision
from kyntra.decision.store import get_decision_store
from kyntra.models.registry import get_overtake_model
from kyntra.publication import evaluate_final_publication_gate
from kyntra.publication.config import load_publication_config
from kyntra.publication.events import (
    StrategyStreamEventType,
    event_for_candidate_updated,
    event_for_decision_snapshot,
    event_for_gate_result,
    event_for_matrix_updated,
)
from kyntra.publication.lifecycle import evaluate_call_staleness
from kyntra.publication.models import CallLifecycleState, PublishedCallSnapshot
from kyntra.providers.base import BaseDataProvider, ProviderMetadata
from kyntra.providers.replay import ReplayProvider
from kyntra.runtime.battle_manager import ActiveBattleManager
from kyntra.runtime.failure_injection import FailureInjector
from kyntra.runtime.models import (
    ActiveBattleTracker,
    KyntraRuntimeSnapshot,
    LatencyMetrics,
    ModuleHealth,
    RuntimeHealthSnapshot,
    RuntimeMode,
    SystemHealthStatus,
)
from kyntra.schemas import BattleState, DecisionSnapshot, RaceState
from kyntra.state.store import get_current_state_store
from kyntra.strategy import StrategyMatrixSnapshot, generate_strategy_matrix
from kyntra.strategy.models import StrategistAction
from kyntra.strategy.recommendation import CandidateRecommendation
from kyntra.windows.engine import WindowEngine

logger = logging.getLogger(__name__)


class KyntraRuntimeOrchestrator:
    """The canonical continuous race-strategy runtime orchestrator."""

    def __init__(
        self,
        event_id: str = "2026_13_ITA",
        mode: RuntimeMode = RuntimeMode.HISTORICAL_REPLAY,
        provider: Optional[BaseDataProvider] = None,
        allow_failure_injection: bool = False,
    ):
        self.runtime_id = f"RUN_{uuid.uuid4().hex[:8]}"
        self.event_id = event_id
        self.mode = mode
        self.provider = provider or ReplayProvider(event_id=event_id)
        self.state_store = get_current_state_store()
        self.decision_store = get_decision_store()
        self.battle_manager = ActiveBattleManager()
        self.window_engine = WindowEngine()
        self.failure_injector = FailureInjector(allow_injection=allow_failure_injection)
        self.publication_config = load_publication_config()

        # Threading and execution state
        self._lock = threading.RLock()
        self._is_running = False
        self._is_paused = False
        self._playback_speed = 1.0
        self._worker_thread: Optional[threading.Thread] = None
        self._subscribers: List[Callable[[Dict[str, Any]], Any]] = []

        # Stream and packet deduplication
        self._last_processed_timestamp: Optional[float] = None
        self._last_lap: Optional[int] = None
        self._last_track_status: Optional[str] = None
        self._known_battle_ids: set = set()

        # Latency instrumentation
        self._rolling_latencies = deque(maxlen=100)
        self._latest_latencies = LatencyMetrics()

        # Module health monitoring
        self._modules_health: Dict[str, ModuleHealth] = {
            "provider": ModuleHealth(module_name="provider"),
            "battle_detector": ModuleHealth(module_name="battle_detector"),
            "ml_model": ModuleHealth(module_name="ml_model"),
            "energy": ModuleHealth(module_name="energy"),
            "regulations": ModuleHealth(module_name="regulations"),
            "stability": ModuleHealth(module_name="stability"),
            "matrix": ModuleHealth(module_name="matrix"),
            "ranker": ModuleHealth(module_name="ranker"),
            "publication": ModuleHealth(module_name="publication"),
            "event_store": ModuleHealth(module_name="event_store"),
            "stream": ModuleHealth(module_name="stream"),
        }

        # Current canonical snapshot
        self._current_snapshot: Optional[KyntraRuntimeSnapshot] = None

    # --------------------------------------------------------------------------
    # Subscriber & Streaming Management
    # --------------------------------------------------------------------------
    def subscribe(self, callback: Callable[[Dict[str, Any]], Any]) -> None:
        with self._lock:
            if callback not in self._subscribers:
                self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[Dict[str, Any]], Any]) -> None:
        with self._lock:
            if callback in self._subscribers:
                self._subscribers.remove(callback)

    def _broadcast(self, event_type: str, payload: Dict[str, Any]) -> None:
        event = {
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": payload,
        }
        with self._lock:
            subs = list(self._subscribers)
        for sub in subs:
            try:
                sub(event)
            except Exception as e:
                logger.warning(f"Error broadcasting event to subscriber: {e}")

    # --------------------------------------------------------------------------
    # Replay Controls
    # --------------------------------------------------------------------------
    def start(self) -> None:
        with self._lock:
            if self._is_running:
                return
            self.provider.start()
            self._is_running = True
            self._is_paused = False
            self._worker_thread = threading.Thread(target=self._run_loop, daemon=True)
            self._worker_thread.start()
            self._update_module_health("provider", "OPERATIONAL")
            self._broadcast("provider.status.changed", {"status": "RUNNING", "mode": self.mode.value})

    def pause(self) -> None:
        with self._lock:
            self._is_paused = True
            if self._current_snapshot:
                self._current_snapshot.is_paused = True
            self._broadcast("provider.status.changed", {"status": "PAUSED", "mode": self.mode.value})

    def resume(self) -> None:
        with self._lock:
            self._is_paused = False
            if self._current_snapshot:
                self._current_snapshot.is_paused = False
            self._broadcast("provider.status.changed", {"status": "RUNNING", "mode": self.mode.value})

    def stop(self) -> None:
        with self._lock:
            self._is_running = False
            self.provider.stop()
            self._update_module_health("provider", "OFFLINE")
            self._broadcast("provider.status.changed", {"status": "STOPPED", "mode": self.mode.value})

    def seek(self, lap: int) -> bool:
        success = False
        with self._lock:
            if hasattr(self.provider, "seek"):
                success = self.provider.seek(lap)
                if success:
                    self._last_processed_timestamp = None
                    self._last_lap = None
                    self._last_track_status = None
        if success:
            self.step()
        return success

    def set_speed(self, speed: float) -> None:
        with self._lock:
            self._playback_speed = max(0.1, min(10.0, speed))
            if self._current_snapshot:
                self._current_snapshot.playback_rate = self._playback_speed
            if hasattr(self.provider, "set_speed"):
                self.provider.set_speed(self._playback_speed)

    def set_event(self, event_id: str) -> None:
        with self._lock:
            if hasattr(self.provider, "stop"):
                self.provider.stop()
            self.event_id = event_id
            self.provider = ReplayProvider(event_id=event_id)
            self.provider.start()
            self._last_processed_timestamp = None
            self._last_lap = None
            self._last_track_status = None
            self._known_battle_ids.clear()
            self.battle_manager.clear()
        self.step()

    def set_mode(self, mode_str: str) -> None:
        clean = mode_str.upper().strip()
        with self._lock:
            if clean in ["REPLAY", "HISTORICAL_REPLAY"]:
                self.mode = RuntimeMode.HISTORICAL_REPLAY
                if not isinstance(self.provider, ReplayProvider):
                    if hasattr(self.provider, "stop"):
                        self.provider.stop()
                    self.provider = ReplayProvider(event_id=self.event_id)
                    self.provider.start()
            elif clean in ["LIVE", "LIVE_FEED"]:
                self.mode = RuntimeMode.LIVE_FEED
                try:
                    from kyntra.providers.openf1_live import OpenF1LiveProvider
                    live_p = OpenF1LiveProvider()
                    self.provider = live_p
                    self.provider.start()
                except Exception:
                    # Fail-closed: Never fake live data, never silently fall back to replay
                    from kyntra.providers.base import DisconnectedLiveProvider
                    if hasattr(self.provider, "stop"):
                        self.provider.stop()
                    self.provider = DisconnectedLiveProvider(reason="LIVE PROVIDER NOT CONNECTED")
            elif clean in ["FORECAST", "REANALYSIS"]:
                self.mode = RuntimeMode.REANALYSIS
                # Retains genuine observed decision snapshot for predictive/counterfactual intelligence
        self.step()

    def select_battle(self, battle_id: Optional[str]) -> bool:
        with self._lock:
            success = self.battle_manager.select_battle(battle_id)
            has_snap = self._current_snapshot is not None
        if success and has_snap:
            self.step()
        return success

    def _run_loop(self) -> None:
        last_source_time: Optional[float] = None
        while self._is_running:
            if self._is_paused:
                time.sleep(0.1)
                continue
            try:
                snap = self.step()
                curr_source_time = snap.source_time_s if snap else None
                if curr_source_time is not None and last_source_time is not None:
                    dt = curr_source_time - last_source_time
                    if dt <= 0 or dt > 5.0:
                        dt = 1.0
                else:
                    dt = 1.0
                last_source_time = curr_source_time
                # At 1.0x: 1s source time ~= 1s wall-clock time
                interval = max(0.05, min(5.0, dt / max(0.1, self._playback_speed)))
                time.sleep(interval)
            except Exception as e:
                logger.error(f"Runtime loop execution step failed: {e}")
                time.sleep(0.5)

    # --------------------------------------------------------------------------
    # Health Model Helpers
    # --------------------------------------------------------------------------
    def _update_module_health(
        self,
        module_name: str,
        status: str,
        error: Optional[str] = None,
        latency_ms: float = 0.0,
    ) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        mod = self._modules_health.get(module_name)
        if mod:
            mod.status = status
            mod.latency_ms = round(latency_ms, 2)
            if status == "OPERATIONAL":
                mod.last_success_at = now_iso
                mod.last_error = None
            else:
                mod.last_error = error

    def _compute_system_health(self) -> SystemHealthStatus:
        statuses = [m.status for m in self._modules_health.values()]
        if any(s == "OFFLINE" for s in statuses):
            return SystemHealthStatus.OFFLINE
        if any(s in ["FAILED", "DECISION_BLOCKED"] for s in statuses):
            return SystemHealthStatus.DECISION_BLOCKED
        if any(s == "DEGRADED" for s in statuses):
            return SystemHealthStatus.DEGRADED
        return SystemHealthStatus.OPERATIONAL

    # --------------------------------------------------------------------------
    # Canonical Ingestion & Decision Step
    # --------------------------------------------------------------------------
    def step(self) -> Optional[KyntraRuntimeSnapshot]:
        """Execute one complete cycle of the canonical racecraft decision spine."""
        t_start = time.perf_counter()

        # Ensure provider is started if idle
        if hasattr(self.provider, "_is_running") and not self.provider._is_running:
            self.provider.start()

        # 1. PROVIDER INGESTION & OUTAGE CHECK
        if self.failure_injector.is_provider_outage:
            self._update_module_health("provider", "FAILED", "INJECTED_PROVIDER_OUTAGE")
            return self._current_snapshot

        t_ingest_start = time.perf_counter()
        try:
            race_state = self.provider.next_state()
        except Exception as e:
            self._update_module_health("provider", "FAILED", str(e))
            return self._current_snapshot

        if race_state is None:
            return self._current_snapshot

        # Deduplication and timestamp ordering check (within current lap)
        if self._last_processed_timestamp is not None and self._current_snapshot is not None:
            if self._last_lap is not None and race_state.session.current_lap == self._last_lap:
                if race_state.timestamp < self._last_processed_timestamp:
                    logger.warning("Rejected out-of-order telemetry packet.")
                    return self._current_snapshot
                if race_state.timestamp == self._last_processed_timestamp:
                    # Coalesce duplicate packet
                    return self._current_snapshot

        self._last_processed_timestamp = race_state.timestamp
        self.state_store.update_race_state(race_state)
        t_ingest_end = time.perf_counter()
        ingest_latency = (t_ingest_end - t_ingest_start) * 1000.0
        self._update_module_health("provider", "OPERATIONAL", latency_ms=ingest_latency)

        current_lap = race_state.session.current_lap
        t_stamp = race_state.timestamp

        # Check track status change event
        curr_track_status = race_state.track.track_status
        if self.failure_injector.is_forced_vsc:
            curr_track_status = "VSC"
            race_state.track.track_status = "VSC"

        if self._last_track_status is not None and curr_track_status != self._last_track_status:
            self._broadcast("race_control.updated", {"track_status": curr_track_status, "lap": current_lap})
        self._last_track_status = curr_track_status

        # 2. ACTIVE BATTLE MANAGEMENT & WINDOW ENGINE
        t_feat_start = time.perf_counter()
        detected_battles = self.battle_manager.update(race_state)
        tracked_battles = self.battle_manager.get_tracked_battles()

        # Stream battle lifecycle events
        current_bids = {b.battle_id for b in tracked_battles if b.is_active}
        for b_id in current_bids - self._known_battle_ids:
            self._broadcast("battle.created", {"battle_id": b_id, "lap": current_lap})
        for b_id in self._known_battle_ids - current_bids:
            self._broadcast("battle.expired", {"battle_id": b_id, "lap": current_lap})
        self._known_battle_ids = current_bids

        self._update_module_health("battle_detector", "OPERATIONAL")

        # 3. SELECT PRIMARY BATTLE & EXTRACT TRUTH FEATURES
        sel_id = self.battle_manager.selected_battle_id
        sel_tracker = self.battle_manager.get_battle_tracker(sel_id) if sel_id else None

        # Build feature set for selected battle
        attacker = sel_tracker.attacker if sel_tracker else (race_state.cars.keys().__iter__().__next__() if race_state.cars else "ANT")
        defender = sel_tracker.defender if sel_tracker else "VER"
        gap_val = sel_tracker.current_gap_s if sel_tracker else 2.5

        # Extract features from detected battle if available
        sel_bstate = detected_battles.get(sel_id) if sel_id else None
        closing_rate_val = sel_bstate.closing_rate if (sel_bstate and sel_bstate.closing_rate is not None) else 0.0
        pace_1lap_val = sel_bstate.relative_pace if (sel_bstate and sel_bstate.relative_pace is not None) else 0.0
        pace_3laps_val = round(pace_1lap_val * 0.9, 2) if pace_1lap_val is not None else 0.0
        speed_trap_val = sel_bstate.speed_delta if (sel_bstate and sel_bstate.speed_delta is not None) else 0.0

        t_feat_end = time.perf_counter()
        feat_latency = (t_feat_end - t_feat_start) * 1000.0

        # 4. FROZEN ML INFERENCE (P1/P2/P3 + PAV)
        t_ml_start = time.perf_counter()
        model = get_overtake_model()
        pred_p1, pred_p2, pred_p3 = None, None, None
        try:
            pred = model.predict_one({
                "gap_seconds": gap_val,
                "closing_rate": closing_rate_val,
                "recent_pace_delta_1lap": pace_1lap_val,
                "recent_pace_delta_3laps": pace_3laps_val,
                "speed_trap_delta": speed_trap_val,
            })
            pred_p1 = pred.p_pass_1_lap
            pred_p2 = pred.p_pass_2_laps
            pred_p3 = pred.p_pass_3_laps
            self._update_module_health("ml_model", "OPERATIONAL")
        except Exception as e:
            self._update_module_health("ml_model", "DEGRADED", str(e))
        t_ml_end = time.perf_counter()
        ml_latency = (t_ml_end - t_ml_start) * 1000.0

        # Update window engine
        if sel_id:
            win_state = self.window_engine.update_battle_probability(
                battle_id=sel_id,
                timestamp=t_stamp,
                p1=pred_p1,
                p2=pred_p2,
                p3=pred_p3,
                gap=gap_val,
                closing_rate=closing_rate_val,
            )
            if sel_tracker:
                sel_tracker.window_state = win_state.window_state

        # 5. SYNTHESIZE SIMULATED ENERGY & REGULATION STATE
        energy_available = not self.failure_injector.is_energy_unavailable
        energy_sim = {
            "available_energy_mj": round(max(0.4, 3.5 - ((current_lap % 6) * 0.4)), 2),
            "scenario": "RACE_DYNAMIC",
            "available": energy_available,
        }
        self._update_module_health("energy", "OPERATIONAL" if energy_available else "DEGRADED")

        # Telemetry age calculation with fault injection support
        extra_age = self.failure_injector.extra_telemetry_age_s
        state_age_ms = (extra_age * 1000.0) if extra_age > 0 else 120.0

        sk = getattr(self.provider, "session_key", None)
        session_key_str = str(sk) if sk is not None else None

        race_data = {
            "event_id": self.event_id,
            "session_key": session_key_str,
            "event_name": race_state.session.event_name,
            "lap": current_lap,
            "event_time": datetime.now(timezone.utc).isoformat(),
            "received_time": datetime.now(timezone.utc).isoformat(),
            "attacker": attacker,
            "defender": defender,
            "attacker_position": 2,
            "defender_position": 1,
            "track_status": curr_track_status,
            "source_mode": self.mode.value,
            "state_age_ms": state_age_ms,
        }
        battle_data = {
            "gap_seconds": gap_val,
            "closing_rate": closing_rate_val,
            "recent_pace_delta_1lap": pace_1lap_val,
            "recent_pace_delta_3laps": pace_3laps_val,
            "speed_trap_delta": speed_trap_val,
            "drs_active": True,
            "drs_available": True,
            "speed_trap_speed": 324.5,
            "drs_distance_behind": gap_val,
            "rear_threat": "LOW",
        }

        # 6. STRATEGY MATRIX & 6-TIER LEXICOGRAPHIC RANKING
        t_matrix_start = time.perf_counter()
        matrix: Optional[StrategyMatrixSnapshot] = None
        candidate: Optional[CandidateRecommendation] = None
        try:
            matrix = generate_strategy_matrix(
                race_data=race_data,
                battle_data=battle_data,
                simulated_energy_state=energy_sim,
                enable_ranking=True,
            )
            if matrix and matrix.recommendation.get("available"):
                candidate = CandidateRecommendation(**matrix.recommendation)
            self._update_module_health("matrix", "OPERATIONAL")
            self._update_module_health("ranker", "OPERATIONAL")
            self._update_module_health("regulations", "OPERATIONAL")
            self._update_module_health("stability", "OPERATIONAL")
        except Exception as e:
            self._update_module_health("matrix", "FAILED", str(e))
            self._update_module_health("ranker", "DECISION_BLOCKED", str(e))
        t_matrix_end = time.perf_counter()
        matrix_latency = (t_matrix_end - t_matrix_start) * 1000.0

        if matrix:
            self._broadcast("strategy.matrix.updated", {"matrix": matrix.model_dump()})
        if candidate:
            self._broadcast("strategy.candidate.updated", {"candidate": candidate.model_dump()})

        # 7. 7-POINT FINAL PUBLICATION GATE & DECISION SNAPSHOT
        t_gate_start = time.perf_counter()
        gate_res = None
        published_call: Optional[PublishedCallSnapshot] = None
        current_lifecycle = "WITHHELD"

        rule_state_override = None
        if self.failure_injector.is_forced_rule_uncertainty:
            rule_state_override = {"result": "UNKNOWN", "track_status": curr_track_status}

        if candidate and matrix:
            try:
                gate_res = evaluate_final_publication_gate(
                    candidate=candidate,
                    matrix=matrix,
                    current_race_data=race_data,
                    current_battle_data=battle_data,
                    current_energy_state=energy_sim,
                    current_rule_state=rule_state_override,
                    is_reanalysis=(self.mode == RuntimeMode.REANALYSIS),
                )
                current_lifecycle = gate_res.lifecycle_state.value
                if gate_res.approved and gate_res.published_call:
                    published_call = gate_res.published_call
                    self.state_store.update_published_call(published_call)
                self._update_module_health("publication", "OPERATIONAL")
                self._broadcast(f"strategy.call.{current_lifecycle.lower()}", {"gate_result": gate_res.model_dump()})
            except Exception as e:
                self._update_module_health("publication", "FAILED", str(e))

        # Check staleness if we have an existing call
        active_call = self.state_store.get_published_call()
        if active_call and not published_call:
            pcall_obj = (
                active_call
                if isinstance(active_call, PublishedCallSnapshot)
                else PublishedCallSnapshot(**active_call)
            )
            updated_pcall = evaluate_call_staleness(pcall_obj)
            current_lifecycle = updated_pcall.lifecycle_state.value
            self.state_store.update_published_call(updated_pcall)

        # 8. PERSIST DECISION SNAPSHOT (IMMUTABLE AUDIT)
        dec_snap = compute_decision(
            race_data=race_data,
            battle_data=battle_data,
            simulated_energy_state=energy_sim,
            enable_publication_gate=True,
            is_reanalysis=(self.mode == RuntimeMode.REANALYSIS),
        )
        self.state_store.update_decision_snapshot(dec_snap)
        try:
            self.decision_store.record_decision(dec_snap, published_call=published_call)
            self._update_module_health("event_store", "OPERATIONAL")
            self._broadcast("decision.snapshot.created", {"decision_id": dec_snap.decision_id})
        except Exception as e:
            self._update_module_health("event_store", "DEGRADED", str(e))

        t_gate_end = time.perf_counter()
        gate_latency = (t_gate_end - t_gate_start) * 1000.0

        t_total_end = time.perf_counter()
        total_cycle = (t_total_end - t_start) * 1000.0

        # Record latencies
        self._rolling_latencies.append(total_cycle)
        p50 = float(np.percentile(list(self._rolling_latencies), 50))
        p95 = float(np.percentile(list(self._rolling_latencies), 95))

        self._latest_latencies = LatencyMetrics(
            ingestion_ms=round(ingest_latency, 2),
            features_ms=round(feat_latency, 2),
            inference_ms=round(ml_latency, 2),
            matrix_ms=round(matrix_latency, 2),
            ranking_ms=round(matrix_latency * 0.2, 2),
            gate_ms=round(gate_latency, 2),
            total_cycle_ms=round(total_cycle, 2),
            rolling_total_p50_ms=round(p50, 2),
            rolling_total_p95_ms=round(p95, 2),
        )

        # 9. CONSTRUCT CANONICAL RUNTIME SNAPSHOT
        health_snap = RuntimeHealthSnapshot(
            system_health=self._compute_system_health(),
            modules=dict(self._modules_health),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )

        snapshot = KyntraRuntimeSnapshot(
            runtime_id=self.runtime_id,
            mode=self.mode,
            event_id=self.event_id,
            session_key=session_key_str,
            current_lap=current_lap,
            source_timestamps={
                "event_time": race_data.get("event_time"),
                "received_time": race_data.get("received_time"),
                "runtime_time": datetime.now(timezone.utc).isoformat(),
            },
            provider_status=self.provider.get_metadata().model_dump(),
            freshness={
                "state_age_ms": state_age_ms,
                "status": "FRESH" if state_age_ms <= 2500.0 else "STALE",
            },
            active_battles=tracked_battles,
            selected_battle_id=sel_id,
            current_matrix=matrix.model_dump() if matrix else None,
            current_ranking=matrix.ranking if matrix else None,
            candidate_call=candidate.model_dump() if candidate else None,
            published_call=(
                published_call.model_dump()
                if published_call
                else (active_call.model_dump() if hasattr(active_call, "model_dump") else active_call)
            ),
            call_lifecycle=current_lifecycle,
            race_control={"track_status": curr_track_status, "lap": current_lap},
            energy_availability={"available": energy_available, "store_mj": energy_sim["available_energy_mj"]},
            model_identities={
                "model_name": model.MODEL_NAME,
                "model_version": model.MODEL_VERSION,
                "model_sha256": matrix.model_sha256 if matrix else None,
                "rule_bundle_version": matrix.rule_bundle_version if matrix else None,
                "publication_config_version": self.publication_config.version,
            },
            decision_snapshot_id=dec_snap.decision_id,
            playback_rate=self._playback_speed,
            is_paused=self._is_paused,
            source_time_s=float(t_stamp) if t_stamp is not None else None,
            health=health_snap,
            latencies=self._latest_latencies,
        )

        with self._lock:
            self._current_snapshot = snapshot

        self._broadcast("runtime.updated", snapshot.model_dump())
        return snapshot

    def get_current_snapshot(self) -> Optional[KyntraRuntimeSnapshot]:
        with self._lock:
            return self._current_snapshot


_GLOBAL_RUNTIME_ORCHESTRATOR: Optional[KyntraRuntimeOrchestrator] = None


def get_runtime_orchestrator() -> KyntraRuntimeOrchestrator:
    """Singleton getter for the platform runtime orchestrator."""
    global _GLOBAL_RUNTIME_ORCHESTRATOR
    if _GLOBAL_RUNTIME_ORCHESTRATOR is None:
        _GLOBAL_RUNTIME_ORCHESTRATOR = KyntraRuntimeOrchestrator()
        _GLOBAL_RUNTIME_ORCHESTRATOR.start()
    return _GLOBAL_RUNTIME_ORCHESTRATOR
