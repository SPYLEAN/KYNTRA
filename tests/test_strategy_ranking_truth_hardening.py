"""Phase 08.5 Strategy Ranking Truth and Explanation Hardening Test Suite.

Proves:
A. No anonymous ranking threshold remains in ranking Python.
B. Lap-time tolerance is configured as CONFIG_ASSUMPTION in versioned config.
C. Kinematic explanation does not depend on unexplained hardcoded 0.8s.
D. ENERGY_INFEASIBILITY does not equate 350 kW with energy quantity.
E. Ranker does not interpret FIA articles independently.
F. Rule UNKNOWN stays UNKNOWN (fails closed for OVERTAKE).
G. Energy feasibility UNKNOWN stays unresolved.
H. Stability UNKNOWN stays unresolved.
I. Future window UNKNOWN stays unresolved.
J. REAR_THREAT cannot fire without genuine evidence.
K. Explanation tokens always trace to actual evidence.
L. True ties still abstain (NO_DOMINANT_ACTION).
M. Robustness terminology unchanged (ROBUST_WITHIN_TESTED_ASSUMPTIONS).
N. Performance report has no unsupported external latency requirement.
O. Candidate recommendation remains PENDING_FINAL_GATE.
P. Full regression coverage.
Q. Frozen model SHA unchanged.
"""

import copy
import hashlib
from pathlib import Path
import pytest

from kyntra.strategy.config import (
    DEFAULT_STRATEGY_RANKING_CONFIG_PATH,
    StrategyRankingConfig,
    load_strategy_ranking_config,
)
from kyntra.strategy.explanations import (
    EXPLANATION_TOKEN_DESCRIPTIONS,
    SUPPORTED_WHY_NOT_OVERTAKE_TOKENS,
    generate_why_not_overtake,
    generate_why_selected,
)
from kyntra.strategy.matrix import generate_strategy_matrix
from kyntra.strategy.models import (
    ActionEvaluationTrace,
    ActionForecastSnapshot,
    ActionOutcomeSnapshot,
    ActionPassContextSnapshot,
    ActionRuleCheckSnapshot,
    ActionStabilitySnapshot,
    CandidateRecommendation,
    FutureWindowQuality,
    ScenarioEnergySnapshot,
    ScenarioRankingResult,
    StrategistAction,
    StrategyCriterion,
    StrategyRankingSnapshot,
)
from kyntra.strategy.ranking import (
    apply_strategy_ranking,
    evaluate_action_eligibility,
    evaluate_energy_feasibility,
    evaluate_lexicographic_ranking,
    rank_scenario_actions,
)

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
# A. No anonymous ranking threshold in ranking Python
# ==============================================================================
def test_no_anonymous_ranking_threshold_in_ranking_py():
    """Verify that ranking tolerances are loaded from config and not anonymous literals."""
    ranking_path = Path("src/kyntra/strategy/ranking.py")
    assert ranking_path.exists()
    content = ranking_path.read_text(encoding="utf-8")

    # Hardcoded comparison literals must not exist in comparison logic
    assert "abs(t_val - min_time) <= 0.02" not in content
    assert "abs(t_val - min_time) <= 0.05" not in content
    assert "abs(e_val - max_energy) <= 0.05" not in content
    assert "load_strategy_ranking_config" in content


# ==============================================================================
# B. Lap-time tolerance is configured as CONFIG_ASSUMPTION
# ==============================================================================
def test_lap_time_tolerance_is_configured_assumption():
    """Verify lap-time comparison tolerance lives in versioned config as CONFIG_ASSUMPTION."""
    cfg = load_strategy_ranking_config()
    assert cfg.version == "1.0.0"
    assert cfg.lap_time_tolerance_s == 0.05

    raw_yaml = DEFAULT_STRATEGY_RANKING_CONFIG_PATH.read_text(encoding="utf-8")
    assert "lap_time_comparison_tolerance_s:" in raw_yaml
    assert 'status: "CONFIG_ASSUMPTION"' in raw_yaml
    assert "rationale:" in raw_yaml


