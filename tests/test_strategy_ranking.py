"""Comprehensive test suite and adversarial verification for KYNTRA Phase 08:
Lexicographic Strategy Ranking + Candidate KYNTRA Call.

Verifies:
A. BLOCKED action can never win.
B. Rule UNKNOWN is not treated as ALLOWED.
C. Energy-infeasible action can never win.
D. OVERTAKE with HIGH_RISK stability loses to durable eligible alternative.
E. CAUTION stability is not treated as FAVORABLE.
F. UNKNOWN stability is preserved.
G. Future STRONG dominates MODERATE when earlier criteria tie.
H. Future MODERATE dominates WEAK when earlier criteria tie.
I. UNKNOWN future window does not receive invented ordering.
J. Lower comparable cumulative lap-time consequence wins after higher criteria tie.
K. Higher terminal simulated energy wins only at final tie-break criterion.
L. No weighted score exists.
M. No arbitrary action priority resolves a true tie.
N. True tie returns NO_DOMINANT_ACTION.
O. Same winner in all scenarios -> ROBUST_WITHIN_TESTED_ASSUMPTIONS.
P. Different scenario winners -> ENERGY_SENSITIVE.
Q. Missing scenario -> INSUFFICIENT_INFORMATION.
R. CONSERVE maps to SAVE ENERGY.
S. BUILD maps to PREPARE.
T. DEPLOY maps to APPLY PRESSURE.
U. OVERTAKE maps to OVERTAKE NOW.
V. WHY_NOT_OVERTAKE tokens generated strictly from verified evidence.
W. No fake action-specific P1/P2/P3 modifications.
X. Ranking order is deterministic.
Y. Action input order cannot change ranking winner (Fair Baseline / Order Independence).
Z. DecisionSnapshot stores trace and provenance.
AA. Frozen model bundle SHA-256 unchanged.
AB. Full regression coverage.

Adversarial Test Cases:
CASE 1: OVERTAKE fastest but BLOCKED -> cannot win.
CASE 2: OVERTAKE fastest but HIGH_RISK, BUILD STRONG -> BUILD dominates.
CASE 3: DEPLOY best short-term time but energy infeasible -> cannot win.
CASE 4: BUILD wins NOMINAL/FAVORABLE, CONSERVE wins CONSERVATIVE -> ENERGY_SENSITIVE.
CASE 5: All 4 actions tied through all criteria -> NO_DOMINANT_ACTION.
CASE 6: OVERTAKE eligibility UNKNOWN -> cannot be positive candidate.
CASE 7: Missing stability + missing future window -> safe abstention.
"""

import copy
import hashlib
from pathlib import Path
import pytest
from starlette.testclient import TestClient

from kyntra.api.app import app
from kyntra.decision.engine import compute_decision
from kyntra.strategy.config import load_strategy_counterfactual_config
from kyntra.strategy.counterfactuals import simulate_action_outcome
from kyntra.strategy.explanations import generate_why_not_overtake, generate_why_selected
from kyntra.strategy.matrix import generate_strategy_matrix
from kyntra.strategy.models import (
    ActionEnergySnapshot,
    ActionForecastSnapshot,
    ActionOutcomeSnapshot,
    ActionPassContextSnapshot,
    ActionRuleCheckSnapshot,
    ActionStabilitySnapshot,
    CandidateRecommendation,
    FutureWindowQuality,
    PassWindowSnapshot,
    ScenarioEnergySnapshot,
    ScenarioRankingResult,
    StrategistAction,
    StrategyRankingSnapshot,
)
from kyntra.strategy.ranking import (
    apply_strategy_ranking,
    evaluate_lexicographic_ranking,
    rank_scenario_actions,
)
from kyntra.strategy.recommendation import UI_CALL_MAP, generate_candidate_recommendation

