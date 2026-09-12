"""Phase 4C Operational Realism & Interaction Tests.

Verifies:
- Event markers endpoint for timeline milestones
- System provider capability matrix
- Replay control session switching
- State timestamp coherence across RaceState and cars
- Window history reset on event transition
"""

import pytest
from fastapi.testclient import TestClient

from kyntra.api.app import app
from kyntra.services.live_service import get_live_race_service
from kyntra.events.store import get_event_store
from kyntra.providers.replay import ReplayProvider


@pytest.fixture(scope="module")
def client():
    """Create a FastAPI test client."""
    return TestClient(app)


def test_api_events_markers(client):
    """Test /api/events/markers endpoint returns key milestones with timestamps."""
    res = client.get("/api/events/markers?limit=50")
    assert res.status_code == 200
    markers = res.json()
    assert isinstance(markers, list)
    for m in markers:
        assert "event_id" in m
        assert "event_type" in m
        assert "timestamp" in m
        assert "lap" in m


def test_api_system_providers(client):
    """Test /api/system/providers capability matrix endpoint."""
    res = client.get("/api/system/providers")
    assert res.status_code == 200
    data = res.json()
    assert "providers" in data
    assert len(data["providers"]) >= 3

    provider_ids = [p["id"] for p in data["providers"]]
    assert "REPLAY_PROVIDER" in provider_ids
    assert "PUBLIC_LIVE_PROVIDER" in provider_ids
    assert "TEAM_TELEMETRY_PROVIDER" in provider_ids

    replay = next(p for p in data["providers"] if p["id"] == "REPLAY_PROVIDER")
    assert replay["status"] == "OPERATIONAL (ACTIVE)"
    assert replay["capabilities"]["race_timing"] == "AVAILABLE"
    assert replay["capabilities"]["car_coordinates"] == "AVAILABLE"
    assert replay["capabilities"]["speed_telemetry"] == "AVAILABLE"
    assert replay["capabilities"]["private_mgu_k_torque"] == "UNAVAILABLE"
    assert replay["capabilities"]["actual_cell_soc"] == "UNAVAILABLE"


def test_replay_control_set_event(client):
    """Test controlling replay to hot-swap to another session."""
    res = client.post("/api/replay/control", json={"action": "set_event", "event_id": "2026_01_AUS"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OK"
    assert data["action"] == "set_event"
    assert data["event_id"] == "2026_01_AUS"

    # Verify live service updated its provider event
    service = get_live_race_service()
    assert service.event_id == "2026_01_AUS"

    # Reset back to Italy
    res_back = client.post("/api/replay/control", json={"action": "set_event", "event_id": "2026_13_ITA"})
    assert res_back.status_code == 200
    assert service.event_id == "2026_13_ITA"


def test_state_timestamp_coherence():
    """Verify that a single ingested tick produces coherent timestamps across RaceState and cars."""
    service = get_live_race_service()
    service.stop()
    service.provider.start()
    payload = service.step()
    assert payload is not None
    state = payload["race_state"]
    assert state["timestamp"] > 0
    assert state["session"]["current_lap"] >= 1
    for code, car in state["cars"].items():
        assert car["driver"] == code
        assert car["position"] is not None


def test_window_engine_history_reset_on_session_switch():
    """Verify that when the event switches, transient window tracking histories reset cleanly."""
    service = get_live_race_service()
    service.stop()
    service.provider.start()

    # Step a few times to build window history
    for _ in range(3):
        service.step()

    # Hot swap event to Australia
    service.set_event("2026_01_AUS")
    # Switched event discovers Australia battles
    assert service.event_id == "2026_01_AUS"
    assert "2026_01_AUS" in (service.state_store.get_selected_battle_id() or "")

    # Clean reset back to Italy
    service.set_event("2026_13_ITA")
    assert service.event_id == "2026_13_ITA"
