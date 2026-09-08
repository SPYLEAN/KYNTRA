"""Unit and integration tests for KYNTRA REST API."""

from fastapi.testclient import TestClient
import pytest
from kyntra.api.app import app


@pytest.fixture(scope="module")
def client():
    """Create a FastAPI test client."""
    return TestClient(app)


def test_api_system_status(client):
    """Test /api/system returns operational status and loaded model info."""
    res = client.get("/api/system")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OPERATIONAL"
    assert data["overtake_model"]["loaded"] is True
    assert data["overtake_model"]["model_name"] == "KYNTRA Overtake Intelligence V1"
    assert "gap_seconds" in data["overtake_model"]["features"]
    assert data["energy_simulator"]["provenance"] == "SIMULATED"
    assert "2026_13_ITA" in data["demo_holdouts"]["events"]


def test_frontend_static_serving(client):
    """Test root GET / serves the compiled React frontend application."""
    res = client.get("/")
    assert res.status_code == 200
    assert "<!doctype html>" in res.text.lower()
    assert "KYNTRA" in res.text or "vite" in res.text


def test_api_events_list(client):
    """Test /api/events returns all 4 demo events with Italy as primary."""
    res = client.get("/api/events")
    assert res.status_code == 200
    events = res.json()
    assert len(events) == 4
    event_ids = [e["event_id"] for e in events]
    assert "2026_13_ITA" in event_ids
    assert "2026_01_AUS" in event_ids
    assert "2026_04_MIA" in event_ids
    assert "2026_03_JPN" in event_ids

    # Verify Italy is flagged primary
    italy = next(e for e in events if e["event_id"] == "2026_13_ITA")
    assert italy["is_primary"] is True


def test_api_replay_event_info(client):
    """Test /api/replay/{event_id} returns event summary and drivers."""
    res = client.get("/api/replay/2026_13_ITA")
    assert res.status_code == 200
    data = res.json()
    assert data["event_id"] == "2026_13_ITA"
    assert data["total_laps"] == 53
    assert len(data["drivers"]) >= 3


def test_api_replay_lap_decision_snapshot(client):
    """Test /api/replay/{event_id}/lap/{lap} returns a valid, coherent DecisionSnapshot."""
    res = client.get("/api/replay/2026_13_ITA/lap/15")
    assert res.status_code == 200
    snapshot = res.json()

    # Verify top-level structure
    assert "race" in snapshot
    assert "provenance" in snapshot
    assert "battle" in snapshot
    assert "overtake" in snapshot
    assert "energy" in snapshot
    assert "stability" in snapshot
    assert "compliance" in snapshot
    assert "counterfactuals" in snapshot
    assert "recommendation" in snapshot

    # Verify model inference remains live and calibrated
    overtake = snapshot["overtake"]
    assert overtake["available"] is True
    assert overtake["p_1_lap"] is not None
    assert overtake["p_2_laps"] is not None
    assert overtake["p_3_laps"] is not None
    assert overtake["p_1_lap"] <= overtake["p_2_laps"] <= overtake["p_3_laps"]

    # Verify energy simulated provenance
    assert snapshot["energy"]["simulated"] is True
    assert "SIMULATED" in snapshot["energy"]["provenance"]

    # Verify stability safety hardening (Phase 3.1)
    assert snapshot["stability"]["method"] == "DETERMINISTIC_POST_PASS_STABILITY_V1"
    assert snapshot["stability"]["verdict"] == "UNKNOWN"
    assert snapshot["stability"]["available"] is False
    assert snapshot["stability"]["reason"] == "STABILITY_RULESET_PENDING_VERIFICATION"

    # Verify compliance safety fallback for unconfigured event (Italy)
    assert snapshot["compliance"]["status"] == "UNKNOWN"
    assert len(snapshot["compliance"]["reason_codes"]) >= 1

    # Verify counterfactuals safety hardening (no arbitrary ranking)
    assert len(snapshot["counterfactuals"]) == 4
    actions = [c["action"] for c in snapshot["counterfactuals"]]
    assert set(actions) == {"CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"}
    for cf in snapshot["counterfactuals"]:
        assert cf["available"] is False
        assert cf["rank"] is None
        assert cf["reason"] == "COUNTERFACTUAL_ENGINE_PENDING_VERIFICATION"

    # Verify recommendation safety hardening (no premature advice)
    rec = snapshot["recommendation"]
    assert rec["available"] is False
    assert rec["canonical_action"] is None
    assert rec["ui_label"] is None
    assert rec["reason"] == "STRATEGY_ENGINE_PENDING_VERIFICATION"


def test_api_compliance_neutralized_track_status(client):
    """Test compliance blocks overtaking under neutralized track status (SC/VSC/Yellow)."""
    payload = {
        "event_id": "2026_01_AUS",
        "gap_seconds": 0.8,
        "track_status": "4",  # Safety Car
        "available_energy_mj": 3.0,
    }
    res = client.post("/api/decision", json=payload)
    assert res.status_code == 200
    compliance = res.json()["compliance"]
    assert compliance["status"] == "BLOCKED"
    assert "OVERTAKE" in compliance["blocked_actions"]
    assert "DEPLOY" in compliance["allowed_actions"]
    assert set(compliance["allowed_actions"]) == {"CONSERVE", "BUILD", "DEPLOY"}
    assert res.json()["recommendation"]["available"] is False
    assert res.json()["recommendation"]["reason"] == "TRACK_NEUTRALIZED"


def test_api_compliance_verified_australia_event(client):
    """Test compliance returns LEGAL when event configuration is verified (Australia)."""
    payload = {
        "event_id": "2026_01_AUS",
        "gap_seconds": 0.8,
        "track_status": "1",  # Green flag
        "available_energy_mj": 2.5,
    }
    res = client.post("/api/decision", json=payload)
    assert res.status_code == 200
    compliance = res.json()["compliance"]
    assert compliance["status"] == "LEGAL"
    assert "OVERTAKE" in compliance["allowed_actions"]


def test_api_custom_decision_post(client):
    """Test POST /api/decision computes custom tactical scenario with live model and safety states."""
    payload = {
        "gap_seconds": 0.45,
        "closing_rate": 1.2,
        "recent_pace_delta_1lap": -0.45,
        "recent_pace_delta_3laps": -0.40,
        "speed_trap_delta": 12.0,
        "attacker": "ANT",
        "defender": "VER",
        "event_id": "2026_13_ITA",
        "lap": 22,
        "available_energy_mj": 2.8,
        "track_status": "1",
    }
    res = client.post("/api/decision", json=payload)
    assert res.status_code == 200
    snapshot = res.json()
    assert snapshot["overtake"]["available"] is True
    assert snapshot["overtake"]["p_1_lap"] <= snapshot["overtake"]["p_2_laps"] <= snapshot["overtake"]["p_3_laps"]
    assert snapshot["recommendation"]["available"] is False
    assert snapshot["stability"]["available"] is False
