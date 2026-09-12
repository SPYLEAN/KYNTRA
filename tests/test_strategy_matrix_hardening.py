"""Tests for KYNTRA Phase 07.5: Strategist Matrix Truth Hardening.

Verifies:
A. No Phase 07 strategy assumption is anonymously hardcoded in production counterfactual Python.
B. Strategy counterfactual config loads correctly with explicit metadata.
C. Strategy config SHA-256 and version are exposed in StrategyMatrixSnapshot.
D. Missing strategy config fails safely to fallback without crashing.
E. FIA C5.2.10 base recharge is 8.5 MJ/lap and not universally flattened to 9.0 MJ.
F. Conditional additional recharge (up to 0.5 MJ) requires applicable B7.2 event context.
G. Unsupported future-window thresholds (e.g. 2.5 MJ) are removed and replaced with directional logic.
H. Unknown regulatory context yields UNKNOWN rather than fabricated ALLOWED or BLOCKED.
I. YELLOW flag does not produce universal BLOCKED without applicable zone context.
J. DEPLOY remains semantically independent from OVERTAKE restriction under caution conditions.
K. Energy scenarios and forecast deltas are tagged CONFIG_ASSUMPTION / FORECAST_SIMULATION.
L. Matrix contains all four canonical discrete actions (CONSERVE, BUILD, DEPLOY, OVERTAKE).
M. Matrix ranking remains strictly disabled (ranking.available = False).
N. Matrix recommendation remains strictly disabled (recommendation.available = False).
O. All matrix components and actions evaluate stably without mutation.
P. Frozen LightGBM model bundle SHA-256 remains untouched.
"""

import hashlib
from pathlib import Path
import pytest