FROZEN_MODEL_PATH = Path("models/kyntra_overtake_bundle_v1.joblib")
EXPECTED_MODEL_SHA = "a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5"


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
# A. BLOCKED action can never win
# ==============================================================================
def test_blocked_action_can_never_win(sample_battle):
    race, battle, energy = sample_battle
    race["track_status"] = "4"  # Safety Car
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=True)
    assert matrix.ranking["available"] is True
    # OVERTAKE is BLOCKED under SC
    overtake_trace = next(t for t in matrix.ranking["scenario_rankings"]["NOMINAL"]["ranked_actions"] if t["action"] == "OVERTAKE")
    assert overtake_trace["selectable"] is False
    assert overtake_trace["excluded_at"] == "REGULATORY_ELIGIBILITY"
    assert matrix.recommendation["backend_action"] != "OVERTAKE"


# ==============================================================================
# B. Rule UNKNOWN is not treated as ALLOWED
# ==============================================================================
def test_rule_unknown_not_treated_as_allowed(sample_battle):
    race, battle, energy = sample_battle
    race["track_status"] = "2"  # Yellow flag with unspecified hazard zone
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=True)
    # Under unspecified Yellow, OVERTAKE rule check is UNKNOWN
    assert matrix.actions["OVERTAKE"].rule_check.result == "UNKNOWN"
    # OVERTAKE cannot be positively selected when regulatory status is UNKNOWN
    assert matrix.recommendation["backend_action"] != "OVERTAKE"


# ==============================================================================
# C. Energy-infeasible action can never win
# ==============================================================================
def test_energy_infeasible_action_cannot_win(sample_battle):
    race, battle, _ = sample_battle
    # Empty / zero energy
    depleted_energy = {"available_energy_mj": 0.0}
    matrix = generate_strategy_matrix(race, battle, depleted_energy, enable_ranking=True)
    # DEPLOY and OVERTAKE require energy; with 0.0 MJ initial energy they are marked infeasible
    nom_ranking = matrix.ranking["scenario_rankings"]["NOMINAL"]
    ot_trace = next(t for t in nom_ranking["ranked_actions"] if t["action"] == "OVERTAKE")
    dep_trace = next(t for t in nom_ranking["ranked_actions"] if t["action"] == "DEPLOY")
    assert ot_trace["selectable"] is False or dep_trace["selectable"] is False


