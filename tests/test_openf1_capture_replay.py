"""Integration tests for OpenF1 live ingestion, normalization, capture, and replay.

Verifies:
1. Ingest OpenF1 messages across all candidate channels.
2. Normalize records into coherent RaceState domain model without fake defaults.
3. Persist normalized stream via SessionCaptureWriter.
4. Reload captured session via SessionCaptureReader and deterministic ReplayProvider.
5. Verify ordering, domain values, car counts (full grid derivation), and provenance.
6. Verify strict missing-feature model inference truth gate.
"""

import os
import shutil
import tempfile
import time
from pathlib import Path
import pytest

from kyntra.decision.engine import compute_decision
from kyntra.ingestion.capture import (
    SessionCaptureHeader,
    SessionCaptureReader,
    SessionCaptureWriter,
    list_captured_sessions,
)
from kyntra.ingestion.discovery import discover_openf1_session
from kyntra.models.registry import get_overtake_model
from kyntra.providers.openf1_live import OpenF1LiveProvider
from kyntra.providers.replay import ReplayProvider
from kyntra.schemas import RaceState


@pytest.fixture
def temp_capture_dir():
    """Create a temporary directory for session capture files."""
    tmp = tempfile.mkdtemp()
    yield Path(tmp)
    shutil.rmtree(tmp, ignore_errors=True)


def test_openf1_live_ingest_and_normalization():
    """Test OpenF1LiveProvider normalizes multi-channel records into truthful RaceState."""
    provider = OpenF1LiveProvider(
        session_key=9621,
        meeting_key=1244,
        event_query="Spain",
        year=2026,
    )
    provider.start()

    # Simulate OpenF1 drivers channel (3 cars)
    driver_records = [
        {"driver_number": 1, "name_acronym": "VER", "broadcast_name": "M VERSTAPPEN", "team_name": "Red Bull Racing", "team_colour": "3671C6"},
        {"driver_number": 4, "name_acronym": "NOR", "broadcast_name": "L NORRIS", "team_name": "McLaren", "team_colour": "FF8000"},
        {"driver_number": 44, "name_acronym": "HAM", "broadcast_name": "L HAMILTON", "team_name": "Ferrari", "team_colour": "E80020"},
    ]
    provider.ingest_records("drivers", driver_records)

    # Simulate position channel
    position_records = [
        {"driver_number": 1, "position": 1},
        {"driver_number": 4, "position": 2},
        {"driver_number": 44, "position": 3},
    ]
    provider.ingest_records("position", position_records)

    # Simulate intervals channel
    interval_records = [
        {"driver_number": 1, "gap_to_leader": 0.0, "interval": None},
        {"driver_number": 4, "gap_to_leader": 0.82, "interval": 0.82},
        {"driver_number": 44, "gap_to_leader": 2.45, "interval": 1.63},
    ]
    provider.ingest_records("intervals", interval_records)

    # Simulate car_data telemetry channel
    car_data_records = [
        {"driver_number": 1, "speed": 312.4, "rpm": 11800, "n_gear": 7, "throttle": 100, "brake": 0, "drs": 12},
        {"driver_number": 4, "speed": 318.1, "rpm": 11950, "n_gear": 7, "throttle": 100, "brake": 0, "drs": 14},
        {"driver_number": 44, "speed": 305.2, "rpm": 11500, "n_gear": 7, "throttle": 98, "brake": 0, "drs": 0},
    ]
    provider.ingest_records("car_data", car_data_records)

    # Simulate location channel
    loc_records = [
        {"driver_number": 1, "x": 1200.5, "y": 450.2},
        {"driver_number": 4, "x": 1180.2, "y": 445.8},
        {"driver_number": 44, "x": 1130.0, "y": 430.1},
    ]
    provider.ingest_records("location", loc_records)

    # Simulate race control channel (track clear)
    rc_records = [{"flag": "CLEAR", "message": "TRACK CLEAR", "category": "Flag"}]
    provider.ingest_records("race_control", rc_records)

    # Emit normalized RaceState
    state = provider.next_state()
    assert state is not None
    assert isinstance(state, RaceState)

    # Check session provenance
    assert state.session.source_mode == "LIVE_FEED"
    assert state.session.provider == "OPENF1_LIVE"
    assert state.session.data_mode == "LIVE_FEED"
    assert state.session.data_age is not None
    assert state.session.data_age >= 0.0

    # Check dynamic car count: exactly 3 cars, never hardcoded 20
    assert len(state.cars) == 3
    assert set(state.cars.keys()) == {"VER", "NOR", "HAM"}

    # Check car state values
    nor = state.cars["NOR"]
    assert nor.position == 2
    assert nor.gap_to_car_ahead == 0.82
    assert nor.gap_to_leader == 0.82
    assert nor.speed == 318.1
    assert nor.drs_active is True
    assert nor.x == 1180.2

    provider.stop()


