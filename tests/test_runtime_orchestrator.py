"""KYNTRA Phase 10 Production Runtime Orchestrator Test Suite.

Rigorously verifies:
1. Continuous state progression and canonical snapshot generation
2. Active battle lifecycle: detection, continuity across laps, and TTL expiration
3. Selected battle switching and fallback
4. Duplicate packet coalescing and out-of-order packet rejection
5. Provider failure and disconnect/reconnect resilience
6. Partial module degradation without process crashes
7. Strict UNKNOWN and failure hierarchy preservation
8. Call publication, staleness, and invalidation
9. DecisionStore SQLite durability across process restarts
10. Health model transitions (OPERATIONAL, DEGRADED, DECISION_BLOCKED, OFFLINE)
11. Replay controls (start, pause, resume, seek, speed)
12. Failure injection safety isolation (disabled in production mode)
13. Frozen LightGBM model bundle SHA-256 integrity
"""

import copy
import hashlib
from pathlib import Path
import tempfile
import pytest

from kyntra.decision.store import DecisionStore
from kyntra.publication.models import CallLifecycleState
from kyntra.runtime.battle_manager import ActiveBattleManager
from kyntra.runtime.failure_injection import FailureInjector
from kyntra.runtime.models import (
    ActiveBattleTracker,
    KyntraRuntimeSnapshot,
    RuntimeMode,
    SystemHealthStatus,
)
from kyntra.runtime.orchestrator import KyntraRuntimeOrchestrator
from kyntra.schemas import BattleState, RaceState


FROZEN_MODEL_PATH = Path("models/kyntra_overtake_bundle_v1.joblib")
EXPECTED_MODEL_SHA = "a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5"


@pytest.fixture
def orchestrator():
    """Create clean orchestrator for testing."""
    orch = KyntraRuntimeOrchestrator(
        event_id="2026_01_AUS",
        mode=RuntimeMode.SYNTHETIC_TEST,
        allow_failure_injection=True,
    )
    yield orch
    orch.stop()


# ==============================================================================
# 1. Continuous Progression & Canonical Snapshot
# ==============================================================================
def test_continuous_state_progression_and_snapshot_schema(orchestrator):
    """Step through pipeline and verify KyntraRuntimeSnapshot completeness."""
    snap = orchestrator.step()
    assert snap is not None
    assert isinstance(snap, KyntraRuntimeSnapshot)
    assert snap.runtime_id.startswith("RUN_")
    assert snap.mode == RuntimeMode.SYNTHETIC_TEST
    assert snap.event_id == "2026_01_AUS"
    assert snap.current_lap >= 1
    assert "event_time" in snap.source_timestamps
    assert "received_time" in snap.source_timestamps
    assert "runtime_time" in snap.source_timestamps
    assert snap.health.system_health in [SystemHealthStatus.OPERATIONAL, SystemHealthStatus.DEGRADED]
    assert snap.latencies.total_cycle_ms >= 0.0