from kyntra.regulations.models import FIARegulationConfig, EventRegulationConfig, TimingLineInfo
from kyntra.strategy.config import (
    DEFAULT_STRATEGY_CONFIG_PATH,
    StrategyCounterfactualConfig,
    load_strategy_counterfactual_config,
)
from kyntra.strategy.counterfactuals import (
    evaluate_action_rule_check,
    simulate_action_energy_scenarios,
    simulate_action_forecast,
    simulate_action_outcome,
)
from kyntra.strategy.matrix import generate_strategy_matrix
from kyntra.strategy.models import (
    ActionStabilitySnapshot,
    FutureWindowQuality,
    PassWindowSnapshot,
    StrategistAction,
    StrategyMatrixSnapshot,
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
# A. No anonymous constants in production counterfactual Python
# ==============================================================================
def test_no_anonymous_strategy_constants_in_python():
    cf_source_path = Path("src/kyntra/strategy/counterfactuals.py")
    assert cf_source_path.exists()
    content = cf_source_path.read_text(encoding="utf-8")

    # Ensure hardcoded rate tables and scenario multipliers were removed
    assert "base_deploy_rates = {" not in content
    assert "base_harvest_rates = {" not in content
    assert '"CONSERVATIVE": {"dep_mult":' not in content
    assert ">= 2.5" not in content


# ==============================================================================
# B. Strategy config loads correctly
# ==============================================================================
def test_strategy_config_loads_correctly():
    cfg = load_strategy_counterfactual_config(force_reload=True)
    assert cfg.version == "1.0.0"
    assert cfg.assumption_profile == "KYNTRA_V1_TACTICAL_NOMINAL"
    assert cfg.forecast_horizon_laps == 3
    assert set(cfg.action_profiles.keys()) == {"CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"}
    assert set(cfg.energy_uncertainty.keys()) == {"CONSERVATIVE", "NOMINAL", "FAVORABLE"}

    # Validate specific assumption values
    assert cfg.action_profiles["CONSERVE"].deployment_fraction == 0.20
    assert cfg.action_profiles["BUILD"].deployment_fraction == 0.55
    assert cfg.action_profiles["DEPLOY"].deployment_fraction == 1.00
    assert cfg.action_profiles["OVERTAKE"].deployment_fraction == 1.00

    assert cfg.energy_uncertainty["CONSERVATIVE"].harvest_multiplier == 0.80
    assert cfg.energy_uncertainty["CONSERVATIVE"].deployment_multiplier == 1.10
    assert cfg.energy_uncertainty["FAVORABLE"].harvest_multiplier == 1.20
    assert cfg.energy_uncertainty["FAVORABLE"].deployment_multiplier == 0.90


# ==============================================================================
# C. Strategy config SHA and version exposed in StrategyMatrixSnapshot
# ==============================================================================
def test_strategy_config_sha_and_version_exposed(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.strategy_config_version == "1.0.0"
    assert matrix.strategy_config_sha256 is not None
    assert len(matrix.strategy_config_sha256) == 64
    assert matrix.assumption_profile == "KYNTRA_V1_TACTICAL_NOMINAL"
    assert matrix.energy_config_version == "2026.1"


# ==============================================================================
# D. Missing strategy config fails safely
# ==============================================================================
def test_missing_strategy_config_fails_safely():
    missing_path = Path("configs/does_not_exist_counterfactual.yaml")
    fallback_cfg = load_strategy_counterfactual_config(config_path=missing_path, force_reload=True)
    assert fallback_cfg.version == "0.0.0-MISSING"
    assert fallback_cfg.assumption_profile == "UNCONFIGURED"
    assert "CONSERVE" in fallback_cfg.action_profiles
    # Reload default to clear cache
    load_strategy_counterfactual_config(force_reload=True)


# ==============================================================================
# E. FIA C5.2.10 base recharge is not universally flattened to 9.0 MJ
# ==============================================================================
def test_c5_2_10_base_recharge_not_flattened():
    config = FIARegulationConfig(
        name="FIA 2026 Regulations",
        version="Issue 20",
        normal_power_curve={"curve_type": "two_stage_piecewise", "base_power_kw": 350.0},
        overtake_power_curve={"curve_type": "overtake_piecewise", "base_power_kw": 350.0},
    )
    assert config.base_recharge_limit_mj == 8.5
    assert config.conditional_recharge_allowance_mj == 0.5
    # When B7.2 is unconfirmed / default, effective limit is 8.5 MJ, NOT 9.0 MJ
    assert config.get_effective_recharge_limit_mj() == 8.5


# ==============================================================================
# F. Conditional additional recharge requires applicable context
# ==============================================================================
def test_conditional_recharge_requires_applicable_context():
    config = FIARegulationConfig(
        name="FIA 2026 Regulations",
        version="Issue 20",
        normal_power_curve={"curve_type": "two_stage_piecewise", "base_power_kw": 350.0},
        overtake_power_curve={"curve_type": "overtake_piecewise", "base_power_kw": 350.0},
    )
    # 1. Without confirmation: base 8.5 MJ
    assert config.get_effective_recharge_limit_mj(b7_2_applicable=None) == 8.5
    assert config.get_effective_recharge_limit_mj(b7_2_applicable=False) == 8.5

    # 2. When explicitly verified under B7.2: base + allowance = 9.0 MJ
    assert config.get_effective_recharge_limit_mj(b7_2_applicable=True) == 9.0

    # 3. Via configuration flag
    config.b7_2_recharge_allowance_active = True
    assert config.get_effective_recharge_limit_mj() == 9.0


# ==============================================================================
# G. Unsupported future-window thresholds removed and directional logic applied
# ==============================================================================
def test_future_window_directional_logic(sample_battle):
    race, battle, energy = sample_battle
    # BUILD with net surplus under striking distance should be STRONG even if terminal < 2.5 MJ
    rule_check = evaluate_action_rule_check(StrategistAction.BUILD, "1", event_id="2026_01_AUS")
    stability = ActionStabilitySnapshot(verdict="NOT_APPLICABLE", available=True)
    pass_win = PassWindowSnapshot(available=True, p1=0.2, p2=0.4, p3=0.6)

    forecast = simulate_action_forecast(
        action=StrategistAction.BUILD,
        battle_data={"gap_seconds": 0.8, "recent_pace_delta_1lap": -0.1},
        rule_check=rule_check,
        nominal_terminal_energy_mj=2.1,  # Below previous 2.5 MJ threshold
        nominal_net_energy_mj=0.4,       # Positive net recovery surplus
        stability_snapshot=stability,
        pass_window=pass_win,
    )
    # Directional dominance: net surplus + striking distance = STRONG
    assert forecast.future_window_quality == FutureWindowQuality.STRONG


# ==============================================================================
# H. Unknown regulatory context yields UNKNOWN
# ==============================================================================
def test_unknown_regulatory_context_yields_unknown():
    res = evaluate_action_rule_check(
        action=StrategistAction.OVERTAKE,
        track_status="1",
        event_id=None,  # Missing event configuration
    )
    assert res.result == "UNKNOWN"
    assert "EVENT_UNCONFIGURED_COMPLIANCE_UNKNOWN" in res.rule_ids


# ==============================================================================
# I. YELLOW flag does not produce universal BLOCKED without zone context
# ==============================================================================
def test_yellow_flag_context_awareness():
    # 1. Blanket YELLOW without sector info yields UNKNOWN for OVERTAKE
    res_unknown = evaluate_action_rule_check(
        action=StrategistAction.OVERTAKE,
        track_status="2",
        event_id="2026_01_AUS",
    )
    assert res_unknown.result == "UNKNOWN"
    assert "FIA_ISC_APP_H_YELLOW_ZONE_UNSPECIFIED_OVERTAKE_UNKNOWN" in res_unknown.rule_ids

    # 2. Battle within yellow zone is BLOCKED
    res_blocked = evaluate_action_rule_check(
        action=StrategistAction.OVERTAKE,
        track_status="2",
        event_id="2026_01_AUS",
        battle_sector=2,
        yellow_flag_sectors=[2, 3],
    )
    assert res_blocked.result == "BLOCKED"
    assert "FIA_ISC_APP_H_B1.8.4" in res_blocked.rule_ids

    # 3. Battle outside yellow zone is ALLOWED
    res_allowed = evaluate_action_rule_check(
        action=StrategistAction.OVERTAKE,
        track_status="2",
        event_id="2026_01_AUS",
        battle_sector=1,
        yellow_flag_sectors=[2, 3],
    )
    assert res_allowed.result == "ALLOWED"
    assert "FIA_ISC_APP_H_B1.8.4_OUTSIDE_HAZARD_ZONE" in res_allowed.rule_ids


# ==============================================================================
# J. DEPLOY remains semantically independent from OVERTAKE restriction
# ==============================================================================
def test_deploy_remains_independent_from_overtake_restriction():
    # Even when OVERTAKE is blocked under SC/VSC/Yellow, DEPLOY remains ALLOWED
    for ts in ["4", "6", "2"]:
        res_deploy = evaluate_action_rule_check(
            action=StrategistAction.DEPLOY,
            track_status=ts,
            event_id="2026_01_AUS",
            battle_sector=2,
            yellow_flag_sectors=[2],
        )
        assert res_deploy.result == "ALLOWED"


# ==============================================================================
# K. Scenario percentages and forecast deltas tagged CONFIG_ASSUMPTION
# ==============================================================================
def test_scenario_and_forecast_tagged_config_assumption(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    for act_name in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        act = matrix.actions[act_name]
        assert act.forecast.status == "CONFIG_ASSUMPTION"
        assert act.forecast.provenance == "FORECAST_SIMULATION"
        for sc in act.energy_scenarios.values():
            assert sc.status == "CONFIG_ASSUMPTION"
            assert sc.provenance == "CONFIG_ASSUMPTION"
            assert sc.assumption_details is not None
            assert "harvest_multiplier" in sc.assumption_details


# ==============================================================================
# L. Matrix contains all four discrete actions
# ==============================================================================
def test_matrix_contains_all_actions(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert set(matrix.actions.keys()) == {"CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"}


# ==============================================================================
# M. Ranking remains disabled
# ==============================================================================
def test_ranking_disabled(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.ranking["available"] is False
    assert "STRATEGY_RANKING_PENDING_PHASE_08" in matrix.ranking["reason"]


# ==============================================================================
# N. Recommendation remains disabled
# ==============================================================================
def test_recommendation_disabled(sample_battle):
    race, battle, energy = sample_battle
    matrix = generate_strategy_matrix(race, battle, energy)
    assert matrix.recommendation["available"] is False
    assert "STRATEGY_RANKING_PENDING_PHASE_08" in matrix.recommendation["reason"]


# ==============================================================================
# O. All matrix components and actions evaluate stably
# ==============================================================================
def test_matrix_evaluation_stability(sample_battle):
    race, battle, energy = sample_battle
    matrix1 = generate_strategy_matrix(race, battle, energy)
    matrix2 = generate_strategy_matrix(race, battle, energy)
    for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]:
        assert matrix1.actions[act].energy.planned_deployment_mj == matrix2.actions[act].energy.planned_deployment_mj
        assert matrix1.actions[act].forecast.projected_gap_delta == matrix2.actions[act].forecast.projected_gap_delta


# ==============================================================================
# P. Frozen LightGBM model bundle SHA-256 unchanged
# ==============================================================================
def test_frozen_model_sha_intact():
    assert FROZEN_MODEL_PATH.exists()
    computed_sha = hashlib.sha256(FROZEN_MODEL_PATH.read_bytes()).hexdigest()
    assert computed_sha == EXPECTED_MODEL_SHA
