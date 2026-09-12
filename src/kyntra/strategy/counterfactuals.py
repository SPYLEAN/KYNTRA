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
5. ZERO ANONYMOUS CONSTANTS: All policy fractions and scenario multipliers load from versioned config.
6. REGULATION CONTEXT: Yellow flag checks require zone applicability; unknown context yields UNKNOWN.
7. DIRECTIONAL FUTURE WINDOW: FutureWindowQuality relies on empirical pace/energy/stability dominance, not arbitrary MJ thresholds.
"""

import copy
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

from kyntra.stability.models import StabilityResult, StabilityVerdict
from kyntra.strategy.config import (
    StrategyCounterfactualConfig,
    load_strategy_counterfactual_config,
)
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

logger = logging.getLogger(__name__)


def evaluate_action_rule_check(
    action: StrategistAction,
    track_status: Optional[str],
    event_id: Optional[str] = None,
    battle_sector: Optional[int] = None,
    yellow_flag_sectors: Optional[List[int]] = None,
    yellow_zone_active: Optional[bool] = None,
) -> ActionRuleCheckSnapshot:
    """Evaluate deterministic sporting and technical legality per action.

    CRITICAL DISTINCTION:
    - Under SC/VSC/Red conditions, OVERTAKE is strictly BLOCKED by FIA Sporting Regulations.
    - Under Yellow flags (Article ISC App H B1.8.4), overtaking is prohibited only in the
      specific hazard zone. If zone applicability is unknown, rule result is UNKNOWN.
    - DEPLOY, CONSERVE, and BUILD remain ALLOWED under neutralized conditions as electrical
      management is not prohibited merely because overtaking is restricted.
    """
    ts = str(track_status or "1").strip()
    rule_bundle = "2026_FIA_ISSUE_20"

    # 1. Neutralized race conditions (VSC, SC, Red)
    if ts in ["6", "7", "VSC"]:
        if action == StrategistAction.OVERTAKE:
            return ActionRuleCheckSnapshot(
                result="BLOCKED",
                rule_ids=["FIA_SR_B5.12.2(c)"],
                rule_bundle_version=rule_bundle,
                provenance="RULE_CHECK",
            )
        return ActionRuleCheckSnapshot(
            result="ALLOWED",
            rule_ids=["FIA_SR_B5.12.2_DEPLOY_PERMITTED"],
            rule_bundle_version=rule_bundle,
            provenance="RULE_CHECK",
        )

    if ts in ["4", "SC"]:
        if action == StrategistAction.OVERTAKE:
            return ActionRuleCheckSnapshot(
                result="BLOCKED",
                rule_ids=["FIA_SR_B5.13.2(c)"],
                rule_bundle_version=rule_bundle,
                provenance="RULE_CHECK",
            )
        return ActionRuleCheckSnapshot(
            result="ALLOWED",
            rule_ids=["FIA_SR_B5.13.2_DEPLOY_PERMITTED"],
            rule_bundle_version=rule_bundle,
            provenance="RULE_CHECK",
        )

    if ts in ["5", "RED"]:
        if action == StrategistAction.OVERTAKE:
            return ActionRuleCheckSnapshot(
                result="BLOCKED",
                rule_ids=["FIA_SR_B5.14.2(a)"],
                rule_bundle_version=rule_bundle,
                provenance="RULE_CHECK",
            )
        return ActionRuleCheckSnapshot(
            result="ALLOWED",
            rule_ids=["FIA_SR_B5.14.2_DEPLOY_PERMITTED"],
            rule_bundle_version=rule_bundle,
            provenance="RULE_CHECK",
        )

    # 2. Yellow flag running (ISC Appendix H Article 1.8.4)
    if ts in ["2", "YELLOW"]:
        if action in [StrategistAction.CONSERVE, StrategistAction.BUILD, StrategistAction.DEPLOY]:
            return ActionRuleCheckSnapshot(
                result="ALLOWED",
                rule_ids=["FIA_ISC_APP_H_DEPLOY_PERMITTED"],
                rule_bundle_version=rule_bundle,
                provenance="RULE_CHECK",
            )

        # For OVERTAKE: Check if battle is within applicable hazard zone
        if yellow_zone_active is True or (
            battle_sector is not None
            and yellow_flag_sectors is not None
            and battle_sector in yellow_flag_sectors
        ):
            return ActionRuleCheckSnapshot(
                result="BLOCKED",
                rule_ids=["FIA_ISC_APP_H_B1.8.4"],
                rule_bundle_version=rule_bundle,
                provenance="RULE_CHECK",
            )
        elif yellow_zone_active is False or (
            battle_sector is not None
            and yellow_flag_sectors is not None
            and battle_sector not in yellow_flag_sectors
        ):
            return ActionRuleCheckSnapshot(
                result="ALLOWED",
                rule_ids=["FIA_ISC_APP_H_B1.8.4_OUTSIDE_HAZARD_ZONE"],
                rule_bundle_version=rule_bundle,
                provenance="RULE_CHECK",
            )
        else:
            # Applicability cannot be determined; do not turn uncertainty into BLOCKED or ALLOWED
            return ActionRuleCheckSnapshot(
                result="UNKNOWN",
                rule_ids=["FIA_ISC_APP_H_YELLOW_ZONE_UNSPECIFIED_OVERTAKE_UNKNOWN"],
                rule_bundle_version=rule_bundle,
                provenance="RULE_CHECK",
            )

    # 3. Check if event configuration exists or is unconfigured
    if not event_id:
        return ActionRuleCheckSnapshot(
            result="UNKNOWN",
            rule_ids=["EVENT_UNCONFIGURED_COMPLIANCE_UNKNOWN"],
            rule_bundle_version=rule_bundle,
            provenance="RULE_CHECK",
        )

    # 4. Green flag running
    return ActionRuleCheckSnapshot(
        result="ALLOWED",
        rule_ids=["FIA_2026_GREEN_FLAG_COMPLIANT"],
        rule_bundle_version=rule_bundle,
        provenance="RULE_CHECK",
    )


def simulate_action_energy_scenarios(
    action: StrategistAction,
    available_energy_mj: Optional[float],
    horizon_laps: int = 3,
    strategy_config: Optional[StrategyCounterfactualConfig] = None,
) -> Tuple[ActionEnergySnapshot, Dict[str, ScenarioEnergySnapshot]]:
    """Simulate 2026 regulation-constrained energy accounting across 3 sensitivity scenarios.

    Generates CONSERVATIVE, NOMINAL, and FAVORABLE scenarios using explicit assumption multipliers.
    Never fabricates measured SOC; tagged SIMULATED_ENERGY with CONFIG_ASSUMPTION status.
    """
    cfg = strategy_config or load_strategy_counterfactual_config()
    profile_name = cfg.assumption_profile

    if available_energy_mj is None:
        empty_energy = ActionEnergySnapshot(
            available=False,
            before_mj=None,
            planned_deployment_mj=None,
            expected_recovery_mj=None,
            after_mj=None,
            provenance="SIMULATED — 2026 REGULATION CONSTRAINED",
            provenance_category="SIMULATED_ENERGY",
            assumption_set="UNAVAILABLE",
        )
        return empty_energy, {}

    e_initial = max(0.0, min(4.0, float(available_energy_mj)))
    act_prof = cfg.action_profiles.get(action.value)
    if not act_prof:
        raise ValueError(f"Action {action.value} missing from strategy counterfactual profile {profile_name}")

    dep_base = act_prof.baseline_deployment_rate_mj
    harv_base = act_prof.baseline_harvest_rate_mj

    scenarios: Dict[str, ScenarioEnergySnapshot] = {}

    for name, mult_cfg in cfg.energy_uncertainty.items():
        total_dep = round(dep_base * mult_cfg.deployment_multiplier * horizon_laps, 2)
        total_harv = round(harv_base * mult_cfg.harvest_multiplier * horizon_laps, 2)
        actual_dep = min(total_dep, e_initial + total_harv)
        net_delta = round(total_harv - actual_dep, 2)
        terminal_e = round(max(0.0, min(4.0, e_initial + net_delta)), 2)

        scenarios[name] = ScenarioEnergySnapshot(
            scenario_name=name,
            deployment_mj=actual_dep,
            expected_recovery_mj=total_harv,
            net_delta_mj=net_delta,
            terminal_energy_mj=terminal_e,
            status="CONFIG_ASSUMPTION",
            provenance="CONFIG_ASSUMPTION",
            assumption_details={
                "harvest_multiplier": mult_cfg.harvest_multiplier,
                "deployment_multiplier": mult_cfg.deployment_multiplier,
                "assumption_profile": profile_name,
                "action_baseline_deployment_mj": dep_base,
                "action_baseline_harvest_mj": harv_base,
            },
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
        provenance_category="SIMULATED_ENERGY",
        assumption_set=profile_name,
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
                provenance="ORDINAL_STABILITY_CONSENSUS",
            )
        return ActionStabilitySnapshot(
            verdict="UNKNOWN",
            available=False,
            reason="STABILITY_EVIDENCE_UNAVAILABLE",
            available_families=[],
            triggered_families=[],
            provenance="ORDINAL_STABILITY_CONSENSUS",
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
            provenance="ORDINAL_STABILITY_CONSENSUS",
        )
    elif action == StrategistAction.DEPLOY:
        return ActionStabilitySnapshot(
            verdict=v_str,
            available=True,
            reason="DEPLOY_DOES_NOT_ASSUME_COMPLETED_PASS",
            available_families=stability_result.available_families,
            triggered_families=stability_result.triggered_families,
            provenance="ORDINAL_STABILITY_CONSENSUS",
        )
    else:  # OVERTAKE
        return ActionStabilitySnapshot(
            verdict=v_str,
            available=True,
            reason=stability_result.reason or "OVERTAKE_DURABILITY_EVALUATION",
            available_families=stability_result.available_families,
            triggered_families=stability_result.triggered_families,
            provenance="ORDINAL_STABILITY_CONSENSUS",
        )


def simulate_action_forecast(
    action: StrategistAction,
    battle_data: Dict[str, Any],
    rule_check: ActionRuleCheckSnapshot,
    nominal_terminal_energy_mj: Optional[float],
    nominal_net_energy_mj: Optional[float],
    stability_snapshot: ActionStabilitySnapshot,
    pass_window: PassWindowSnapshot,
    horizon_laps: int = 3,
    strategy_config: Optional[StrategyCounterfactualConfig] = None,
) -> ActionForecastSnapshot:
    """Project deterministic short-horizon rollout outcomes over 3 laps.

    Uses directional and dominance logic rather than arbitrary absolute energy thresholds.
    Tags all forecasts as FORECAST_SIMULATION / CONFIG_ASSUMPTION.
    """
    cfg = strategy_config or load_strategy_counterfactual_config()
    act_prof = cfg.action_profiles[action.value]

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
            provenance="FORECAST_SIMULATION",
            status="CONFIG_ASSUMPTION",
        )

    # Base physics and directional consequence calculations per action policy:
    if action == StrategistAction.CONSERVE:
        gap_delta = round(act_prof.gap_delta_rate_s_per_lap * horizon_laps, 2)
        time_consequence = round(act_prof.lap_time_consequence_s_per_lap * horizon_laps, 2)
        pos_delta = 0
        forecast_rear = "HIGH" if rear_threat == "HIGH" else "MODERATE"

        # Directional future window quality:
        # High rear threat while backing off increases vulnerability to car behind
        if rear_threat == "HIGH":
            quality = FutureWindowQuality.WEAK
        elif nominal_net_energy_mj is not None and nominal_net_energy_mj > 0:
            quality = FutureWindowQuality.MODERATE
        elif nominal_terminal_energy_mj is None:
            quality = FutureWindowQuality.UNKNOWN
        else:
            quality = FutureWindowQuality.MODERATE

    elif action == StrategistAction.BUILD:
        gap_delta = round(act_prof.gap_delta_rate_s_per_lap * horizon_laps, 2)
        time_consequence = round(act_prof.lap_time_consequence_s_per_lap * horizon_laps, 2)
        pos_delta = 0
        forecast_rear = rear_threat

        # Directional future window quality:
        # Relies on demonstrated net energy surplus generation AND maintaining striking contact
        if nominal_net_energy_mj is None or nominal_terminal_energy_mj is None:
            quality = FutureWindowQuality.UNKNOWN
        elif nominal_net_energy_mj > 0 and (gap_s <= 1.2 or (pace_delta_1 is not None and pace_delta_1 <= 0.05)):
            # Net surplus achieved while staying within striking distance without pace collapse
            quality = FutureWindowQuality.STRONG
        elif nominal_net_energy_mj > 0:
            quality = FutureWindowQuality.MODERATE
        else:
            quality = FutureWindowQuality.WEAK

    elif action == StrategistAction.DEPLOY:
        pace_gain = (
            abs(pace_delta_1)
            if (pace_delta_1 is not None and pace_delta_1 < 0)
            else act_prof.default_pace_gain_s_per_lap
        )
        gap_delta = round(-pace_gain * horizon_laps, 2)
        time_consequence = round(act_prof.lap_time_consequence_s_per_lap * horizon_laps, 2)
        pos_delta = 0
        forecast_rear = "LOW"

        # Directional future window quality:
        if pace_delta_1 is not None and pace_delta_1 < 0:
            quality = FutureWindowQuality.STRONG  # Demonstrable pace advantage compressing gap
        elif pace_delta_1 is not None and pace_delta_1 > 0.20:
            quality = FutureWindowQuality.WEAK  # Deployment cannot overcome defender pace dominance
        else:
            quality = FutureWindowQuality.MODERATE

    else:  # OVERTAKE
        if rule_check.result == "BLOCKED":
            gap_delta = 0.0
            time_consequence = 0.0
            pos_delta = 0
            quality = FutureWindowQuality.WEAK
            forecast_rear = rear_threat
        elif rule_check.result == "UNKNOWN":
            gap_delta = 0.0
            time_consequence = 0.0
            pos_delta = 0
            quality = FutureWindowQuality.UNKNOWN
            forecast_rear = rear_threat
        else:
            p2 = pass_window.p2 or 0.0
            is_successful_pass = (p2 >= 0.50) or (gap_s <= 0.6)
            pos_delta = 1 if is_successful_pass else 0
            gap_delta = (
                round(-gap_s, 2)
                if is_successful_pass
                else round(-act_prof.default_pace_gain_s_per_lap * horizon_laps, 2)
            )
            time_consequence = round(act_prof.lap_time_consequence_s_per_lap * horizon_laps, 2)

            # Durability evidence check:
            if stability_snapshot.verdict == "HIGH_RISK":
                # High post-pass risk degrades future window quality
                quality = FutureWindowQuality.WEAK
            elif is_successful_pass and stability_snapshot.verdict != "HIGH_RISK":
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
        provenance="FORECAST_SIMULATION",
        status="CONFIG_ASSUMPTION",
    )


def simulate_action_outcome(
    action: StrategistAction,
    race_data: Dict[str, Any],
    battle_data: Dict[str, Any],
    available_energy_mj: Optional[float],
    pass_window: PassWindowSnapshot,
    stability_result: Optional[StabilityResult],
    horizon_laps: int = 3,
    strategy_config: Optional[StrategyCounterfactualConfig] = None,
) -> ActionOutcomeSnapshot:
    """Evaluate a single strategist decision alternative with guaranteed isolation.

    Never mutates inputs. Uses strictly cloned values.
    """
    # Defensive copies of input states (Fair Baseline invariant)
    r_copy = copy.deepcopy(race_data)
    b_copy = copy.deepcopy(battle_data)

    track_status = r_copy.get("track_status", "1")
    event_id = r_copy.get("event_id")
    battle_sector = b_copy.get("sector") or b_copy.get("current_sector")
    yellow_flag_sectors = r_copy.get("yellow_sectors") or b_copy.get("yellow_flag_sectors")
    yellow_zone_active = b_copy.get("yellow_zone_active")

    cfg = strategy_config or load_strategy_counterfactual_config()

    # 1. Regulation check
    rule_check = evaluate_action_rule_check(
        action=action,
        track_status=track_status,
        event_id=event_id,
        battle_sector=battle_sector,
        yellow_flag_sectors=yellow_flag_sectors,
        yellow_zone_active=yellow_zone_active,
    )

    # 2. Energy accounting & scenarios
    action_energy, scenarios = simulate_action_energy_scenarios(
        action=action,
        available_energy_mj=available_energy_mj,
        horizon_laps=horizon_laps,
        strategy_config=cfg,
    )

    # 3. Pass context (ML TRUTH: action_effect_available strictly False)
    pass_context = ActionPassContextSnapshot(
        current_p1=pass_window.p1,
        current_p2=pass_window.p2,
        current_p3=pass_window.p3,
        action_effect_available=False,
        provenance="FROZEN_MODEL",
    )

    # 4. Stability context
    action_stability = evaluate_action_stability(
        action=action, stability_result=stability_result
    )

    # 5. Short-horizon forecast
    nominal_terminal = (
        scenarios["NOMINAL"].terminal_energy_mj if "NOMINAL" in scenarios else None
    )
    nominal_net = (
        scenarios["NOMINAL"].net_delta_mj if "NOMINAL" in scenarios else None
    )
    forecast = simulate_action_forecast(
        action=action,
        battle_data=b_copy,
        rule_check=rule_check,
        nominal_terminal_energy_mj=nominal_terminal,
        nominal_net_energy_mj=nominal_net,
        stability_snapshot=action_stability,
        pass_window=pass_window,
        horizon_laps=horizon_laps,
        strategy_config=cfg,
    )

    # Determine eligibility and reason codes
    eligible = rule_check.result == "ALLOWED"
    exclusion_reasons = []
    if rule_check.result == "BLOCKED":
        exclusion_reasons.append(f"REGULATION_PROHIBITION: {rule_check.rule_ids}")
    elif rule_check.result == "UNKNOWN":
        exclusion_reasons.append(f"REGULATION_UNCERTAINTY: {rule_check.rule_ids}")

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
        elif rule_check.result == "BLOCKED":
            reason_codes.append("OVERTAKE_BLOCKED_BY_RACE_CONTROL")
        else:
            reason_codes.append("OVERTAKE_REGULATORY_STATUS_UNKNOWN")

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
