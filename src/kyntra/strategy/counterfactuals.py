"""Deterministic counterfactual action simulators for the KYNTRA Strategist Matrix.

Evaluates four candidate strategist decision alternatives from the EXACT SAME source state:
- CONSERVE: Minimize deployment, harvest reserves, accept current track position.
- BUILD: Controlled preparation, create net energy surplus for future attack window.
- DEPLOY: Tactical electrical deployment to pressure or defend, no completed pass assumed.
- OVERTAKE: Commit to available pass opportunity, requires regulatory clearance & evaluates durability.

STRICT INVARIANTS:
1. FAIR BASELINE: Action simulators NEVER mutate shared source state.
2. ML TRUTH: Does NOT fabricate action-conditioned P1/P2/P3 probabilities.
3. PROVENANCE: Energy is SIMULATED, never labeled as measured SOC.
4. STABILITY: Reuses Stability V1 consensus verdicts without emitting FAVORABLE.
"""

import copy
import math
from typing import Any, Dict, List, Optional, Tuple

from kyntra.schemas import ComplianceSnapshot
from kyntra.stability.models import StabilityResult, StabilityVerdict
from kyntra.strategy.models import (
    ActionEnergySnapshot,
    ActionForecastSnapshot,
    ActionOutcomeSnapshot,
    ActionPassContextSnapshot,
    ActionRuleCheckSnapshot,
    ActionStabilitySnapshot,
    FutureWindowQuality,
    PassWindowSnapshot,
    ScenarioEnergySnapshot,
    StrategistAction,
)


def evaluate_action_rule_check(
    action: StrategistAction,
    track_status: Optional[str],
    event_id: Optional[str] = None,
) -> ActionRuleCheckSnapshot:
    """Evaluate deterministic sporting and technical legality per action.
    
    CRITICAL DISTINCTION:
    Under SC/VSC/Yellow/Red conditions, OVERTAKE is strictly BLOCKED by FIA Sporting Regulations.
    However, electrical DEPLOY, CONSERVE, and BUILD are NOT prohibited merely because overtaking is blocked.
    """
    ts = str(track_status or "1").strip()
    rule_bundle = "2026_FIA_ISSUE_20"

    # 1. Neutralized race conditions (VSC, SC, Red, Yellow)
    if ts in ["6", "7", "VSC"]:
        if action == StrategistAction.OVERTAKE:
            return ActionRuleCheckSnapshot(
                result="BLOCKED",
                rule_ids=["FIA_SR_B5.12.2(c)"],
                rule_bundle_version=rule_bundle,
            )
        return ActionRuleCheckSnapshot(
            result="ALLOWED",
            rule_ids=["FIA_SR_B5.12.2_DEPLOY_PERMITTED"],
            rule_bundle_version=rule_bundle,
        )

    if ts in ["4", "SC"]:
        if action == StrategistAction.OVERTAKE:
            return ActionRuleCheckSnapshot(
                result="BLOCKED",
                rule_ids=["FIA_SR_B5.13.2(c)"],
                rule_bundle_version=rule_bundle,
            )
        return ActionRuleCheckSnapshot(
            result="ALLOWED",
            rule_ids=["FIA_SR_B5.13.2_DEPLOY_PERMITTED"],
            rule_bundle_version=rule_bundle,
        )

    if ts in ["5", "RED"]:
        if action == StrategistAction.OVERTAKE:
            return ActionRuleCheckSnapshot(
                result="BLOCKED",
                rule_ids=["FIA_SR_B5.14.2(a)"],
                rule_bundle_version=rule_bundle,
            )
        return ActionRuleCheckSnapshot(
            result="ALLOWED",
            rule_ids=["FIA_SR_B5.14.2_DEPLOY_PERMITTED"],
            rule_bundle_version=rule_bundle,
        )

    if ts in ["2", "YELLOW"]:
        if action == StrategistAction.OVERTAKE:
            return ActionRuleCheckSnapshot(
                result="BLOCKED",
                rule_ids=["FIA_ISC_APP_H_B1.8.4"],
                rule_bundle_version=rule_bundle,
            )
        return ActionRuleCheckSnapshot(
            result="ALLOWED",
            rule_ids=["FIA_ISC_APP_H_DEPLOY_PERMITTED"],
            rule_bundle_version=rule_bundle,
        )

    # 2. Check if event configuration exists or is unconfigured
    if not event_id:
        return ActionRuleCheckSnapshot(
            result="UNKNOWN",
            rule_ids=["EVENT_UNCONFIGURED_COMPLIANCE_UNKNOWN"],
            rule_bundle_version=rule_bundle,
        )

    # 3. Green flag running
    return ActionRuleCheckSnapshot(
        result="ALLOWED",
        rule_ids=["FIA_2026_GREEN_FLAG_COMPLIANT"],
        rule_bundle_version=rule_bundle,
    )