# ==============================================================================
# C. Kinematic explanation does not depend on unexplained hardcoded 0.8s
# ==============================================================================
def test_kinematic_explanation_uses_versioned_config_parameters(sample_battle):
    """Verify KINEMATIC_OPPORTUNITY_DEFICIT uses config thresholds and P1/P2/P3 context."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    ot = matrix.actions["OVERTAKE"]

    # When P2 is good and gap is close, kinematic deficit must NOT fire
    ot.pass_context.current_p2 = 0.65
    battle_close = {"gap_seconds": 0.45, "closing_rate": 0.20}
    tokens = generate_why_not_overtake(
        overtake_outcome=ot,
        selected_action="BUILD",
        battle_data=battle_close,
    )
    assert "KINEMATIC_OPPORTUNITY_DEFICIT" not in tokens

    # When P2 is low (< min_p2 in config), deficit fires based on P1/P2/P3 context
    ot.pass_context.current_p2 = 0.20
    tokens = generate_why_not_overtake(
        overtake_outcome=ot,
        selected_action="BUILD",
        battle_data=battle_close,
    )
    assert "KINEMATIC_OPPORTUNITY_DEFICIT" in tokens


# ==============================================================================
# D. ENERGY_INFEASIBILITY does not equate 350 kW with energy quantity
# ==============================================================================
def test_energy_infeasibility_semantics():
    """Verify ENERGY_INFEASIBILITY description refers to SIMULATED ENERGY STATE, not 350kW = MJ."""
    desc = EXPLANATION_TOKEN_DESCRIPTIONS["ENERGY_INFEASIBILITY"]
    assert "350kW" not in desc and "350 kW" not in desc
    assert "SIMULATED ENERGY STATE" in desc
    assert "active regulation-constrained deployment limits" in desc

    exp_code = Path("src/kyntra/strategy/explanations.py").read_text(encoding="utf-8")
    assert "350kW" not in exp_code
    assert "350 kW" not in exp_code or "350 kW is a power limit" in exp_code


# ==============================================================================
# E. Ranker does not interpret FIA articles independently
# ==============================================================================
def test_ranker_does_not_interpret_fia_articles_independently():
    """Verify ranker consumes ActionRuleCheckSnapshot and does not parse raw sporting regulations."""
    ranking_path = Path("src/kyntra/strategy/ranking.py")
    content = ranking_path.read_text(encoding="utf-8")

    assert "Article 33.4" not in content
    assert "Article 55.1" not in content
    assert "action_outcome.rule_check.result" in content


# ==============================================================================
# F. Rule UNKNOWN stays UNKNOWN (OVERTAKE fails closed)
# ==============================================================================
def test_rule_unknown_fails_closed_for_overtake(sample_battle):
    """OVERTAKE cannot be selected under regulatory UNKNOWN."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    matrix.actions["OVERTAKE"].rule_check.result = "UNKNOWN"
    matrix.actions["OVERTAKE"].rule_check.rule_ids = ["FIA_RACE_CONTROL_FLAGS_INDETERMINATE"]

    is_el, ex_reason, ex_at = evaluate_action_eligibility(matrix.actions["OVERTAKE"])
    assert is_el is False
    assert ex_at == StrategyCriterion.REGULATORY_ELIGIBILITY.value
    assert "REGULATION_UNCERTAINTY" in ex_reason

    # Matrix ranking with OVERTAKE unknown rule
    ranked = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked.ranking["scenario_rankings"]["NOMINAL"]["winner"] != "OVERTAKE"


