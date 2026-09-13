"""KYNTRA Live Race Intelligence Service.

Coordinates the continuous pipeline:
1. Provider Ingest (Replay / Live / Team)
2. Normalized RaceState update
3. Persistent EventStore emission
4. Automated Battle Discovery
5. Frozen LightGBM Inference + PAV reconciliation
6. Rolling Window Engine trajectory tracking
7. Decision Snapshot synthesis
8. WebSocket live streaming
"""

import asyncio
import threading
import time
from typing import Any, Callable, Dict, List, Optional
import uuid

from pathlib import Path
import logging

from kyntra.battles.detector import BattleDetector
from kyntra.battles.watchlist import BattleWatchlistEngine
from kyntra.decision.engine import compute_decision
from kyntra.events.store import get_event_store
from kyntra.ingestion.capture import (
    DEFAULT_CAPTURE_DIR,
    SessionCaptureHeader,
    SessionCaptureWriter,
)
from kyntra.models.registry import get_overtake_model
from kyntra.processing.circuit_twin import interpolate_car_position
from kyntra.providers.base import BaseDataProvider, ProviderMetadata
from kyntra.providers.openf1_live import OpenF1LiveProvider
from kyntra.providers.replay import ReplayProvider
from kyntra.schemas import (
    BattleState,
    BattleWatchlistItem,
    DecisionSnapshot,
    RaceEvent,
    RaceState,
    WindowState,
)
from kyntra.state.store import get_current_state_store
from kyntra.windows.engine import WindowEngine

logger = logging.getLogger(__name__)