def test_openf1_full_grid_derivation():
    """Verify field count strictly mirrors provider output (e.g. 20 cars when 20 supplied)."""
    provider = OpenF1LiveProvider(session_key=1001)
    provider.start()

    # Ingest 20 distinct driver records
    twenty_drivers = [
        {"driver_number": i, "name_acronym": f"D{i:02d}", "team_name": f"Team {i % 10}"}
        for i in range(1, 21)
    ]
    twenty_positions = [{"driver_number": i, "position": i} for i in range(1, 21)]

    provider.ingest_records("drivers", twenty_drivers)
    provider.ingest_records("position", twenty_positions)

    state = provider.next_state()
    assert state is not None
    assert len(state.cars) == 20
    assert provider.get_metadata().details["active_cars"] == 20

    provider.stop()


def test_session_capture_and_replay_cycle(temp_capture_dir):
    """Verify live stream capture to JSONL and subsequent offline replay preserves ordering and values."""
    capture_file = temp_capture_dir / "madrid_2026_test_capture.jsonl"
    header = SessionCaptureHeader(
        session_id="test_madrid_fp1",
        event_id="2026_14_ESP",
        event_name="Spanish Grand Prix",
        circuit="Circuito de Madring, Madrid",
        session_type="PRACTICE",
        source_provider="OPENF1_LIVE",
        source_mode="CAPTURED_LIVE",
        meeting_key=1244,
        session_key=9621,
        total_laps=53,
        driver_count=2,
    )

    # 1. Ingest and write 5 sequential captured frames
    live_prov = OpenF1LiveProvider(session_key=9621, meeting_key=1244)
    live_prov.start()

    # Two drivers: VER and NOR
    live_prov.ingest_records("drivers", [
        {"driver_number": 1, "name_acronym": "VER", "team_name": "Red Bull"},
        {"driver_number": 4, "name_acronym": "NOR", "team_name": "McLaren"},
    ])

    recorded_timestamps = []
    with SessionCaptureWriter(capture_file, header) as writer:
        for tick in range(5):
            # Vary gap and speed across ticks
            gap = round(0.95 - (tick * 0.12), 2)
            live_prov.ingest_records("position", [{"driver_number": 1, "position": 1}, {"driver_number": 4, "position": 2}])
            live_prov.ingest_records("intervals", [{"driver_number": 1, "gap_to_leader": 0.0}, {"driver_number": 4, "interval": gap, "gap_to_leader": gap}])
            live_prov.ingest_records("car_data", [
                {"driver_number": 1, "speed": 310.0 + tick},
                {"driver_number": 4, "speed": 315.0 + tick * 2},
            ])
            live_prov.ingest_records("laps", [
                {"driver_number": 1, "lap_number": 1 if tick < 3 else 2},
                {"driver_number": 4, "lap_number": 1 if tick < 3 else 2},
            ])

            state = live_prov.next_state()
            assert state is not None
            frame = writer.append_frame(state)
            recorded_timestamps.append(frame.timestamp)
            time.sleep(0.01)

    live_prov.stop()

    # 2. Inspect with SessionCaptureReader
    reader = SessionCaptureReader(capture_file)
    assert reader.header is not None
    assert reader.header.session_id == "test_madrid_fp1"
    assert reader.total_frames == 5
    assert len(reader.get_laps()) >= 1

    # Verify monotonic timestamp ordering
    frames = reader.get_frames()
    timestamps = [f.timestamp for f in frames]
    assert timestamps == sorted(timestamps)
    assert frames[0].race_state.cars["NOR"].gap_to_car_ahead == 0.95
    assert frames[4].race_state.cars["NOR"].gap_to_car_ahead == round(0.95 - (4 * 0.12), 2)

    # 3. Offline Replay via ReplayProvider
    replay_prov = ReplayProvider(capture_path=capture_file)
    replay_prov.start()

    meta = replay_prov.get_metadata()
    assert meta.provider_type == "REPLAY"
    assert meta.source_mode == "CAPTURED_LIVE"
    assert "CAPTURED_LIVE" in meta.provenance

    # Step through replayed frames
    replayed_states = []
    for _ in range(5):
        st = replay_prov.next_state()
        assert st is not None
        assert st.session.source_mode == "CAPTURED_LIVE"
        replayed_states.append(st)

    assert len(replayed_states) == 5
    assert replayed_states[0].cars["NOR"].gap_to_car_ahead == 0.95
    assert replayed_states[4].cars["NOR"].gap_to_car_ahead == round(0.95 - (4 * 0.12), 2)

    # Test seeking
    assert replay_prov.seek(1) is True
    st_seek = replay_prov.next_state()
    assert st_seek is not None
    assert st_seek.session.current_lap == 1

    replay_prov.stop()