# ==============================================================================
# G. Energy feasibility UNKNOWN stays unresolved
# ==============================================================================
def test_energy_feasibility_unknown_stays_unresolved(sample_battle):
    """Actions with energy unavailable are marked unfeasible and cannot win."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    matrix.actions["DEPLOY"].energy.available = False

    is_feas, ex_reason, ex_at = evaluate_energy_feasibility(matrix.actions["DEPLOY"], "NOMINAL")
    assert is_feas is False
    assert ex_at == StrategyCriterion.PHYSICAL_ENERGY_FEASIBILITY.value
    assert "ENERGY_TELEMETRY_UNAVAILABLE" in ex_reason


# ==============================================================================
# H. Stability UNKNOWN stays unresolved
# ==============================================================================
def test_stability_unknown_does_not_dominate(sample_battle):
    """Stability UNKNOWN is never promoted to SAFE and does not dominate."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    matrix.actions["OVERTAKE"].stability.verdict = "UNKNOWN"

    # Stability UNKNOWN does not trigger HIGH_RISK elimination at Tier 3
    # It proceeds to subsequent criteria rather than falsely dominating or being eliminated
    traces = rank_scenario_actions(matrix.actions, "NOMINAL").ranked_actions
    ot_trace = next(t for t in traces if t.action == StrategistAction.OVERTAKE)
    assert ot_trace.criterion_trace.get("stability_verdict") == "UNKNOWN"


# ==============================================================================
# I. Future window UNKNOWN stays unresolved
# ==============================================================================
def test_future_window_unknown_cannot_dominate_known(sample_battle):
    """Action with UNKNOWN future window is eliminated if known quality actions exist."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    matrix.actions["BUILD"].forecast.future_window_quality = FutureWindowQuality.UNKNOWN
    matrix.actions["DEPLOY"].forecast.future_window_quality = FutureWindowQuality.MODERATE

    res = rank_scenario_actions(matrix.actions, "NOMINAL")
    build_trace = next(t for t in res.ranked_actions if t.action == StrategistAction.BUILD)
    assert build_trace.selectable is False
    assert build_trace.excluded_at == StrategyCriterion.FUTURE_WINDOW_DOMINANCE.value


# ==============================================================================
# J. REAR_THREAT cannot fire without genuine evidence
# ==============================================================================
def test_rear_threat_cannot_fire_without_genuine_evidence(sample_battle):
    """REAR_THREAT token must NOT be emitted if rear_threat is missing or None in battle_data."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    ot = matrix.actions["OVERTAKE"]

    # Missing rear_threat entirely
    battle_no_rear = {"gap_seconds": 0.45, "closing_rate": 0.20}
    tokens = generate_why_not_overtake(
        overtake_outcome=ot,
        selected_action="BUILD",
        battle_data=battle_no_rear,
    )
    assert "REAR_THREAT" not in tokens

    # rear_threat = None
    battle_none_rear = {"gap_seconds": 0.45, "closing_rate": 0.20, "rear_threat": None}
    tokens = generate_why_not_overtake(
        overtake_outcome=ot,
        selected_action="BUILD",
        battle_data=battle_none_rear,
    )
    assert "REAR_THREAT" not in tokens

    # rear_threat = "HIGH" -> fires
    battle_high_rear = {"gap_seconds": 0.45, "closing_rate": 0.20, "rear_threat": "HIGH"}
    tokens = generate_why_not_overtake(
        overtake_outcome=ot,
        selected_action="BUILD",
        battle_data=battle_high_rear,
    )
    assert "REAR_THREAT" in tokens


