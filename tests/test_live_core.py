"""KYNTRA Phase 4A Live Race Intelligence Core Test Suite.

Verifies:
1. Provider abstraction lifecycle (Replay, PublicLive, Team)
2. State timestamp coherence across field
3. Persistent EventStore append and deduplication
4. Automated BattleDetector discovery on adjacent positions
5. BattleWatchlist transparent ordinal priority ranking
6. Rolling WindowEngine trajectory tracking (FORMING, PEAKING, FADING)
7. Digital Track Twin vector geometry and coordinate interpolation
8. Live REST and WebSocket streaming endpoints
"""

import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from kyntra.api.app import app
from kyntra.battles.detector import BattleDetector
from kyntra.battles.watchlist import BattleWatchlistEngine
from kyntra.events.store import EventStore
from kyntra.processing.circuit_twin import get_circuit_geometry, interpolate_car_position
from kyntra.providers.public_live import PublicLiveProvider
from kyntra.providers.replay import ReplayProvider
from kyntra.providers.team import TeamTelemetryProvider
from kyntra.schemas import CarState, RaceEvent, RaceState, SessionState, TrackState
from kyntra.services.live_service import LiveRaceService
from kyntra.windows.engine import WindowEngine


@pytest.fixture
def client():
    return TestClient(app)


def test_provider_abstraction_contracts():
    """Verify BaseDataProvider contract implementations across Replay, PublicLive, and Team."""
    replay = ReplayProvider(event_id="2026_13_ITA")
    assert replay.get_capabilities().can_seek is True
    assert replay.get_capabilities().can_pause is True
    assert replay.get_capabilities().is_live is False
    assert "2026_13_ITA" in replay.get_metadata().details["event_id"]

    public = PublicLiveProvider()
    assert public.get_capabilities().is_live is True
    assert public.get_capabilities().can_seek is False
    assert public.next_state() is None  # Standby mode: no fake data

    team = TeamTelemetryProvider(team_id="MCL")
    assert team.get_capabilities().is_live is True
    assert team.get_capabilities().max_frequency_hz == 100.0
    assert team.next_state() is None  # Standby mode: no fake data


def test_replay_provider_state_coherence():
    """Verify ReplayProvider emits valid RaceState with coherent timestamp and no fake zeros."""
    provider = ReplayProvider(event_id="2026_13_ITA")
    provider.start()

    state = provider.next_state()
    assert isinstance(state, RaceState)
    assert state.session.event_id == "2026_13_ITA"
    assert state.session.current_lap == 1
    assert state.session.data_mode == "HISTORICAL_REPLAY"
    assert state.timestamp > 0

    # Verify cars in field
    assert len(state.cars) >= 2
    for code, car in state.cars.items():
        assert car.driver == code
        assert car.position is not None
        # P1 has None for gap_to_car_ahead, not 0.0 fake gap
        if car.position == 1:
            assert car.gap_to_car_ahead is None

    # Test seek functionality
    assert provider.seek(15) is True
    state_l15 = provider.next_state()
    assert state_l15.session.current_lap == 15
    provider.stop()


