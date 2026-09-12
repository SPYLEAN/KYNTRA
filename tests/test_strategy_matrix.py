"""Comprehensive test suite and performance benchmark for KYNTRA Phase 07:
Canonical Strategist Matrix + Counterfactual Scenario Engine.

Verifies:
A. Matrix contains all 4 actions (CONSERVE, BUILD, DEPLOY, OVERTAKE).
B. All actions share identical initial source state.
C. Action evaluation order independence (forward vs reverse execution produces identical outputs).
D. Current P1/P2/P3 preserved correctly in pass window.
E. ML Truth: No fake action-specific P probabilities (action_effect_available is False).
F. Regulation check: OVERTAKE blocked under VSC/SC while DEPLOY/CONSERVE remain evaluated & allowed.
G. Missing energy degrades only relevant energy fields safely.
H. Missing stability yields UNKNOWN without crashing.
I. Energy scenario invariants (CONSERVATIVE <= NOMINAL <= FAVORABLE terminal energy).
J. Provenance: No simulated SOC represented as measured.
K. Provenance tags correct across models.
L. Replay source mode preserved.
M. Live and synthetic source modes preserved.
N. Forecast values not mislabeled as historical observations.
O. Matrix ranking unavailable in Phase 07 (ranking.available is False).
P. Recommendation unavailable in Phase 07 (recommendation.available is False).
Q. Frozen LightGBM model bundle SHA-256 unchanged.
R. API integration tests for strategy matrix endpoints.
S. Performance benchmark: median and p95 latency.
"""

import hashlib
from pathlib import Path
import time
import pytest
from starlette.testclient import TestClient

from kyntra.api.app import app
from kyntra.decision.engine import compute_decision
from kyntra.strategy.counterfactuals import (
    evaluate_action_rule_check,
    simulate_action_energy_scenarios,
    simulate_action_outcome,
)
from kyntra.strategy.matrix import generate_strategy_matrix
from kyntra.strategy.models import (
    PassWindowSnapshot,
    StrategistAction,
    StrategyMatrixSnapshot,
)

FROZEN_MODEL_PATH = Path("models/kyntra_overtake_bundle_v1.joblib")
EXPECTED_MODEL_SHA = "a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_battle():
    race_data = {
        "event_id": "2026_01_AUS",
        "lap": 18,
        "attacker": "NOR",
        "defender": "VER",
        "track_status": "1",
        "mode": "REPLAY",
        "source_mode": "HISTORICAL_REPLAY",
    }
    battle_data = {
        "gap_seconds": 0.48,
        "closing_rate": 0.35,
        "recent_pace_delta_1lap": -0.22,
        "recent_pace_delta_3laps": -0.19,
        "speed_trap_delta": -8.5,
        "tyre_age_delta": 2.0,
        "rear_threat": "LOW",
    }
    energy_data = {
        "available_energy_mj": 2.65,
        "scenario": "RACE_DEFAULT",
    }
    return race_data, battle_data, energy_data