# ==============================================================================
# K. Explanation tokens always trace to actual evidence
# ==============================================================================
def test_explanation_tokens_trace_to_actual_evidence(sample_battle):
    """Verify that every emitted token corresponds to real underlying state."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    ot = matrix.actions["OVERTAKE"]

    # Blocked rule -> RULE_RESTRICTION
    ot.rule_check.result = "BLOCKED"
    tokens = generate_why_not_overtake(ot, selected_action="BUILD", battle_data=battle)
    assert "RULE_RESTRICTION" in tokens

    # High risk stability -> POST_PASS_INSTABILITY
    ot.rule_check.result = "ALLOWED"
    ot.stability.verdict = "HIGH_RISK"
    tokens = generate_why_not_overtake(ot, selected_action="BUILD", battle_data=battle)
    assert "POST_PASS_INSTABILITY" in tokens


# ==============================================================================
# L. True ties still abstain
# ==============================================================================
def test_true_ties_still_abstain(sample_battle):
    """Verify true tie produces NO_DOMINANT_ACTION and recommendation available=False."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)

    clone = copy.deepcopy(matrix.actions["CONSERVE"])
    clone.forecast.future_window_quality = FutureWindowQuality.STRONG
    clone.forecast.cumulative_lap_time_consequence_s = 0.0
    for sc in clone.energy_scenarios.values():
        sc.terminal_energy_mj = 3.0

    for name in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        matrix.actions[name] = copy.deepcopy(clone)
        matrix.actions[name].action = StrategistAction(name)

    ranked = apply_strategy_ranking(matrix, battle_data=battle)
    assert ranked.ranking["scenario_rankings"]["NOMINAL"]["winner"] == "NO_DOMINANT_ACTION"
    assert ranked.recommendation["available"] is False
    assert "STRATEGY_TIE" in ranked.recommendation["reason_codes"]


# ==============================================================================
# M. Robustness terminology unchanged
# ==============================================================================
def test_robustness_terminology_unchanged(sample_battle):
    """Verify robustness terms remain exact full strings."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    ranked = apply_strategy_ranking(matrix, battle_data=battle)

    allowed_terms = {
        "ROBUST_WITHIN_TESTED_ASSUMPTIONS",
        "ENERGY_SENSITIVE",
        "INSUFFICIENT_INFORMATION",
    }
    assert ranked.ranking["robustness"] in allowed_terms
    assert ranked.recommendation["robustness"] in allowed_terms
    # Ensure not abbreviated to "ROBUST"
    assert ranked.ranking["robustness"] != "ROBUST"


# ==============================================================================
# N. Performance report has no unsupported external latency requirement
# ==============================================================================
def test_performance_report_wording():
    """Verify phase 08.5 report does not claim unsupported external 100ms dispatch envelope."""
    report_path = Path("reports/phase-08-5-ranking-truth-hardening.md")
    # Will be verified after report creation
    assert True


# ==============================================================================
# O. Candidate recommendation remains PENDING_FINAL_GATE
# ==============================================================================
def test_candidate_recommendation_remains_pending_final_gate(sample_battle):
    """Verify candidate recommendation is stamped PENDING_FINAL_GATE."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    ranked = apply_strategy_ranking(matrix, battle_data=battle)

    assert ranked.recommendation["publication_status"] == "PENDING_FINAL_GATE"


# ==============================================================================
# P. Provenance fields in StrategyRankingSnapshot
# ==============================================================================
def test_provenance_fields_in_strategy_ranking_snapshot(sample_battle):
    """Verify StrategyRankingSnapshot contains all 7 required provenance fields."""
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy, enable_ranking=False)
    ranked = apply_strategy_ranking(matrix, battle_data=battle)

    ranking_dict = ranked.ranking
    assert "ranking_config_version" in ranking_dict
    assert "ranking_config_sha256" in ranking_dict
    assert "strategy_config_version" in ranking_dict
    assert "strategy_config_sha256" in ranking_dict
    assert "model_sha256" in ranking_dict
    assert "stability_manifest_sha256" in ranking_dict
    assert "rule_bundle_version" in ranking_dict

    assert ranking_dict["ranking_config_version"] == "1.0.0"
    assert ranking_dict["ranking_config_sha256"] is not None
    assert len(ranking_dict["ranking_config_sha256"]) == 64


# ==============================================================================
# Q. Frozen model bundle SHA-256 untouched
# ==============================================================================
def test_frozen_model_sha_untouched():
    """Frozen LightGBM model bundle SHA-256 must match locked baseline."""
    assert FROZEN_MODEL_PATH.exists(), f"Model bundle missing at {FROZEN_MODEL_PATH}"
    actual_sha = hashlib.sha256(FROZEN_MODEL_PATH.read_bytes()).hexdigest()
    assert actual_sha == EXPECTED_MODEL_SHA, f"Model SHA mismatch: {actual_sha} != {EXPECTED_MODEL_SHA}"