def test_event_store_append_and_query():
    """Verify EventStore appends events and supports persistent queries."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = Path(tmp_dir) / "test_memory.db"
        store = EventStore(db_path=db_path)

        ev1 = RaceEvent(
            event_id="ev_001",
            timestamp=100.5,
            race_id="2026_13_ITA",
            lap=2,
            sector=1,
            event_type="LAP_CHANGED",
            cars=["VER", "ANT"],
            battle_id=None,
            derived_data={"lap": 2},
            source="TEST",
            provenance="PROVENANCE_VERIFIED",
        )
        ev2 = RaceEvent(
            event_id="ev_002",
            timestamp=110.0,
            race_id="2026_13_ITA",
            lap=2,
            sector=2,
            event_type="BATTLE_FORMED",
            cars=["ANT", "VER"],
            battle_id="2026_13_ITA_ANT_VER",
            derived_data={"gap": 0.55},
            source="TEST",
            provenance="PROVENANCE_VERIFIED",
        )

        store.append_event(ev1)
        store.append_event(ev2)

        # Query all
        all_events = store.get_events(race_id="2026_13_ITA")
        assert len(all_events) == 2
        # Most recent first
        assert all_events[0].event_id == "ev_002"

        # Query by type
        lap_events = store.get_events(event_type="LAP_CHANGED")
        assert len(lap_events) == 1
        assert lap_events[0].event_id == "ev_001"


def test_battle_detector_adjacent_discovery():
    """Verify BattleDetector automatically discovers adjacent battles without manual selection."""
    detector = BattleDetector()

    cars = {
        "VER": CarState(driver="VER", number="1", position=1, speed=330.0, gap_to_car_ahead=None),
        "ANT": CarState(driver="ANT", number="12", position=2, speed=338.0, gap_to_car_ahead=0.45),
        "RUS": CarState(driver="RUS", number="63", position=3, speed=332.0, gap_to_car_ahead=1.80),
        "LEC": CarState(driver="LEC", number="16", position=4, speed=325.0, gap_to_car_ahead=4.50),  # > 2.5s -> filtered
    }

    state = RaceState(
        session=SessionState(event_id="2026_13_ITA", event_name="Italian GP", current_lap=10, total_laps=53),
        track=TrackState(track_status="1"),
        cars=cars,
        timestamp=800.0,
    )

    battles = detector.detect_battles(state)

    # Should discover P2 vs P1 (ANT vs VER) and P3 vs P2 (RUS vs ANT), but NOT LEC (> 2.5s)
    assert "2026_13_ITA_ANT_VER" in battles
    assert "2026_13_ITA_RUS_ANT" in battles
    assert len(battles) == 2

    b_lead = battles["2026_13_ITA_ANT_VER"]
    assert b_lead.attacker == "ANT"
    assert b_lead.defender == "VER"
    assert b_lead.gap_seconds == 0.45
    assert b_lead.speed_delta == 8.0  # 338 - 330
    assert pytest.approx(b_lead.closing_rate, rel=1e-2) == 2.22  # 8 / 3.6


def test_battle_watchlist_transparent_ordinal_priority():
    """Verify BattleWatchlist sorts battles into transparent ordinal states."""
    watchlist_engine = BattleWatchlistEngine()
    detector = BattleDetector()

    cars = {
        "VER": CarState(driver="VER", number="1", position=1, speed=330.0, gap_to_car_ahead=None),
        "ANT": CarState(driver="ANT", number="12", position=2, speed=335.0, gap_to_car_ahead=0.50),  # CRITICAL
        "RUS": CarState(driver="RUS", number="63", position=3, speed=331.0, gap_to_car_ahead=1.50),  # FORMING
    }
    state = RaceState(
        session=SessionState(event_id="2026_13_ITA", event_name="Italian GP", current_lap=5, total_laps=53),
        track=TrackState(track_status="1"),
        cars=cars,
        timestamp=400.0,
    )

    battles = detector.detect_battles(state)
    watchlist = watchlist_engine.build_watchlist(battles=battles, track_state=state.track)

    assert len(watchlist) == 2
    assert watchlist[0].priority_state == "CRITICAL"
    assert watchlist[0].attacker == "ANT"
    assert watchlist[1].priority_state == "FORMING"
    assert watchlist[1].attacker == "RUS"


def test_rolling_window_engine_trajectories():
    """Verify WindowEngine qualitative trend trajectory classification."""
    engine = WindowEngine()

    # Step 1: single point -> UNKNOWN
    w1 = engine.update_battle_probability("B1", timestamp=10.0, p1=0.20, p2=0.35, p3=0.45)
    assert w1.window_state == "UNKNOWN"

    # Step 2: increasing probability -> FORMING
    w2 = engine.update_battle_probability("B1", timestamp=15.0, p1=0.28, p2=0.45, p3=0.55)
    assert w2.trend_direction == "INCREASING"
    assert w2.window_state == "FORMING"

    # Step 3: further increase -> FORMING
    w3 = engine.update_battle_probability("B1", timestamp=20.0, p1=0.36, p2=0.52, p3=0.62)
    assert w3.window_state == "FORMING"
    assert w3.peak_observed_probability == 0.36

    # Step 4: plateau near peak -> PEAKING
    w4 = engine.update_battle_probability("B1", timestamp=25.0, p1=0.355, p2=0.51, p3=0.61)
    assert w4.window_state == "PEAKING"

    # Step 5: noticeable decline -> FADING
    w5 = engine.update_battle_probability("B1", timestamp=30.0, p1=0.22, p2=0.35, p3=0.45)
    assert w5.trend_direction == "DECREASING"
    assert w5.window_state == "FADING"
    # Peak observed remains historical maximum
    assert w5.peak_observed_probability == 0.36
    assert w5.peak_observed_time == 20.0


def test_digital_track_twin_geometry():
    """Verify 2D vector circuit geometry extraction and progress interpolation."""
    geo = get_circuit_geometry("2026_13_ITA")
    assert geo["event_id"] == "2026_13_ITA"
    assert "M " in geo["path_d"]
    assert len(geo["points"]) >= 40

    # Interpolate start/finish line (progress 0.0)
    x0, y0 = interpolate_car_position(0.0, "2026_13_ITA")
    assert isinstance(x0, float)
    assert isinstance(y0, float)

    # Interpolate mid-lap (progress 0.5)
    x50, y50 = interpolate_car_position(0.5, "2026_13_ITA")
    assert (x50, y50) != (x0, y0)


def test_live_service_step_and_timestamp_coherence():
    """Verify LiveRaceService produces synchronized RaceState, decisions, and watchlist."""
    service = LiveRaceService(event_id="2026_13_ITA")
    service.provider.start()

    payload = service.step()
    assert payload is not None
    assert payload["type"] == "live_update"
    assert "race_state" in payload
    assert "decision" in payload
    assert "watchlist" in payload
    assert "active_windows" in payload

    # Coherence check: timestamp in race_state matches payload and decision
    t_race = payload["race_state"]["timestamp"]
    t_payload = payload["timestamp"]
    assert t_race == t_payload
    if payload["decision"]:
        assert payload["decision"]["race"]["lap"] == payload["race_state"]["session"]["current_lap"]

    service.stop()


def test_live_rest_api_endpoints(client):
    """Verify REST endpoints for live state, battles, events, and replay control."""
    # 1. Live State
    res_state = client.get("/api/live/state")
    assert res_state.status_code == 200
    data_state = res_state.json()
    assert "session" in data_state
    assert "cars" in data_state

    # 2. Live Battles
    res_battles = client.get("/api/live/battles")
    assert res_battles.status_code == 200
    assert isinstance(res_battles.json(), list)

    # 3. Live Decision
    res_dec = client.get("/api/live/decision")
    assert res_dec.status_code == 200
    data_dec = res_dec.json()
    assert "overtake" in data_dec
    assert "compliance" in data_dec

    # 4. Track Geometry
    res_track = client.get("/api/track/2026_13_ITA")
    assert res_track.status_code == 200
    assert "path_d" in res_track.json()

    # 5. Events History
    res_ev = client.get("/api/events/history?limit=10")
    assert res_ev.status_code == 200
    assert isinstance(res_ev.json(), list)

    # 6. Replay Control
    res_ctrl = client.post("/api/replay/control", json={"action": "pause"})
    assert res_ctrl.status_code == 200
    assert res_ctrl.json()["status"] == "OK"


def test_deterministic_event_store_identity_and_deduplication():
    """Verify deterministic event ID generation and strict deduplication requirements."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = Path(tmp_dir) / "test_dedup.db"
        store = EventStore(db_path=db_path)

        # 1. Two POSITION_CHANGED events on the same lap with different cars
        ev_pos_sai = RaceEvent(
            event_id=RaceEvent.build_deterministic_id(
                race_id="2026_13_ITA",
                lap=14,
                event_type="POSITION_CHANGED",
                timestamp=1250.4,
                cars=["SAI"],
                discriminator="P4_to_P3",
            ),
            timestamp=1250.4,
            race_id="2026_13_ITA",
            lap=14,
            sector=2,
            event_type="POSITION_CHANGED",
            cars=["SAI"],
            derived_data={"driver": "SAI", "from": 4, "to": 3},
            source="TIMING_FEED",
        )
        ev_pos_nor = RaceEvent(
            event_id=RaceEvent.build_deterministic_id(
                race_id="2026_13_ITA",
                lap=14,
                event_type="POSITION_CHANGED",
                timestamp=1251.2,
                cars=["NOR"],
                discriminator="P2_to_P1",
            ),
            timestamp=1251.2,
            race_id="2026_13_ITA",
            lap=14,
            sector=3,
            event_type="POSITION_CHANGED",
            cars=["NOR"],
            derived_data={"driver": "NOR", "from": 2, "to": 1},
            source="TIMING_FEED",
        )

        assert ev_pos_sai.event_id != ev_pos_nor.event_id
        store.append_event(ev_pos_sai)
        store.append_event(ev_pos_nor)

        events = store.get_events(race_id="2026_13_ITA", event_type="POSITION_CHANGED")
        assert len(events) == 2  # Distinct same-type events on same lap do NOT collapse!

        # 2. Two BATTLE_FORMED events on the same lap with different cars
        ev_b1 = RaceEvent(
            event_id=RaceEvent.build_deterministic_id(
                race_id="2026_13_ITA",
                lap=14,
                event_type="BATTLE_FORMED",
                timestamp=1255.0,
                cars=["NOR", "VER"],
                battle_id="2026_13_ITA_NOR_VER",
            ),
            timestamp=1255.0,
            race_id="2026_13_ITA",
            lap=14,
            event_type="BATTLE_FORMED",
            cars=["NOR", "VER"],
            battle_id="2026_13_ITA_NOR_VER",
            source="BATTLE_DETECTOR",
        )
        ev_b2 = RaceEvent(
            event_id=RaceEvent.build_deterministic_id(
                race_id="2026_13_ITA",
                lap=14,
                event_type="BATTLE_FORMED",
                timestamp=1256.5,
                cars=["HAM", "LEC"],
                battle_id="2026_13_ITA_HAM_LEC",
            ),
            timestamp=1256.5,
            race_id="2026_13_ITA",
            lap=14,
            event_type="BATTLE_FORMED",
            cars=["HAM", "LEC"],
            battle_id="2026_13_ITA_HAM_LEC",
            source="BATTLE_DETECTOR",
        )

        assert ev_b1.event_id != ev_b2.event_id
        store.append_event(ev_b1)
        store.append_event(ev_b2)

        battles = store.get_events(race_id="2026_13_ITA", event_type="BATTLE_FORMED")
        assert len(battles) == 2  # Both battle formed events stored!

        # 3. Re-reading exact identical event
        count_before = len(store.get_events(race_id="2026_13_ITA"))
        store.append_event(ev_b1)  # Duplicate insert of ev_b1
        count_after = len(store.get_events(race_id="2026_13_ITA"))
        assert count_before == count_after  # Exactly deduplicated via SQLite primary key!