def simulate_action_energy_scenarios(
    action: StrategistAction,
    available_energy_mj: Optional[float],
    horizon_laps: int = 3,
) -> Tuple[ActionEnergySnapshot, Dict[str, ScenarioEnergySnapshot]]:
    """Simulate 2026 regulation-constrained energy accounting across 3 assumption sets.
    
    Generates CONSERVATIVE, NOMINAL, and FAVORABLE scenarios.
    Never fabricates measured SOC; tagged SIMULATED — 2026 REGULATION CONSTRAINED.
    """
    if available_energy_mj is None:
        empty_energy = ActionEnergySnapshot(
            available=False,
            before_mj=None,
            planned_deployment_mj=None,
            expected_recovery_mj=None,
            after_mj=None,
            provenance="SIMULATED — 2026 REGULATION CONSTRAINED",
            assumption_set="UNAVAILABLE",
        )
        return empty_energy, {}

    e_initial = max(0.0, min(4.0, float(available_energy_mj)))

    # Per-lap baseline deployment & recovery rates under 2026 MGU-K ceilings (Article C5.2.7 & C5.2.9)
    # Scaled by action policy fractions:
    # CONSERVE: low deploy (0.20), steady harvest
    # BUILD: moderate deploy (0.55), high harvest focus
    # DEPLOY: full normal curve (1.00), standard harvest
    # OVERTAKE: override boost (1.00 override), reduced regenerative coasting
    base_deploy_rates = {
        StrategistAction.CONSERVE: 0.40,
        StrategistAction.BUILD: 0.95,
        StrategistAction.DEPLOY: 1.65,
        StrategistAction.OVERTAKE: 2.30,
    }
    base_harvest_rates = {
        StrategistAction.CONSERVE: 1.25,
        StrategistAction.BUILD: 1.35,
        StrategistAction.DEPLOY: 1.20,
        StrategistAction.OVERTAKE: 1.10,
    }

    dep_base = base_deploy_rates[action]
    harv_base = base_harvest_rates[action]

    # Three assumption cases:
    # CONSERVATIVE: harvest -20%, deploy +10%
    # NOMINAL: baseline
    # FAVORABLE: harvest +20%, deploy -10%
    scenario_configs = {
        "CONSERVATIVE": {"dep_mult": 1.10, "harv_mult": 0.80},
        "NOMINAL": {"dep_mult": 1.00, "harv_mult": 1.00},
        "FAVORABLE": {"dep_mult": 0.90, "harv_mult": 1.20},
    }

    scenarios: Dict[str, ScenarioEnergySnapshot] = {}

    for name, cfg in scenario_configs.items():
        total_dep = round(dep_base * cfg["dep_mult"] * horizon_laps, 2)
        total_harv = round(harv_base * cfg["harv_mult"] * horizon_laps, 2)
        # Cap deployment by available energy + recovery
        actual_dep = min(total_dep, e_initial + total_harv)
        net_delta = round(total_harv - actual_dep, 2)
        terminal_e = round(max(0.0, min(4.0, e_initial + net_delta)), 2)

        scenarios[name] = ScenarioEnergySnapshot(
            scenario_name=name,
            deployment_mj=actual_dep,
            expected_recovery_mj=total_harv,
            net_delta_mj=net_delta,
            terminal_energy_mj=terminal_e,
        )

    # 1-lap planned step for immediate ActionEnergySnapshot
    step_dep = round(min(dep_base, e_initial), 2)
    step_harv = round(harv_base, 2)
    step_after = round(max(0.0, min(4.0, e_initial + step_harv - step_dep)), 2)

    action_energy = ActionEnergySnapshot(
        available=True,
        before_mj=round(e_initial, 2),
        planned_deployment_mj=step_dep,
        expected_recovery_mj=step_harv,
        after_mj=step_after,
        provenance="SIMULATED — 2026 REGULATION CONSTRAINED",
        assumption_set="FIA_2026_MGU_K_DEFAULT",
    )

    return action_energy, scenarios