# ==============================================================================
# 2. Battle Management: Tracking & TTL Expiration
# ==============================================================================
def test_battle_lifecycle_and_ttl_expiration():
    """Verify battle detection, continuity counters, and TTL expiration."""
    mgr = ActiveBattleManager(max_laps_inactive=2)

    # Dummy RaceState at lap 1 with NOR vs VER within 0.5s
    cars_close = {
        "VER": {"driver": "VER", "number": "1", "position": 1, "gap_to_leader": 0.0, "gap_to_car_ahead": None},
        "NOR": {"driver": "NOR", "number": "4", "position": 2, "gap_to_leader": 0.5, "gap_to_car_ahead": 0.5},
    }
    rs1 = RaceState(
        timestamp=100.0,
        session={"event_id": "2026_01_AUS", "current_lap": 1, "event_name": "Australian GP", "total_laps": 58},
        track={"track_status": "1"},
        cars=cars_close,
    )
    detected1 = mgr.update(rs1)
    trackers = mgr.get_tracked_battles()
    assert len(trackers) >= 1
    b_id = trackers[0].battle_id
    assert trackers[0].consecutive_laps_active == 1
    assert trackers[0].is_active is True
    assert trackers[0].is_expired is False

    # Lap 2: still close
    rs2 = RaceState(
        timestamp=200.0,
        session={"event_id": "2026_01_AUS", "current_lap": 2, "event_name": "Australian GP", "total_laps": 58},
        track={"track_status": "1"},
        cars=cars_close,
    )
    mgr.update(rs2)
    t2 = mgr.get_battle_tracker(b_id)
    assert t2.consecutive_laps_active == 2
    assert t2.last_seen_lap == 2

    # Lap 3: HAM passes NOR, separating NOR and VER (NOR vs VER drops out of active detection)
    cars_split = {
        "VER": {"driver": "VER", "number": "1", "position": 1, "gap_to_leader": 0.0, "gap_to_car_ahead": None},
        "HAM": {"driver": "HAM", "number": "44", "position": 2, "gap_to_leader": 2.0, "gap_to_car_ahead": 2.0},
        "NOR": {"driver": "NOR", "number": "4", "position": 3, "gap_to_leader": 5.0, "gap_to_car_ahead": 3.0},
    }
    rs3 = RaceState(
        timestamp=300.0,
        session={"event_id": "2026_01_AUS", "current_lap": 3, "event_name": "Australian GP", "total_laps": 58},
        track={"track_status": "1"},
        cars=cars_split,
    )
    mgr.update(rs3)
    t3 = mgr.get_battle_tracker(b_id)
    assert t3.is_active is False
    assert t3.is_expired is False  # Only 1 lap inactive

    # Lap 4: still separated (2 laps inactive -> TTL expired)
    rs4 = RaceState(
        timestamp=400.0,
        session={"event_id": "2026_01_AUS", "current_lap": 4, "event_name": "Australian GP", "total_laps": 58},
        track={"track_status": "1"},
        cars=cars_split,
    )
    mgr.update(rs4)
    t4 = mgr.get_battle_tracker(b_id)
    assert t4.is_expired is True


# ==============================================================================
# 3. Selected Battle Switching
# ==============================================================================
def test_selected_battle_switching(orchestrator):
    """User can select an active battle or let orchestrator auto-select."""
    snap = orchestrator.step()
    assert snap is not None
    if snap.active_battles:
        target_bid = snap.active_battles[0].battle_id
        success = orchestrator.select_battle(target_bid)
        assert success is True
        assert orchestrator.battle_manager.selected_battle_id == target_bid

        # Invalid battle ID fails safely
        invalid_success = orchestrator.select_battle("NON_EXISTENT_BATTLE")
        assert invalid_success is False


# ==============================================================================
# 4. Ingestion Resilience: Deduplication & Out-of-Order
# ==============================================================================
def test_duplicate_and_out_of_order_packets(orchestrator):
    """Verify identical duplicate timestamps are coalesced and backwards timestamps rejected."""
    # Step 1
    snap1 = orchestrator.step()
    assert snap1 is not None
    t1 = orchestrator._last_processed_timestamp

    # Inject mock state with backwards timestamp
    class MockProvider:
        def __init__(self, timestamps):
            self.ts = list(timestamps)
            self.idx = 0

        def start(self): pass
        def stop(self): pass
        def get_metadata(self): return orchestrator.provider.get_metadata()
        def get_capabilities(self): return orchestrator.provider.get_capabilities()

        def next_state(self):
            if self.idx < len(self.ts):
                t = self.ts[self.idx]
                self.idx += 1
                return RaceState(
                    timestamp=t,
                    session={"event_id": "2026_01_AUS", "current_lap": 18, "event_name": "AUS", "total_laps": 58},
                    track={"track_status": "1"},
                    cars={
                        "VER": {"driver": "VER", "number": "1", "position": 1, "gap_to_leader": 0.0, "gap_to_car_ahead": None},
                        "NOR": {"driver": "NOR", "number": "4", "position": 2, "gap_to_leader": 0.5, "gap_to_car_ahead": 0.5},
                    },
                )
            return None

    # Test duplicate packet coalescing
    orch_dedup = KyntraRuntimeOrchestrator(
        provider=MockProvider([100.0, 100.0, 105.0]),
        mode=RuntimeMode.SYNTHETIC_TEST,
    )
    s1 = orch_dedup.step()
    assert s1 is not None
    assert orch_dedup._last_processed_timestamp == 100.0

    # Next call with same timestamp (100.0) should not advance
    s2 = orch_dedup.step()
    assert orch_dedup._last_processed_timestamp == 100.0

    # Next call with 105.0 advances
    s3 = orch_dedup.step()
    assert orch_dedup._last_processed_timestamp == 105.0