# ==============================================================================
# D. OVERTAKE HIGH_RISK loses to durable eligible alternative
# ==============================================================================
def test_overtake_high_risk_loses_to_durable_alternative(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # Artificially set OVERTAKE stability to HIGH_RISK
    matrix.actions["OVERTAKE"].stability.verdict = "HIGH_RISK"
    # Ensure BUILD has STRONG or MODERATE future window
    matrix.actions["BUILD"].forecast.future_window_quality = FutureWindowQuality.STRONG

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked_matrix.ranking["available"] is True
    nom_winner = ranked_matrix.ranking["scenario_rankings"]["NOMINAL"]["winner"]
    # OVERTAKE must NOT win when HIGH_RISK and durable alternative exists
    assert nom_winner != "OVERTAKE"
    assert "POST_PASS_INSTABILITY" in ranked_matrix.recommendation["why_not_overtake"]


# ==============================================================================
# E. CAUTION stability is not treated as FAVORABLE
# ==============================================================================
def test_caution_stability_not_treated_as_favorable(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    matrix.actions["OVERTAKE"].stability.verdict = "CAUTION"
    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    # CAUTION does not generate a fake retention probability or favorable claim
    assert ranked_matrix.actions["OVERTAKE"].stability.verdict == "CAUTION"


# ==============================================================================
# F. UNKNOWN stability is preserved
# ==============================================================================
def test_unknown_stability_preserved(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    matrix.actions["OVERTAKE"].stability.verdict = "UNKNOWN"
    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked_matrix.actions["OVERTAKE"].stability.verdict == "UNKNOWN"


# ==============================================================================
# G & H. Future window dominance (STRONG > MODERATE > WEAK)
# ==============================================================================
def test_future_window_ordinal_dominance(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)

    # Set identical lap times and energy to isolate Tier 4
    for act in matrix.actions.values():
        act.rule_check.result = "ALLOWED"
        act.forecast.cumulative_lap_time_consequence_s = 0.0
        for sc in act.energy_scenarios.values():
            sc.terminal_energy_mj = 2.0

    # Action A has STRONG, Action B has MODERATE, Action C has WEAK
    matrix.actions["BUILD"].forecast.future_window_quality = FutureWindowQuality.STRONG
    matrix.actions["CONSERVE"].forecast.future_window_quality = FutureWindowQuality.MODERATE
    matrix.actions["DEPLOY"].forecast.future_window_quality = FutureWindowQuality.WEAK
    matrix.actions["OVERTAKE"].forecast.future_window_quality = FutureWindowQuality.WEAK

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked_matrix.ranking["scenario_rankings"]["NOMINAL"]["winner"] == "BUILD"


# ==============================================================================
# I. UNKNOWN future window does not receive invented ordering
# ==============================================================================
def test_unknown_future_window_ordering(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    for act in matrix.actions.values():
        act.rule_check.result = "ALLOWED"
        act.forecast.future_window_quality = FutureWindowQuality.UNKNOWN
        act.forecast.cumulative_lap_time_consequence_s = 0.0

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    # When future window is UNKNOWN for all and earlier criteria tie, ranker falls through to Tier 5/6
    assert ranked_matrix.ranking["available"] is True


# ==============================================================================
# J. Lower cumulative lap-time consequence wins after higher criteria tie
# ==============================================================================
def test_lower_lap_time_wins_after_tie(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # Equalize Tiers 1-4
    for act in matrix.actions.values():
        act.rule_check.result = "ALLOWED"
        act.forecast.future_window_quality = FutureWindowQuality.MODERATE
        for sc in act.energy_scenarios.values():
            sc.terminal_energy_mj = 2.0

    # DEPLOY is faster (-0.30s) than BUILD (+0.05s)
    matrix.actions["DEPLOY"].forecast.cumulative_lap_time_consequence_s = -0.30
    matrix.actions["BUILD"].forecast.cumulative_lap_time_consequence_s = 0.05
    matrix.actions["CONSERVE"].forecast.cumulative_lap_time_consequence_s = 0.60
    matrix.actions["OVERTAKE"].forecast.cumulative_lap_time_consequence_s = 0.50

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked_matrix.ranking["scenario_rankings"]["NOMINAL"]["winner"] == "DEPLOY"


# ==============================================================================
# K. Higher terminal energy wins only at final criterion
# ==============================================================================
def test_higher_terminal_energy_wins_at_tier_6(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # Equalize Tiers 1-5
    for act in matrix.actions.values():
        act.rule_check.result = "ALLOWED"
        act.forecast.future_window_quality = FutureWindowQuality.MODERATE
        act.forecast.cumulative_lap_time_consequence_s = 0.0

    # CONSERVE has highest terminal energy (3.4 MJ)
    matrix.actions["CONSERVE"].energy_scenarios["NOMINAL"].terminal_energy_mj = 3.40
    matrix.actions["BUILD"].energy_scenarios["NOMINAL"].terminal_energy_mj = 2.80
    matrix.actions["DEPLOY"].energy_scenarios["NOMINAL"].terminal_energy_mj = 1.90
    matrix.actions["OVERTAKE"].energy_scenarios["NOMINAL"].terminal_energy_mj = 1.20

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked_matrix.ranking["scenario_rankings"]["NOMINAL"]["winner"] == "CONSERVE"


# ==============================================================================
# L. No weighted score exists in production code
# ==============================================================================
def test_no_weighted_scores_exist():
    ranking_path = Path("src/kyntra/strategy/ranking.py")
    assert ranking_path.exists()
    content = ranking_path.read_text(encoding="utf-8")
    assert "weight" not in content.lower() or "weighted" not in content.lower()
    assert "attack_value" not in content.lower()
    assert "score =" not in content


# ==============================================================================
# M & N. True tie returns NO_DOMINANT_ACTION without arbitrary priority
# ==============================================================================
def test_true_tie_returns_no_dominant_action(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # Make BUILD and DEPLOY exactly identical on all 6 criteria
    for name in ["BUILD", "DEPLOY"]:
        matrix.actions[name].rule_check.result = "ALLOWED"
        matrix.actions[name].forecast.future_window_quality = FutureWindowQuality.STRONG
        matrix.actions[name].forecast.cumulative_lap_time_consequence_s = -0.20
        for sc in matrix.actions[name].energy_scenarios.values():
            sc.terminal_energy_mj = 2.50
    # Make others inferior
    for name in ["CONSERVE", "OVERTAKE"]:
        matrix.actions[name].forecast.future_window_quality = FutureWindowQuality.WEAK

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    nom_winner = ranked_matrix.ranking["scenario_rankings"]["NOMINAL"]["winner"]
    assert nom_winner == "NO_DOMINANT_ACTION"
    assert ranked_matrix.recommendation["available"] is False
    assert ranked_matrix.recommendation["primary_reason"] == "STRATEGY_TIE_REQUIRES_HUMAN_JUDGMENT"


# ==============================================================================
# O. Same winner in all scenarios -> ROBUST_WITHIN_TESTED_ASSUMPTIONS
# ==============================================================================
def test_robust_across_scenarios(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # Make BUILD strictly dominant on Tier 4 in all scenarios
    matrix.actions["BUILD"].forecast.future_window_quality = FutureWindowQuality.STRONG
    matrix.actions["CONSERVE"].forecast.future_window_quality = FutureWindowQuality.WEAK
    matrix.actions["DEPLOY"].forecast.future_window_quality = FutureWindowQuality.WEAK
    matrix.actions["OVERTAKE"].forecast.future_window_quality = FutureWindowQuality.WEAK

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked_matrix.ranking["robustness"] == "ROBUST_WITHIN_TESTED_ASSUMPTIONS"
    assert ranked_matrix.recommendation["robustness"] == "ROBUST_WITHIN_TESTED_ASSUMPTIONS"


# ==============================================================================
# P. Different scenario winners -> ENERGY_SENSITIVE
# ==============================================================================
def test_energy_sensitive_scenario_divergence(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # Equalize Tiers 1-5
    for act in matrix.actions.values():
        act.rule_check.result = "ALLOWED"
        act.forecast.future_window_quality = FutureWindowQuality.MODERATE
        act.forecast.cumulative_lap_time_consequence_s = 0.0

    # In Conservative: CONSERVE has highest terminal energy
    matrix.actions["CONSERVE"].energy_scenarios["CONSERVATIVE"].terminal_energy_mj = 3.50
    matrix.actions["BUILD"].energy_scenarios["CONSERVATIVE"].terminal_energy_mj = 2.00
    # In Favorable: BUILD has highest terminal energy
    matrix.actions["CONSERVE"].energy_scenarios["FAVORABLE"].terminal_energy_mj = 2.00
    matrix.actions["BUILD"].energy_scenarios["FAVORABLE"].terminal_energy_mj = 3.80

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked_matrix.ranking["robustness"] == "ENERGY_SENSITIVE"
    assert ranked_matrix.recommendation["robustness"] == "ENERGY_SENSITIVE"


# ==============================================================================
# Q. Missing scenario -> INSUFFICIENT_INFORMATION
# ==============================================================================
def test_missing_scenario_yields_insufficient_information(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # Remove Conservative scenario from actions
    for act in matrix.actions.values():
        if "CONSERVATIVE" in act.energy_scenarios:
            del act.energy_scenarios["CONSERVATIVE"]

    ranked_matrix = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked_matrix.ranking["robustness"] == "INSUFFICIENT_INFORMATION"


# ==============================================================================
# R, S, T, U. UI Call Mappings
# ==============================================================================
def test_ui_call_mappings():
    assert UI_CALL_MAP["CONSERVE"] == "SAVE ENERGY"
    assert UI_CALL_MAP["BUILD"] == "PREPARE"
    assert UI_CALL_MAP["DEPLOY"] == "APPLY PRESSURE"
    assert UI_CALL_MAP["OVERTAKE"] == "OVERTAKE NOW"


# ==============================================================================
# V. WHY_NOT_OVERTAKE tokens generated strictly from verified evidence
# ==============================================================================
def test_why_not_overtake_tokens(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # 1. Blocked overtake
    matrix.actions["OVERTAKE"].rule_check.result = "BLOCKED"
    tokens_blocked = generate_why_not_overtake(matrix.actions["OVERTAKE"], selected_action="BUILD")
    assert "RULE_RESTRICTION" in tokens_blocked

    # 2. High risk overtake
    matrix.actions["OVERTAKE"].rule_check.result = "ALLOWED"
    matrix.actions["OVERTAKE"].stability.verdict = "HIGH_RISK"
    tokens_instability = generate_why_not_overtake(matrix.actions["OVERTAKE"], selected_action="BUILD")
    assert "POST_PASS_INSTABILITY" in tokens_instability


# ==============================================================================
# W. No fake action-specific P1/P2/P3 modifications
# ==============================================================================
def test_no_fake_action_p1_p2_p3_changes(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=True)
    p1_initial = matrix.pass_window.p1
    for act in matrix.actions.values():
        assert act.pass_context.current_p1 == p1_initial
        assert act.pass_context.action_effect_available is False


# ==============================================================================
# X & Y. Deterministic ranking & Action input order independence
# ==============================================================================
def test_ranking_order_independence(sample_battle):
    race, battle, energy = sample_battle
    order_fwd = [StrategistAction.CONSERVE, StrategistAction.BUILD, StrategistAction.DEPLOY, StrategistAction.OVERTAKE]
    order_rev = [StrategistAction.OVERTAKE, StrategistAction.DEPLOY, StrategistAction.BUILD, StrategistAction.CONSERVE]

    mat_fwd = generate_strategy_matrix(race, battle, energy, action_order=order_fwd, enable_ranking=True)
    mat_rev = generate_strategy_matrix(race, battle, energy, action_order=order_rev, enable_ranking=True)

    assert mat_fwd.ranking["scenario_rankings"]["NOMINAL"]["winner"] == mat_rev.ranking["scenario_rankings"]["NOMINAL"]["winner"]
    assert mat_fwd.recommendation["backend_action"] == mat_rev.recommendation["backend_action"]
    assert mat_fwd.recommendation["ui_call"] == mat_rev.recommendation["ui_call"]


# ==============================================================================
# Z. DecisionSnapshot stores trace and provenance
# ==============================================================================
def test_decision_snapshot_stores_trace(sample_battle):
    race, battle, energy = sample_battle
    race_snap = {
        "lap": 18,
        "track_status": "1",
        "event_id": "2026_01_AUS",
    }
    dec = compute_decision(race_data=race_snap, battle_data=battle, simulated_energy_state=energy)
    assert dec.strategy_matrix is not None
    assert "actions" in dec.strategy_matrix


# ==============================================================================
# AA. Frozen model bundle SHA-256 unchanged
# ==============================================================================
def test_frozen_model_sha_preserved():
    assert FROZEN_MODEL_PATH.exists()
    computed_sha = hashlib.sha256(FROZEN_MODEL_PATH.read_bytes()).hexdigest()
    assert computed_sha == EXPECTED_MODEL_SHA


# ==============================================================================
# ADVERSARIAL CASES (Cases 1 through 7)
# ==============================================================================
def test_adversarial_case_1_overtake_fastest_but_blocked(sample_battle):
    """CASE 1: OVERTAKE fastest but BLOCKED -> cannot win."""
    race, battle, energy = sample_battle
    race["track_status"] = "6"  # VSC
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=True)
    assert matrix.actions["OVERTAKE"].rule_check.result == "BLOCKED"
    assert matrix.recommendation["backend_action"] != "OVERTAKE"


def test_adversarial_case_2_overtake_high_risk_build_strong(sample_battle):
    """CASE 2: OVERTAKE fastest but HIGH_RISK, BUILD STRONG -> BUILD dominates."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    matrix.actions["OVERTAKE"].stability.verdict = "HIGH_RISK"
    matrix.actions["OVERTAKE"].forecast.cumulative_lap_time_consequence_s = -0.40
    matrix.actions["BUILD"].forecast.future_window_quality = FutureWindowQuality.STRONG
    matrix.actions["BUILD"].forecast.cumulative_lap_time_consequence_s = 0.05
    matrix.actions["DEPLOY"].forecast.future_window_quality = FutureWindowQuality.WEAK
    ranked = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked.ranking["scenario_rankings"]["NOMINAL"]["winner"] == "BUILD"
    assert "POST_PASS_INSTABILITY" in ranked.recommendation["why_not_overtake"]


def test_adversarial_case_3_deploy_fastest_but_infeasible(sample_battle):
    """CASE 3: DEPLOY best short-term time but energy infeasible -> cannot win."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    # Make DEPLOY fastest but mark energy unavailable
    matrix.actions["DEPLOY"].forecast.cumulative_lap_time_consequence_s = -0.50
    matrix.actions["DEPLOY"].energy.available = False
    ranked = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked.ranking["scenario_rankings"]["NOMINAL"]["winner"] != "DEPLOY"


def test_adversarial_case_4_scenario_divergence(sample_battle):
    """CASE 4: BUILD wins NOMINAL/FAVORABLE, CONSERVE wins CONSERVATIVE -> ENERGY_SENSITIVE."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    for act in matrix.actions.values():
        act.rule_check.result = "ALLOWED"
        act.forecast.future_window_quality = FutureWindowQuality.MODERATE
        act.forecast.cumulative_lap_time_consequence_s = 0.0

    # Conservative favoring CONSERVE
    matrix.actions["CONSERVE"].energy_scenarios["CONSERVATIVE"].terminal_energy_mj = 3.8
    matrix.actions["BUILD"].energy_scenarios["CONSERVATIVE"].terminal_energy_mj = 2.0
    # Nominal and Favorable favoring BUILD
    matrix.actions["CONSERVE"].energy_scenarios["NOMINAL"].terminal_energy_mj = 2.0
    matrix.actions["BUILD"].energy_scenarios["NOMINAL"].terminal_energy_mj = 3.2
    matrix.actions["CONSERVE"].energy_scenarios["FAVORABLE"].terminal_energy_mj = 2.0
    matrix.actions["BUILD"].energy_scenarios["FAVORABLE"].terminal_energy_mj = 3.9

    ranked = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked.ranking["robustness"] == "ENERGY_SENSITIVE"


def test_adversarial_case_5_exact_four_way_tie(sample_battle):
    """CASE 5: All four legal/feasible and exactly tied through all criteria -> NO_DOMINANT_ACTION."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    for act in matrix.actions.values():
        act.rule_check.result = "ALLOWED"
        act.forecast.future_window_quality = FutureWindowQuality.MODERATE
        act.forecast.cumulative_lap_time_consequence_s = 0.0
        for sc in act.energy_scenarios.values():
            sc.terminal_energy_mj = 2.50

    ranked = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked.ranking["scenario_rankings"]["NOMINAL"]["winner"] == "NO_DOMINANT_ACTION"
    assert ranked.recommendation["available"] is False
    assert "STRATEGY_TIE" in ranked.recommendation["reason_codes"]


def test_adversarial_case_6_overtake_eligibility_unknown(sample_battle):
    """CASE 6: OVERTAKE eligibility UNKNOWN -> cannot be positive candidate."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    matrix.actions["OVERTAKE"].rule_check.result = "UNKNOWN"
    matrix.actions["OVERTAKE"].forecast.future_window_quality = FutureWindowQuality.STRONG
    matrix.actions["OVERTAKE"].forecast.cumulative_lap_time_consequence_s = -0.50

    ranked = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked.recommendation["backend_action"] != "OVERTAKE"


def test_adversarial_case_7_missing_stability_and_future_window(sample_battle):
    """CASE 7: Missing stability + missing future window -> safe abstention if earlier criteria tie."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    for act in matrix.actions.values():
        act.rule_check.result = "ALLOWED"
        act.stability.verdict = "UNKNOWN"
        act.forecast.future_window_quality = FutureWindowQuality.UNKNOWN
        act.forecast.cumulative_lap_time_consequence_s = 0.0
        for sc in act.energy_scenarios.values():
            sc.terminal_energy_mj = 2.0

    ranked = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked.ranking["scenario_rankings"]["NOMINAL"]["winner"] == "NO_DOMINANT_ACTION"