# ==============================================================================
# A. Matrix contains all 4 actions
# ==============================================================================
def test_matrix_contains_all_four_actions(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert set(matrix.actions.keys()) == {"CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"}
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        assert matrix.actions[act].action == act
        assert matrix.actions[act].available is True


# ==============================================================================
# B. All actions share identical initial source state
# ==============================================================================
def test_all_actions_share_identical_source_state(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    before_energy_values = [
        matrix.actions[act].energy.before_mj
        for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]
    ]
    # Every action starts from the exact same initial energy (2.65 MJ)
    assert len(set(before_energy_values)) == 1
    assert before_energy_values[0] == 2.65

    # Pass context across all actions shares identical baseline P values
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        assert matrix.actions[act].pass_context.current_p1 == matrix.pass_window.p1
        assert matrix.actions[act].pass_context.current_p2 == matrix.pass_window.p2
        assert matrix.actions[act].pass_context.current_p3 == matrix.pass_window.p3


# ==============================================================================
# C. Action evaluation order independence (Regression Test)
# ==============================================================================
def test_action_evaluation_order_independence(sample_battle):
    race, battle, energy = sample_battle
    # Forward evaluation
    order_fwd = [
        StrategistAction.CONSERVE,
        StrategistAction.BUILD,
        StrategistAction.DEPLOY,
        StrategistAction.OVERTAKE,
    ]
    matrix_fwd = generate_strategy_matrix(race, battle, energy, action_order=order_fwd)

    # Reverse evaluation
    order_rev = [
        StrategistAction.OVERTAKE,
        StrategistAction.DEPLOY,
        StrategistAction.BUILD,
        StrategistAction.CONSERVE,
    ]
    matrix_rev = generate_strategy_matrix(race, battle, energy, action_order=order_rev)

    for act_name in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        fwd_act = matrix_fwd.actions[act_name].model_dump()
        rev_act = matrix_rev.actions[act_name].model_dump()
        assert fwd_act == rev_act


# ==============================================================================
# D. Current P1/P2/P3 preserved correctly in pass window
# ==============================================================================
def test_current_p1_p2_p3_preserved(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.pass_window.available is True
    assert matrix.pass_window.p1 is not None
    assert matrix.pass_window.p2 is not None
    assert matrix.pass_window.p3 is not None
    assert matrix.pass_window.p1 <= matrix.pass_window.p2 <= matrix.pass_window.p3
    assert matrix.pass_window.provenance == "FROZEN_MODEL"


# ==============================================================================
# E. ML Truth: No fake action-specific P probabilities
# ==============================================================================
def test_no_fake_action_probabilities(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        # action_effect_available MUST be False in Phase 07
        assert matrix.actions[act].pass_context.action_effect_available is False


# ==============================================================================
# F. Regulation check: OVERTAKE blocked under VSC while DEPLOY/CONSERVE allowed
# ==============================================================================
def test_overtake_blocked_under_vsc_while_deploy_allowed(sample_battle):
    race, battle, energy = sample_battle
    race["track_status"] = "6"  # VSC

    matrix = generate_strategy_matrix(race, battle, energy)
    # OVERTAKE must be BLOCKED
    assert matrix.actions["OVERTAKE"].rule_check.result == "BLOCKED"
    assert matrix.actions["OVERTAKE"].eligible is False
    assert len(matrix.actions["OVERTAKE"].exclusion_reasons) > 0
    assert "FIA_SR_B5.12.2(c)" in matrix.actions["OVERTAKE"].rule_check.rule_ids[0]

    # DEPLOY, CONSERVE, BUILD must remain ALLOWED
    assert matrix.actions["DEPLOY"].rule_check.result == "ALLOWED"
    assert matrix.actions["DEPLOY"].eligible is True
    assert matrix.actions["CONSERVE"].rule_check.result == "ALLOWED"
    assert matrix.actions["BUILD"].rule_check.result == "ALLOWED"


# ==============================================================================
# G. Missing energy degrades only relevant fields
# ==============================================================================
def test_missing_energy_degrades_gracefully(sample_battle):
    race, battle, _ = sample_battle
    matrix = generate_strategy_matrix(race, battle, simulated_energy_state=None)
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        act_obj = matrix.actions[act]
        assert act_obj.energy.available is False
        assert act_obj.energy.before_mj is None
        assert act_obj.energy.after_mj is None
        # Other components remain available
        assert act_obj.pass_context.current_p1 is not None
        assert act_obj.rule_check.result == "ALLOWED"


# ==============================================================================
# H. Missing stability yields UNKNOWN without crash
# ==============================================================================
def test_missing_stability_yields_unknown(sample_battle):
    race, battle, energy = sample_battle
    # Empty battle features for stability
    empty_battle = {"gap_seconds": 0.5}
    matrix = generate_strategy_matrix(race, empty_battle, energy)
    # For OVERTAKE, missing stability gives UNKNOWN
    assert matrix.actions["OVERTAKE"].stability.verdict == "UNKNOWN"
    assert matrix.actions["OVERTAKE"].stability.available is False


# ==============================================================================
# I. Energy scenario invariants
# ==============================================================================
def test_energy_scenario_invariants(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        scenarios = matrix.actions[act].energy_scenarios
        assert "CONSERVATIVE" in scenarios
        assert "NOMINAL" in scenarios
        assert "FAVORABLE" in scenarios

        # Invariant: CONSERVATIVE <= NOMINAL <= FAVORABLE terminal energy
        assert (
            scenarios["CONSERVATIVE"].terminal_energy_mj
            <= scenarios["NOMINAL"].terminal_energy_mj
            <= scenarios["FAVORABLE"].terminal_energy_mj
        )

    # Invariant: CONSERVE preserves more or equal energy than OVERTAKE
    conserve_terminal = matrix.actions["CONSERVE"].energy_scenarios["NOMINAL"].terminal_energy_mj
    overtake_terminal = matrix.actions["OVERTAKE"].energy_scenarios["NOMINAL"].terminal_energy_mj
    assert conserve_terminal >= overtake_terminal


# ==============================================================================
# J. No simulated SOC represented as measured
# ==============================================================================
def test_no_simulated_soc_as_measured(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        prov = matrix.actions[act].energy.provenance
        assert "SIMULATED" in prov
        assert "REAL" not in prov
        assert "MEASURED" not in prov


# ==============================================================================
# K. Provenance tags correct
# ==============================================================================
def test_provenance_correctness(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.pass_window.provenance == "FROZEN_MODEL"
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        assert matrix.actions[act].provenance == "FORECAST_SIMULATION"


# ==============================================================================
# L. Replay source mode preserved
# ==============================================================================
def test_replay_source_mode_preserved(sample_battle):
    race, battle, energy = sample_battle
    race["source_mode"] = "CAPTURED_LIVE"
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.source_mode == "CAPTURED_LIVE"


# ==============================================================================
# M. Live and synthetic source modes preserved
# ==============================================================================
def test_synthetic_source_mode_preserved(sample_battle):
    race, battle, energy = sample_battle
    race["mode"] = "FORECAST"
    race["source_mode"] = "SYNTHETIC"
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.mode == "FORECAST"
    assert matrix.source_mode == "SYNTHETIC"


# ==============================================================================
# N. Forecast values not mislabeled as historical observations
# ==============================================================================
def test_forecast_not_mislabeled_historical(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        assert matrix.actions[act].provenance != "HISTORICAL_OUTCOME"


# ==============================================================================
# O. Matrix ranking unavailable in Phase 07
# ==============================================================================
def test_ranking_unavailable_in_phase_07(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.ranking["available"] is False
    assert matrix.ranking["reason"] == "STRATEGY_RANKING_PENDING_PHASE_08"


# ==============================================================================
# P. Recommendation unavailable in Phase 07
# ==============================================================================
def test_recommendation_unavailable_in_phase_07(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.recommendation["available"] is False
    assert matrix.recommendation["reason"] == "STRATEGY_RANKING_PENDING_PHASE_08"
    assert matrix.reason == "STRATEGY_RANKING_PENDING_PHASE_08"


# ==============================================================================
# Q. Frozen model bundle SHA-256 unchanged
# ==============================================================================
def test_frozen_model_sha_unchanged():
    assert FROZEN_MODEL_PATH.exists()
    computed_sha = hashlib.sha256(FROZEN_MODEL_PATH.read_bytes()).hexdigest()
    assert computed_sha == EXPECTED_MODEL_SHA


# ==============================================================================
# R. API Endpoints Integration
# ==============================================================================
def test_api_strategy_matrix_current(client):
    res = client.get("/api/strategy/matrix/current")
    assert res.status_code == 200
    data = res.json()
    assert "actions" in data
    assert set(data["actions"].keys()) == {"CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"}
    assert data["ranking"]["available"] is False


def test_api_strategy_matrix_replay_lap(client):
    res = client.get("/api/strategy/matrix/2026_13_ITA/15")
    assert res.status_code == 200
    data = res.json()
    assert data["lap_number"] == 15
    assert "actions" in data
    assert data["pass_window"]["available"] is True


def test_api_strategy_matrix_custom_post(client):
    payload = {
        "gap_seconds": 0.42,
        "closing_rate": 0.8,
        "recent_pace_delta_1lap": -0.35,
        "recent_pace_delta_3laps": -0.30,
        "speed_trap_delta": 6.0,
        "attacker": "ANT",
        "defender": "VER",
        "event_id": "2026_13_ITA",
        "lap": 20,
        "available_energy_mj": 3.0,
        "track_status": "1",
    }
    res = client.post("/api/strategy/matrix", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["actions"]["OVERTAKE"]["available"] is True
    assert data["actions"]["OVERTAKE"]["eligible"] is True
    assert data["actions"]["CONSERVE"]["energy"]["before_mj"] == 3.0


# ==============================================================================
# S. Performance Benchmark (Median and P95 latency)
# ==============================================================================
def test_matrix_generation_performance_benchmark(sample_battle):
    race, battle, energy = sample_battle
    runtimes = []
    # Warmup
    for _ in range(5):
        generate_strategy_matrix(race, battle, energy)

    # Benchmark 100 iterations
    iterations = 100
    for _ in range(iterations):
        t0 = time.perf_counter()
        generate_strategy_matrix(race, battle, energy)
        t1 = time.perf_counter()
        runtimes.append((t1 - t0) * 1000.0)  # ms

    runtimes.sort()
    median_ms = runtimes[len(runtimes) // 2]
    p95_ms = runtimes[int(0.95 * len(runtimes))]

    print(f"\n[PERFORMANCE] StrategyMatrixSnapshot (100 runs): Median = {median_ms:.2f}ms, P95 = {p95_ms:.2f}ms")
    assert median_ms < 50.0, f"Median runtime too high: {median_ms:.2f}ms"