def test_event_store_seek_backwards_and_replay_forward():
    """Verify that seeking backwards and replaying forward does not fabricate duplicate history."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = Path(tmp_dir) / "test_seek.db"
        store = EventStore(db_path=db_path)

        # Replay lap 10 to 11
        for lap in (10, 11):
            t_stamp = 1000.0 + lap * 90.0
            ev = RaceEvent(
                event_id=RaceEvent.build_deterministic_id(
                    race_id="2026_13_ITA",
                    lap=lap,
                    event_type="LAP_CHANGED",
                    timestamp=t_stamp,
                    source="LIVE_SERVICE",
                ),
                timestamp=t_stamp,
                race_id="2026_13_ITA",
                lap=lap,
                event_type="LAP_CHANGED",
                source="LIVE_SERVICE",
            )
            store.append_event(ev)

        initial_events = store.get_events(race_id="2026_13_ITA")
        assert len(initial_events) == 2

        # Simulate seek backwards to lap 10 and re-streaming through lap 11
        for lap in (10, 11):
            t_stamp = 1000.0 + lap * 90.0
            ev_replayed = RaceEvent(
                event_id=RaceEvent.build_deterministic_id(
                    race_id="2026_13_ITA",
                    lap=lap,
                    event_type="LAP_CHANGED",
                    timestamp=t_stamp,
                    source="LIVE_SERVICE",
                ),
                timestamp=t_stamp,
                race_id="2026_13_ITA",
                lap=lap,
                event_type="LAP_CHANGED",
                source="LIVE_SERVICE",
            )
            store.append_event(ev_replayed)

        replayed_events = store.get_events(race_id="2026_13_ITA")
        assert len(replayed_events) == 2  # Zero duplicate events created!


def test_battle_lifecycle_termination_heuristics():
    """Verify externalized battle termination heuristics (gap > 3.5s for 3 consecutive ticks)."""
    detector = BattleDetector()
    assert detector.proximity_threshold_s == 2.5
    assert detector.termination_gap_s == 3.5
    assert detector.termination_consecutive_ticks == 3

    # State 1: Discovery (gap = 1.2s <= 2.5s)
    s1 = RaceState(
        session=SessionState(event_id="2026_13_ITA", event_name="Italian GP", current_lap=5, total_laps=53),
        track=TrackState(track_status="1"),
        cars={
            "VER": CarState(driver="VER", number="1", position=1, speed=330.0),
            "NOR": CarState(driver="NOR", number="4", position=2, speed=332.0, gap_to_car_ahead=1.2),
        },
        timestamp=100.0,
    )
    b1 = detector.detect_battles(s1)
    assert "2026_13_ITA_NOR_VER" in b1

    # State 2: Gap opens to 3.0s (exceeds 2.5s entry, but <= 3.5s termination threshold)
    s2 = RaceState(
        session=SessionState(event_id="2026_13_ITA", event_name="Italian GP", current_lap=5, total_laps=53),
        track=TrackState(track_status="1"),
        cars={
            "VER": CarState(driver="VER", number="1", position=1, speed=330.0),
            "NOR": CarState(driver="NOR", number="4", position=2, speed=332.0, gap_to_car_ahead=3.0),
        },
        timestamp=101.0,
    )
    b2 = detector.detect_battles(s2)
    assert "2026_13_ITA_NOR_VER" in b2  # Persists as active!

    # State 3: Gap opens to 3.8s (> 3.5s) -> Tick 1 above threshold
    s3 = RaceState(
        session=SessionState(event_id="2026_13_ITA", event_name="Italian GP", current_lap=5, total_laps=53),
        track=TrackState(track_status="1"),
        cars={
            "VER": CarState(driver="VER", number="1", position=1, speed=330.0),
            "NOR": CarState(driver="NOR", number="4", position=2, speed=332.0, gap_to_car_ahead=3.8),
        },
        timestamp=102.0,
    )
    b3 = detector.detect_battles(s3)
    assert "2026_13_ITA_NOR_VER" in b3  # Tick 1: still active

    # State 4: Tick 2 above threshold
    s4 = RaceState(
        session=SessionState(event_id="2026_13_ITA", event_name="Italian GP", current_lap=5, total_laps=53),
        track=TrackState(track_status="1"),
        cars={
            "VER": CarState(driver="VER", number="1", position=1, speed=330.0),
            "NOR": CarState(driver="NOR", number="4", position=2, speed=332.0, gap_to_car_ahead=4.0),
        },
        timestamp=103.0,
    )
    b4 = detector.detect_battles(s4)
    assert "2026_13_ITA_NOR_VER" in b4  # Tick 2: still active

    # State 5: Tick 3 above threshold -> Battle formally terminates
    s5 = RaceState(
        session=SessionState(event_id="2026_13_ITA", event_name="Italian GP", current_lap=5, total_laps=53),
        track=TrackState(track_status="1"),
        cars={
            "VER": CarState(driver="VER", number="1", position=1, speed=330.0),
            "NOR": CarState(driver="NOR", number="4", position=2, speed=332.0, gap_to_car_ahead=4.2),
        },
        timestamp=104.0,
    )
    b5 = detector.detect_battles(s5)
    assert "2026_13_ITA_NOR_VER" not in b5  # Terminated on 3rd consecutive tick!


def test_window_engine_relative_trajectory_no_absolute_p1_threshold():
    """Verify WindowEngine classifies relative trajectories without arbitrary P1 >= 0.65 threshold."""
    engine = WindowEngine()
    assert engine.noise_tolerance == 0.008
    assert engine.near_peak_tolerance == 0.020

    # Low probability range (e.g. around 0.20-0.28, far below old 0.65 threshold)
    engine.update_battle_probability("B_LOW", timestamp=1.0, p1=0.15, p2=0.25, p3=0.35)
    engine.update_battle_probability("B_LOW", timestamp=2.0, p1=0.22, p2=0.30, p3=0.40)
    w_peak = engine.update_battle_probability("B_LOW", timestamp=3.0, p1=0.218, p2=0.30, p3=0.40)

    # Rose from 0.15 to 0.22, then momentum flattened at 0.218 (near local max 0.22)
    assert w_peak.window_state == "PEAKING"
    assert w_peak.peak_observed_probability == 0.22

    # Verify STABLE when trajectory has no directional dominance
    engine.clear()
    engine.update_battle_probability("B_STABLE", timestamp=1.0, p1=0.300, p2=0.40, p3=0.50)
    w_stable = engine.update_battle_probability("B_STABLE", timestamp=2.0, p1=0.302, p2=0.40, p3=0.50)
    assert w_stable.window_state == "STABLE"