def evaluate_action_stability(
    action: StrategistAction,
    stability_result: Optional[StabilityResult],
) -> ActionStabilitySnapshot:
    """Map post-pass durability context to candidate action.
    
    CONSERVE and BUILD do not gain track position, so post-pass durability is NOT_APPLICABLE.
    OVERTAKE commits to a pass attempt, requiring full durability evaluation.
    DEPLOY applies pressure without assuming a completed pass.
    """
    if stability_result is None or not stability_result.available:
        if action in [StrategistAction.CONSERVE, StrategistAction.BUILD]:
            return ActionStabilitySnapshot(
                verdict="NOT_APPLICABLE",
                available=True,
                reason="ACTION_DOES_NOT_GAIN_POSITION",
                available_families=[],
                triggered_families=[],
            )
        return ActionStabilitySnapshot(
            verdict="UNKNOWN",
            available=False,
            reason="STABILITY_EVIDENCE_UNAVAILABLE",
            available_families=[],
            triggered_families=[],
        )

    v_str = (
        stability_result.verdict.value
        if hasattr(stability_result.verdict, "value")
        else str(stability_result.verdict)
    )

    if action in [StrategistAction.CONSERVE, StrategistAction.BUILD]:
        return ActionStabilitySnapshot(
            verdict="NOT_APPLICABLE",
            available=True,
            reason="ACTION_DOES_NOT_GAIN_POSITION",
            available_families=stability_result.available_families,
            triggered_families=stability_result.triggered_families,
        )
    elif action == StrategistAction.DEPLOY:
        return ActionStabilitySnapshot(
            verdict=v_str,
            available=True,
            reason="DEPLOY_DOES_NOT_ASSUME_COMPLETED_PASS",
            available_families=stability_result.available_families,
            triggered_families=stability_result.triggered_families,
        )
    else:  # OVERTAKE
        return ActionStabilitySnapshot(
            verdict=v_str,
            available=True,
            reason=stability_result.reason or "OVERTAKE_DURABILITY_EVALUATION",
            available_families=stability_result.available_families,
            triggered_families=stability_result.triggered_families,
        )


def simulate_action_forecast(
    action: StrategistAction,
    battle_data: Dict[str, Any],
    rule_check: ActionRuleCheckSnapshot,
    nominal_terminal_energy_mj: Optional[float],
    stability_snapshot: ActionStabilitySnapshot,
    pass_window: PassWindowSnapshot,
    horizon_laps: int = 3,
) -> ActionForecastSnapshot:
    """Project deterministic short-horizon rollout outcomes over 3 laps.
    
    Projects gap trend, future window quality, and lap time consequences.
    """
    gap_s = battle_data.get("gap_seconds")
    pace_delta_1 = battle_data.get("recent_pace_delta_1lap")
    rear_threat = battle_data.get("rear_threat", "LOW")

    if gap_s is None:
        return ActionForecastSnapshot(
            available=False,
            horizon_laps=horizon_laps,
            projected_position_delta=None,
            projected_gap_delta=None,
            cumulative_lap_time_consequence_s=None,
            future_window_quality=FutureWindowQuality.UNKNOWN,
            rear_threat=rear_threat,
            terminal_energy_mj=nominal_terminal_energy_mj,
        )

    # Base physics assumptions per action policy:
    if action == StrategistAction.CONSERVE:
        # Attacker backs off by ~0.25s per lap to harvest energy
        gap_delta = round(0.25 * horizon_laps, 2)
        time_consequence = round(+0.30 * horizon_laps, 2)
        pos_delta = 0
        quality = FutureWindowQuality.MODERATE
        # Backing off slightly increases vulnerability to car behind if threat was already HIGH
        forecast_rear = "HIGH" if rear_threat == "HIGH" else "MODERATE"

    elif action == StrategistAction.BUILD:
        # Attacker maintains contact without overspending (~0.0s gap delta, harvests energy)
        gap_delta = 0.0
        time_consequence = round(+0.05 * horizon_laps, 2)
        pos_delta = 0
        # BUILD creates a potent future attack window once battery is charged
        quality = (
            FutureWindowQuality.STRONG
            if (nominal_terminal_energy_mj is not None and nominal_terminal_energy_mj >= 2.5)
            else FutureWindowQuality.MODERATE
        )
        forecast_rear = rear_threat

    elif action == StrategistAction.DEPLOY:
        # Tactical deployment closes gap based on pace delta
        pace_gain = abs(pace_delta_1) if (pace_delta_1 is not None and pace_delta_1 < 0) else 0.15
        gap_delta = round(-pace_gain * horizon_laps, 2)
        time_consequence = round(-0.20 * horizon_laps, 2)
        pos_delta = 0
        quality = FutureWindowQuality.MODERATE
        forecast_rear = "LOW" if rear_threat != "HIGH" else "LOW"

    else:  # OVERTAKE
        if rule_check.result == "BLOCKED":
            # Cannot gain position if blocked by regulation
            gap_delta = 0.0
            time_consequence = 0.0
            pos_delta = 0
            quality = FutureWindowQuality.WEAK
            forecast_rear = rear_threat
        else:
            # If eligible and pass window exists
            p2 = pass_window.p2 or 0.0
            is_successful_pass = (p2 >= 0.50) or (gap_s <= 0.6)
            pos_delta = 1 if is_successful_pass else 0
            gap_delta = round(-gap_s, 2) if is_successful_pass else round(-0.15 * horizon_laps, 2)
            time_consequence = round(-0.35 * horizon_laps, 2)

            if stability_snapshot.verdict == "HIGH_RISK":
                # High risk of repass degrades future window quality
                quality = FutureWindowQuality.WEAK
            elif is_successful_pass:
                quality = FutureWindowQuality.STRONG
            else:
                quality = FutureWindowQuality.MODERATE
            forecast_rear = "LOW"

    return ActionForecastSnapshot(
        available=True,
        horizon_laps=horizon_laps,
        projected_position_delta=pos_delta,
        projected_gap_delta=gap_delta,
        cumulative_lap_time_consequence_s=time_consequence,
        future_window_quality=quality,
        rear_threat=forecast_rear,
        terminal_energy_mj=nominal_terminal_energy_mj,
    )