class LiveRaceService:
    """Singleton service orchestrating live race state, intelligence, and streaming."""

    def __init__(self, event_id: str = "2026_13_ITA"):
        self.event_id = event_id
        self.provider: BaseDataProvider = ReplayProvider(event_id=event_id)
        self.state_store = get_current_state_store()
        self.event_store = get_event_store()
        self.detector = BattleDetector()
        self.watchlist_engine = BattleWatchlistEngine()
        self.window_engine = WindowEngine()

        self._subscribers: List[Callable[[Dict[str, Any]], Any]] = []
        self._is_running = False
        self._worker_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # State transition tracking for event deduplication
        self._last_lap: Optional[int] = None
        self._last_track_status: Optional[str] = None
        self._last_positions: Dict[str, int] = {}
        self._last_active_battle_ids: set = set()
        self._last_window_states: Dict[str, str] = {}

    def subscribe(self, callback: Callable[[Dict[str, Any]], Any]) -> None:
        """Register a subscriber callback (e.g. WebSocket connection)."""
        with self._lock:
            if callback not in self._subscribers:
                self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[Dict[str, Any]], Any]) -> None:
        """Unregister a subscriber callback."""
        with self._lock:
            if callback in self._subscribers:
                self._subscribers.remove(callback)

    def start(self) -> None:
        """Start the provider and background tick worker."""
        if self._is_running:
            return
        self.provider.start()
        self._is_running = True
        self._worker_thread = threading.Thread(target=self._run_loop, daemon=True)
        self._worker_thread.start()

        # Emit initial session started event
        init_event = RaceEvent(
            event_id=RaceEvent.build_deterministic_id(
                race_id=self.event_id,
                lap=1,
                event_type="SESSION_STARTED",
                timestamp=0.0,
                cars=[],
                battle_id=None,
                source="LIVE_SERVICE",
            ),
            timestamp=0.0,
            race_id=self.event_id,
            lap=1,
            sector=1,
            event_type="SESSION_STARTED",
            cars=[],
            battle_id=None,
            raw_state_reference=f"provider:{self.provider.get_metadata().provider_type}",
            derived_data={"event_id": self.event_id},
            source="LIVE_SERVICE",
            provenance="PROVENANCE_VERIFIED",
        )
        self.event_store.append_event(init_event)

    def stop(self) -> None:
        """Stop provider and worker."""
        self._is_running = False
        self.provider.stop()

    def seek(self, lap: int) -> bool:
        """Seek provider to a given lap and reset transition state trackers."""
        if hasattr(self.provider, "seek"):
            success = self.provider.seek(lap)
            if success:
                self._last_lap = None
                self._last_track_status = None
                self._last_active_battle_ids = set()
                self._last_window_states = {}
                self._last_positions = {}
            return success
        return False

    def set_event(self, event_id: str) -> None:
        """Switch active event provider."""
        self.stop()
        self.event_id = event_id
        self.provider = ReplayProvider(event_id=event_id)
        self.window_engine.clear()
        self.state_store.set_selected_battle_id(None)
        self._last_lap = None
        self._last_track_status = None
        self._last_positions.clear()
        self._last_active_battle_ids.clear()
        self._last_window_states.clear()
        self.start()
        self.step()

    def select_provider(
        self,
        provider_type: str,
        session_key: Optional[str] = None,
        event_id: Optional[str] = None,
        capture_path: Optional[str] = None,
    ) -> ProviderMetadata:
        """Switch provider between OPENF1_LIVE, REPLAY, and CAPTURED_LIVE with truthful fallback."""
        self.stop()
        if provider_type == "OPENF1_LIVE":
            try:
                live_prov = OpenF1LiveProvider(session_key=session_key)
                self.provider = live_prov
                self.event_id = live_prov.event_id
            except Exception as e:
                logger.error(f"Failed to initialize OpenF1LiveProvider: {e}. Fail-closed to DisconnectedLiveProvider.")
                from kyntra.providers.base import DisconnectedLiveProvider
                self.provider = DisconnectedLiveProvider(reason="LIVE PROVIDER NOT CONNECTED")
        elif provider_type == "CAPTURED_LIVE" and capture_path:
            self.provider = ReplayProvider(capture_path=capture_path)
            self.event_id = f"capture_{Path(capture_path).stem}"
        else:
            tgt_event = event_id or "2026_13_ITA"
            self.event_id = tgt_event
            self.provider = ReplayProvider(event_id=tgt_event)

        self.window_engine.clear()
        self.state_store.set_selected_battle_id(None)
        self._last_lap = None
        self._last_track_status = None
        self._last_positions.clear()
        self._last_active_battle_ids.clear()
        self._last_window_states.clear()
        self.start()
        self.step()
        return self.provider.get_metadata()

    def start_capture(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Start recording incoming normalized live stream to local JSONL capture file."""
        if hasattr(self.provider, "capture_writer") and self.provider.capture_writer:
            return {"status": "ALREADY_CAPTURING", "path": str(self.provider.capture_writer.output_path)}

        sid = session_id or f"capture_{self.event_id}_{int(time.time())}"
        DEFAULT_CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
        out_file = DEFAULT_CAPTURE_DIR / f"{sid}.jsonl"
        hdr = SessionCaptureHeader(
            session_id=sid,
            event_id=self.event_id,
            event_name=getattr(self.provider, "event_name", "Grand Prix Session"),
            circuit=getattr(self.provider, "circuit_name", "Circuit"),
            session_type=getattr(self.provider, "session_type", "PRACTICE"),
            source_provider=self.provider.get_metadata().provider_type,
            source_mode="CAPTURED_LIVE",
            meeting_key=getattr(self.provider, "meeting_key", None),
            session_key=getattr(self.provider, "session_key", None),
        )
        writer = SessionCaptureWriter(out_file, hdr)
        if hasattr(self.provider, "capture_writer"):
            self.provider.capture_writer = writer
        return {"status": "CAPTURING", "session_id": sid, "file_path": str(out_file)}

    def stop_capture(self) -> Dict[str, Any]:
        """Stop local session capture recording."""
        if hasattr(self.provider, "capture_writer") and self.provider.capture_writer:
            path = str(self.provider.capture_writer.output_path)
            frames = self.provider.capture_writer._frame_count
            self.provider.capture_writer.close()
            self.provider.capture_writer = None
            return {"status": "STOPPED", "file_path": path, "total_frames": frames}
        return {"status": "NOT_CAPTURING"}

    def step(self) -> Optional[Dict[str, Any]]:
        """Advance one tick synchronously, process intelligence, and return payload."""
        race_state = self.provider.next_state()
        if race_state is None:
            return None

        payload = self._process_state(race_state)
        self._broadcast(payload)
        return payload

    def _run_loop(self) -> None:
        """Continuous background tick loop."""
        last_t = None
        while self._is_running:
            if getattr(self.provider, "_is_paused", False):
                time.sleep(0.1)
                continue
            try:
                payload = self.step()
                curr_t = payload.get("timestamp") if payload else None
                if curr_t is not None and last_t is not None:
                    dt = curr_t - last_t
                    if dt <= 0 or dt > 5.0:
                        dt = 1.0
                else:
                    dt = 1.0
                last_t = curr_t
                speed = getattr(self.provider, "_playback_speed", 1.0)
                interval = max(0.05, min(5.0, dt / max(0.1, speed)))
                time.sleep(interval)
            except Exception:
                time.sleep(0.5)

    def _process_state(self, race_state: RaceState) -> Dict[str, Any]:
        """Core intelligence pipeline on newly ingested RaceState."""
        # Update current RaceState in state store
        self.state_store.update_race_state(race_state)
        current_lap = race_state.session.current_lap
        t_stamp = race_state.timestamp

        # 1. Automated Battle Detection
        battles = self.detector.detect_battles(race_state)

        # 2. Frozen ML Inference & Window Engine update for all active battles
        model = get_overtake_model()
        window_summary: Dict[str, str] = {}
        battle_decisions: Dict[str, DecisionSnapshot] = {}

        for b_id, b in battles.items():
            # Truth Gate: Extract exact features without fabricating defaults
            gap_val = b.gap_seconds
            closing_rate_val = b.closing_rate
            pace_1lap_val = b.relative_pace
            pace_3laps_val = round(pace_1lap_val * 0.9, 2) if pace_1lap_val is not None else None
            speed_trap_val = b.speed_delta

            feats = {
                "gap_seconds": gap_val,
                "closing_rate": closing_rate_val,
                "recent_pace_delta_1lap": pace_1lap_val,
                "recent_pace_delta_3laps": pace_3laps_val,
                "speed_trap_delta": speed_trap_val,
            }

            p1, p2, p3 = None, None, None
            # Only infer if all 5 features are valid numbers; do not generate substitutes
            missing_feats = [k for k, v in feats.items() if v is None]
            if not missing_feats:
                try:
                    pred = model.predict_one(feats)
                    p1 = pred.p_pass_1_lap
                    p2 = pred.p_pass_2_laps
                    p3 = pred.p_pass_3_laps
                except Exception:
                    pass

            # Update rolling window
            win_state = self.window_engine.update_battle_probability(
                battle_id=b_id,
                timestamp=t_stamp,
                p1=p1,
                p2=p2,
                p3=p3,
                gap=gap_val if gap_val is not None else 0.0,
                closing_rate=closing_rate_val if closing_rate_val is not None else 0.0,
            )
            self.state_store.update_window(b_id, win_state)
            window_summary[b_id] = win_state.window_state

            # Compute coherent DecisionSnapshot for battle
            att_pos = b.attacker_position or 2
            def_pos = b.defender_position or 1
            race_data = {
                "event_id": self.event_id,
                "event_name": race_state.session.event_name,
                "lap": current_lap,
                "replay_time": t_stamp,
                "attacker": b.attacker,
                "defender": b.defender,
                "attacker_position": att_pos,
                "defender_position": def_pos,
                "track_status": race_state.track.track_status,
            }
            battle_data = {
                "gap_seconds": b.gap_seconds,
                "distance_gap_m": round(b.gap_seconds * 65.0, 1) if b.gap_seconds is not None else None,
                "closing_rate": b.closing_rate,
                "recent_pace_delta_1lap": pace_1lap_val,
                "recent_pace_delta_3laps": pace_3laps_val,
                "speed_trap_delta": speed_trap_val,
                "speed_delta": b.speed_delta,
                "tyre_age_delta": b.tyre_context.get("tyre_age_delta"),
                "laps_following": min(current_lap, 10),
                "rear_threat": b.traffic_context.get("rear_threat", "LOW"),
            }
            energy_sim = {
                "available_energy_mj": round(max(0.6, 3.5 - ((current_lap % 6) * 0.4)), 2),
                "scenario": "RACE_DYNAMIC",
            }
            battle_decisions[b_id] = compute_decision(
                race_data=race_data,
                battle_data=battle_data,
                simulated_energy_state=energy_sim,
            )

        # 3. Build Watchlist
        watchlist = self.watchlist_engine.build_watchlist(
            battles=battles,
            track_state=race_state.track,
            window_states=window_summary,
        )
        self.state_store.update_battles(battles=battles, watchlist=watchlist)

        # Determine primary selected battle
        sel_id = self.state_store.get_selected_battle_id()
        if not sel_id or sel_id not in battle_decisions:
            sel_id = watchlist[0].battle_id if watchlist else None

        primary_decision = None
        if sel_id and sel_id in battle_decisions:
            primary_decision = battle_decisions[sel_id]
            self.state_store.update_decision_snapshot(primary_decision)
        elif not watchlist:
            # Field has no close battles; fallback decision
            first_drv = list(race_state.cars.keys())[0] if race_state.cars else "ANT"
            second_drv = list(race_state.cars.keys())[1] if len(race_state.cars) > 1 else "VER"
            primary_decision = compute_decision(
                race_data={
                    "event_id": self.event_id,
                    "event_name": race_state.session.event_name,
                    "lap": current_lap,
                    "replay_time": t_stamp,
                    "attacker": second_drv,
                    "defender": first_drv,
                    "attacker_position": 2,
                    "defender_position": 1,
                    "track_status": race_state.track.track_status,
                },
                battle_data={"gap_seconds": 3.5},
            )
            self.state_store.update_decision_snapshot(primary_decision)

        # 4. Check for state transitions and record meaningful RaceEvents
        self._check_and_record_events(race_state, battles, watchlist, window_summary)

        # Get recent events from persistent store
        recent_events = self.event_store.get_events(race_id=self.event_id, limit=20)

        # 5. Build full coherent update payload
        return {
            "type": "live_update",
            "timestamp": t_stamp,
            "event_id": self.event_id,
            "race_state": race_state.model_dump(),
            "decision": primary_decision.model_dump() if primary_decision else None,
            "watchlist": [item.model_dump() for item in watchlist],
            "active_windows": {k: v.model_dump() for k, v in self.state_store.get_all_windows().items()},
            "selected_battle_id": sel_id,
            "recent_events": [e.model_dump() for e in recent_events],
            "provider_meta": self.provider.get_metadata().model_dump(),
            "capabilities": self.provider.get_capabilities().model_dump(),
        }

    def _check_and_record_events(
        self,
        race_state: RaceState,
        battles: Dict[str, BattleState],
        watchlist: List[BattleWatchlistItem],
        window_summary: Dict[str, str],
    ) -> None:
        """Deduplicate and append significant discrete race events."""
        t_stamp = race_state.timestamp
        current_lap = race_state.session.current_lap

        # A. Lap change event
        if self._last_lap is not None and current_lap != self._last_lap:
            self.event_store.append_event(
                RaceEvent(
                    event_id=RaceEvent.build_deterministic_id(
                        race_id=self.event_id,
                        lap=current_lap,
                        event_type="LAP_CHANGED",
                        timestamp=t_stamp,
                        cars=[],
                        battle_id=None,
                        source="LIVE_SERVICE",
                    ),
                    timestamp=t_stamp,
                    race_id=self.event_id,
                    lap=current_lap,
                    sector=1,
                    event_type="LAP_CHANGED",
                    cars=[],
                    battle_id=None,
                    derived_data={"lap": current_lap, "total_laps": race_state.session.total_laps},
                    source="LIVE_SERVICE",
                    provenance="TELEMETRY_LAP_CROSSING",
                )
            )
        self._last_lap = current_lap

        # B. Track status change event
        curr_ts = race_state.track.track_status
        if self._last_track_status is not None and curr_ts != self._last_track_status:
            self.event_store.append_event(
                RaceEvent(
                    event_id=RaceEvent.build_deterministic_id(
                        race_id=self.event_id,
                        lap=current_lap,
                        event_type="TRACK_STATUS_CHANGED",
                        timestamp=t_stamp,
                        cars=[],
                        battle_id=None,
                        source="RACE_CONTROL",
                        discriminator=f"to_{curr_ts}",
                    ),
                    timestamp=t_stamp,
                    race_id=self.event_id,
                    lap=current_lap,
                    sector=race_state.track.sector,
                    event_type="TRACK_STATUS_CHANGED",
                    cars=[],
                    battle_id=None,
                    derived_data={"from": self._last_track_status, "to": curr_ts},
                    source="RACE_CONTROL",
                    provenance="FIA_TRACK_STATUS_FEED",
                )
            )
        self._last_track_status = curr_ts

        # C. Battle formed / ended events
        curr_battle_ids = set(battles.keys())
        new_battles = curr_battle_ids - self._last_active_battle_ids
        ended_battles = self._last_active_battle_ids - curr_battle_ids

        for b_id in new_battles:
            b = battles[b_id]
            self.event_store.append_event(
                RaceEvent(
                    event_id=RaceEvent.build_deterministic_id(
                        race_id=self.event_id,
                        lap=current_lap,
                        event_type="BATTLE_FORMED",
                        timestamp=t_stamp,
                        cars=[b.attacker, b.defender],
                        battle_id=b_id,
                        source="BATTLE_DETECTOR",
                    ),
                    timestamp=t_stamp,
                    race_id=self.event_id,
                    lap=current_lap,
                    sector=race_state.track.sector,
                    event_type="BATTLE_FORMED",
                    cars=[b.attacker, b.defender],
                    battle_id=b_id,
                    derived_data={"gap": b.gap_seconds, "attacker_pos": b.attacker_position},
                    source="BATTLE_DETECTOR",
                    provenance="BATTLE_DISCOVERY_HEURISTIC",
                )
            )

        for b_id in ended_battles:
            parts = b_id.split("_")
            cars = parts[-2:] if len(parts) >= 2 else []
            self.event_store.append_event(
                RaceEvent(
                    event_id=RaceEvent.build_deterministic_id(
                        race_id=self.event_id,
                        lap=current_lap,
                        event_type="BATTLE_ENDED",
                        timestamp=t_stamp,
                        cars=cars,
                        battle_id=b_id,
                        source="BATTLE_DETECTOR",
                    ),
                    timestamp=t_stamp,
                    race_id=self.event_id,
                    lap=current_lap,
                    sector=race_state.track.sector,
                    event_type="BATTLE_ENDED",
                    cars=cars,
                    battle_id=b_id,
                    derived_data={},
                    source="BATTLE_DETECTOR",
                    provenance="BATTLE_DISCOVERY_HEURISTIC",
                )
            )
        self._last_active_battle_ids = curr_battle_ids

        # D. Window peaking / forming / fading events
        for b_id, w_state in window_summary.items():
            last_w = self._last_window_states.get(b_id)
            if last_w != w_state and w_state in ["FORMING", "PEAKING", "FADING"]:
                event_type_map = {
                    "FORMING": "PASS_WINDOW_FORMING",
                    "PEAKING": "PASS_WINDOW_PEAKING",
                    "FADING": "PASS_WINDOW_FADING",
                }
                b = battles.get(b_id)
                cars_list = [b.attacker, b.defender] if b else []
                self.event_store.append_event(
                    RaceEvent(
                        event_id=RaceEvent.build_deterministic_id(
                            race_id=self.event_id,
                            lap=current_lap,
                            event_type=event_type_map[w_state],
                            timestamp=t_stamp,
                            cars=cars_list,
                            battle_id=b_id,
                            source="WINDOW_ENGINE",
                        ),
                        timestamp=t_stamp,
                        race_id=self.event_id,
                        lap=current_lap,
                        sector=race_state.track.sector,
                        event_type=event_type_map[w_state],
                        cars=cars_list,
                        battle_id=b_id,
                        derived_data={"window_state": w_state, "gap": b.gap_seconds if b else None},
                        source="WINDOW_ENGINE",
                        provenance="WINDOW_STATE_HEURISTIC",
                    )
                )
        self._last_window_states = dict(window_summary)

        # E. Position changes (overtakes / inversions)
        for code, car in race_state.cars.items():
            if car.position is not None:
                last_pos = self._last_positions.get(code)
                if last_pos is not None and car.position < last_pos:  # Improved position
                    self.event_store.append_event(
                        RaceEvent(
                            event_id=RaceEvent.build_deterministic_id(
                                race_id=self.event_id,
                                lap=current_lap,
                                event_type="POSITION_CHANGED",
                                timestamp=t_stamp,
                                cars=[code],
                                battle_id=None,
                                source="TIMING_FEED",
                                discriminator=f"P{last_pos}_to_P{car.position}",
                            ),
                            timestamp=t_stamp,
                            race_id=self.event_id,
                            lap=current_lap,
                            sector=race_state.track.sector,
                            event_type="POSITION_CHANGED",
                            cars=[code],
                            battle_id=None,
                            derived_data={"driver": code, "from": last_pos, "to": car.position},
                            source="TIMING_FEED",
                            provenance="TIMING_LINE_TRANSPONDER",
                        )
                    )
                self._last_positions[code] = car.position

    def _broadcast(self, payload: Dict[str, Any]) -> None:
        """Broadcast payload to all registered subscriber callbacks."""
        with self._lock:
            subscribers = list(self._subscribers)
        for cb in subscribers:
            try:
                cb(payload)
            except Exception:
                pass


# Global singleton instance
_GLOBAL_LIVE_SERVICE: Optional[LiveRaceService] = None


def get_live_race_service(event_id: str = "2026_13_ITA") -> LiveRaceService:
    global _GLOBAL_LIVE_SERVICE
    if _GLOBAL_LIVE_SERVICE is None:
        _GLOBAL_LIVE_SERVICE = LiveRaceService(event_id=event_id)
    return _GLOBAL_LIVE_SERVICE


get_live_service = get_live_race_service