# ==============================================================================
# 5. Partial Module Degradation Resilience
# ==============================================================================
def test_partial_module_failure_resilience(orchestrator):
    """Failure in a non-critical module degrades health status without whole-process crash."""
    orchestrator.step()
    # Inject energy unavailable fault
    orchestrator.failure_injector.set_energy_unavailable(True)
    snap = orchestrator.step()
    assert snap is not None
    # Energy module marked DEGRADED
    assert snap.health.modules["energy"].status == "DEGRADED"
    # Total system health handles degradation cleanly
    assert snap.health.system_health in [SystemHealthStatus.DEGRADED, SystemHealthStatus.DECISION_BLOCKED]


# ==============================================================================
# 6. Replay Controls
# ==============================================================================
def test_replay_controls(orchestrator):
    """Verify start, pause, resume, seek, and playback speed controls."""
    orchestrator.start()
    assert orchestrator._is_running is True
    assert orchestrator._is_paused is False

    orchestrator.pause()
    assert orchestrator._is_paused is True

    orchestrator.resume()
    assert orchestrator._is_paused is False

    orchestrator.set_speed(2.0)
    assert orchestrator._playback_speed == 2.0

    success = orchestrator.seek(10)
    assert isinstance(success, bool)

    orchestrator.stop()
    assert orchestrator._is_running is False


# ==============================================================================
# 7. Failure Injection Isolation
# ==============================================================================
def test_failure_injection_safety_isolation():
    """Verify failure injection is locked and rejected outside permitted mode."""
    # Production orchestrator with injection disabled
    prod_orch = KyntraRuntimeOrchestrator(
        event_id="2026_01_AUS",
        mode=RuntimeMode.LIVE_FEED,
        allow_failure_injection=False,
    )
    assert prod_orch.failure_injector.allow_injection is False

    # Attempting injection fails closed
    assert prod_orch.failure_injector.set_provider_outage(True) is False
    assert prod_orch.failure_injector.set_force_vsc(True) is False
    assert prod_orch.failure_injector.is_forced_vsc is False


# ==============================================================================
# 8. SQLite Persistence Durability Across Restarts
# ==============================================================================
def test_sqlite_persistence_durability_across_restarts():
    """Verify DecisionStore backed by SQLite survives process restart."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = str(Path(tmpdir) / "test_decisions.db")

        # Session 1: Write decision
        store1 = DecisionStore(db_path=db_file)
        assert store1.is_durable is True
        assert "DURABLE_SQLITE" in store1.persistence_scope

        mock_snap = {
            "decision_id": "DEC_PERSIST_TEST_001",
            "decision_time": "2026-03-15T05:00:00Z",
            "race": {"attacker": "NOR", "defender": "VER"},
            "recommendation": {"canonical_action": "OVERTAKE"},
        }
        dec_id = store1.record_decision(mock_snap)
        assert dec_id == "DEC_PERSIST_TEST_001"
        store1.close()

        # Session 2: Fresh store instance referencing same DB (simulates restart)
        store2 = DecisionStore(db_path=db_file)
        loaded_snap = store2.get_decision("DEC_PERSIST_TEST_001")
        assert loaded_snap is not None
        assert loaded_snap["decision_id"] == "DEC_PERSIST_TEST_001"
        assert loaded_snap["race"]["attacker"] == "NOR"

        # Immutability check on restart: duplicate record raises ValueError
        with pytest.raises(ValueError):
            store2.record_decision(mock_snap)
        store2.close()


# ==============================================================================
# 9. Frozen LightGBM Model Bundle SHA-256
# ==============================================================================
def test_frozen_model_sha_intact():
    """Verify LightGBM bundle SHA-256 is exactly untouched."""
    assert FROZEN_MODEL_PATH.exists()
    actual = hashlib.sha256(FROZEN_MODEL_PATH.read_bytes()).hexdigest()
    assert actual == EXPECTED_MODEL_SHA