def simulate_action_outcome(
    action: StrategistAction,
    race_data: Dict[str, Any],
    battle_data: Dict[str, Any],
    available_energy_mj: Optional[float],
    pass_window: PassWindowSnapshot,
    stability_result: Optional[StabilityResult],
    horizon_laps: int = 3,
) -> ActionOutcomeSnapshot:
    """Evaluate a single strategist decision alternative with guaranteed isolation.
    
    Never mutates inputs. Uses strictly cloned values.
    """
    # Defensive copies of input states (Fair Baseline invariant)
    r_copy = copy.deepcopy(race_data)
    b_copy = copy.deepcopy(battle_data)

    track_status = r_copy.get("track_status", "1")
    event_id = r_copy.get("event_id")

    # 1. Regulation check
    rule_check = evaluate_action_rule_check(
        action=action, track_status=track_status, event_id=event_id
    )

    # 2. Energy accounting & scenarios
    action_energy, scenarios = simulate_action_energy_scenarios(
        action=action,
        available_energy_mj=available_energy_mj,
        horizon_laps=horizon_laps,
    )

    # 3. Pass context (ML TRUTH: action_effect_available strictly False)
    pass_context = ActionPassContextSnapshot(
        current_p1=pass_window.p1,
        current_p2=pass_window.p2,
        current_p3=pass_window.p3,
        action_effect_available=False,
    )

    # 4. Stability context
    action_stability = evaluate_action_stability(
        action=action, stability_result=stability_result
    )

    # 5. Short-horizon forecast
    nominal_terminal = (
        scenarios["NOMINAL"].terminal_energy_mj if "NOMINAL" in scenarios else None
    )
    forecast = simulate_action_forecast(
        action=action,
        battle_data=b_copy,
        rule_check=rule_check,
        nominal_terminal_energy_mj=nominal_terminal,
        stability_snapshot=action_stability,
        pass_window=pass_window,
        horizon_laps=horizon_laps,
    )

    # Determine eligibility and reason codes
    eligible = rule_check.result != "BLOCKED"
    exclusion_reasons = []
    if not eligible:
        exclusion_reasons.append(f"REGULATION_PROHIBITION: {rule_check.rule_ids}")

    reason_codes = []
    if action == StrategistAction.CONSERVE:
        reason_codes.append("ENERGY_PRESERVATION_PRIORITY")
    elif action == StrategistAction.BUILD:
        reason_codes.append("PREPARE_ATTACK_WINDOW")
    elif action == StrategistAction.DEPLOY:
        reason_codes.append("TACTICAL_PRESSURE_APPLICATION")
    elif action == StrategistAction.OVERTAKE:
        if eligible:
            reason_codes.append("COMMIT_TO_PASS_WINDOW")
        else:
            reason_codes.append("OVERTAKE_BLOCKED_BY_RACE_CONTROL")

    return ActionOutcomeSnapshot(
        action=action,
        available=True,
        eligible=eligible,
        exclusion_reasons=exclusion_reasons,
        rule_check=rule_check,
        energy=action_energy,
        pass_context=pass_context,
        stability=action_stability,
        forecast=forecast,
        energy_scenarios=scenarios,
        robustness="NOT_EVALUATED",
        reason_codes=reason_codes,
        provenance="FORECAST_SIMULATION",
    )