def test_model_missing_feature_truth_gate():
    """Verify frozen LightGBM inference truth gate: outputs available=False when features are missing."""
    # Complete 5 features -> inference available
    complete_battle = {
        "gap_seconds": 0.45,
        "closing_rate": 1.2,
        "recent_pace_delta_1lap": -0.35,
        "recent_pace_delta_3laps": -0.30,
        "speed_trap_delta": 8.5,
    }
    race_info = {"event_id": "2026_14_ESP", "attacker": "NOR", "defender": "VER", "lap": 18, "track_status": "1"}

    dec_complete = compute_decision(race_data=race_info, battle_data=complete_battle)
    assert dec_complete.overtake.available is True
    assert dec_complete.overtake.p_1_lap is not None
    assert dec_complete.overtake.p_1_lap <= dec_complete.overtake.p_2_laps <= dec_complete.overtake.p_3_laps

    # Missing speed_trap_delta -> inference UNAVAILABLE, no fake substitutes
    incomplete_battle = {
        "gap_seconds": 0.45,
        "closing_rate": 1.2,
        "recent_pace_delta_1lap": -0.35,
        "recent_pace_delta_3laps": -0.30,
        "speed_trap_delta": None,  # Missing!
    }
    dec_incomplete = compute_decision(race_data=race_info, battle_data=incomplete_battle)
    assert dec_incomplete.overtake.available is False
    assert dec_incomplete.overtake.p_1_lap is None
    assert "speed_trap_delta" in dec_incomplete.overtake.feature_missingness


def test_madrid_2026_dynamic_discovery():
    """Verify Madrid 2026 dynamic discovery resolves meeting and session without hardcoded static keys."""
    disc = discover_openf1_session(query="Spain", year=2026, session_name="Practice 1")
    assert disc["status"] == "DISCOVERED"
    assert "Spain" in disc["country"] or "Spanish" in disc["meeting_name"]
    assert disc["session_key"] is not None
    assert disc["meeting_key"] is not None
    assert disc["total_laps"] >= 50
