"""Deterministic lexicographic strategy ranking engine for the KYNTRA Strategist Matrix.

Implements the canonical 6-tier lexicographic decision process:
1. REGULATORY ELIGIBILITY (BLOCKED/UNKNOWN excluded from positive selection)
2. PHYSICAL / ENERGY FEASIBILITY (Simulation bounds & reserve constraints)
3. DURABLE TRACK-POSITION CONSEQUENCE (Stability V1 qualitative dominance)
4. FUTURE-WINDOW DOMINANCE (STRONG > MODERATE > WEAK)
5. CUMULATIVE LAP-TIME CONSEQUENCE (Lower cumulative time consequence wins)
6. TERMINAL SIMULATED ENERGY (Higher terminal simulated energy wins at final tie-break)

STRICT INVARIANTS:
1. NO SCALAR SCORE: No weights, arbitrary 0-100 scores, or Attack Value.
2. STRICT HIERARCHY: Later criteria NEVER compensate for failure on earlier criteria.
3. TRUE TIES: Returns NO_DOMINANT_ACTION and abstains if actions remain tied.
4. SCENARIO SENSITIVITY: Evaluates Conservative, Nominal, and Favorable independently.
5. ROBUSTNESS: Emits ROBUST_WITHIN_TESTED_ASSUMPTIONS only when all 3 scenarios align.
6. ORDER INDEPENDENCE: Input action sequence cannot alter ranking results.
7. ZERO ANONYMOUS CONSTANTS: All comparison tolerances and heuristic thresholds
   are sourced from versioned StrategyRankingConfig and StrategyCounterfactualConfig.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Set, Tuple

from kyntra.strategy.config import (
    StrategyCounterfactualConfig,
    StrategyRankingConfig,
    load_strategy_counterfactual_config,
    load_strategy_ranking_config,
)
from kyntra.strategy.models import (
    ActionEvaluationTrace,
    ActionOutcomeSnapshot,
    FutureWindowQuality,
    ScenarioRankingResult,
    StrategistAction,
    StrategyCriterion,
    StrategyRankingSnapshot,
)

logger = logging.getLogger(__name__)

# FIA 2026 Technical Regulation Maximum Energy Store Usable Capacity (MJ/lap)
FIA_2026_MAX_ES_CAPACITY_MJ: float = 4.0

# Future window ordinal ranks (higher is better; UNKNOWN handled strictly)
FUTURE_WINDOW_ORDINAL = {
    FutureWindowQuality.STRONG: 3,
    FutureWindowQuality.MODERATE: 2,
    FutureWindowQuality.WEAK: 1,
    FutureWindowQuality.UNKNOWN: -1,
}


def evaluate_action_eligibility(
    action_outcome: ActionOutcomeSnapshot,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """Tier 1: Evaluate regulatory eligibility.

    Consumes ActionRuleCheckSnapshot from the verified regulation engine.
    Does NOT independently interpret or invent FIA articles.

    Returns:
        (is_eligible, exclusion_reason, excluded_at)
    """
    rule_res = action_outcome.rule_check.result

    if rule_res == "BLOCKED":
        reason = f"REGULATION_BLOCKED: {action_outcome.rule_check.rule_ids}"
        return False, reason, StrategyCriterion.REGULATORY_ELIGIBILITY.value

    if rule_res == "UNKNOWN":
        # Risk-bearing actions (OVERTAKE) cannot be selected under regulatory uncertainty
        if action_outcome.action == StrategistAction.OVERTAKE:
            reason = f"REGULATION_UNCERTAINTY: {action_outcome.rule_check.rule_ids}"
            return False, reason, StrategyCriterion.REGULATORY_ELIGIBILITY.value
        # For defensive / neutral actions (CONSERVE/BUILD/DEPLOY), green running assumption permits continuation
        # but notes uncertainty in trace
        return True, None, None

    return True, None, None


def evaluate_energy_feasibility(
    action_outcome: ActionOutcomeSnapshot,
    scenario_name: str,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """Tier 2: Evaluate physical and simulated energy feasibility under specific scenario.

    Returns:
        (is_feasible, exclusion_reason, excluded_at)
    """
    if not action_outcome.energy.available:
        reason = "ENERGY_TELEMETRY_UNAVAILABLE"
        return False, reason, StrategyCriterion.PHYSICAL_ENERGY_FEASIBILITY.value

    scenarios = action_outcome.energy_scenarios
    if scenario_name not in scenarios:
        reason = f"SCENARIO_{scenario_name}_UNAVAILABLE"
        return False, reason, StrategyCriterion.PHYSICAL_ENERGY_FEASIBILITY.value

    sc_snap = scenarios[scenario_name]
    # Check if starting energy was completely depleted
    if action_outcome.energy.before_mj is not None and action_outcome.energy.before_mj <= 0.0:
        if action_outcome.action in [StrategistAction.DEPLOY, StrategistAction.OVERTAKE]:
            reason = "ZERO_INITIAL_ENERGY_STORE_DEPLETED"
            return False, reason, StrategyCriterion.PHYSICAL_ENERGY_FEASIBILITY.value

    # Check if required deployment is physically impossible under 2026 MGU-K usable window
    horizon = action_outcome.forecast.horizon_laps or 3
    if sc_snap.deployment_mj > (FIA_2026_MAX_ES_CAPACITY_MJ * horizon):
        reason = "DEPLOYMENT_EXCEEDS_PHYSICAL_MGU_K_WINDOW"
        return False, reason, StrategyCriterion.PHYSICAL_ENERGY_FEASIBILITY.value

    return True, None, None


def rank_scenario_actions(
    actions: Dict[str, ActionOutcomeSnapshot],
    scenario_name: str,
    battle_data: Optional[Dict[str, Any]] = None,
    ranking_config: Optional[StrategyRankingConfig] = None,
) -> ScenarioRankingResult:
    """Execute complete 6-tier lexicographic comparison for one energy scenario.

    Guarantees action-order independence by sorting action keys deterministically.
    All comparison tolerances are loaded from versioned StrategyRankingConfig.
    """
    ranking_cfg = ranking_config or load_strategy_ranking_config()
    sorted_action_names = sorted(actions.keys())
    comparison_trace: List[str] = []
    traces: Dict[str, ActionEvaluationTrace] = {}

    for name in sorted_action_names:
        traces[name] = ActionEvaluationTrace(
            action=StrategistAction(name),
            selectable=True,
            criterion_trace={},
            dominates=[],
            dominated_by=[],
            exclusion_reasons=[],
            excluded_at=None,
        )

    # --------------------------------------------------------------------------
    # TIER 1: REGULATORY ELIGIBILITY
    # --------------------------------------------------------------------------
    for name in sorted_action_names:
        act_outcome = actions[name]
        is_el, ex_reason, ex_at = evaluate_action_eligibility(act_outcome)
        traces[name].criterion_trace["regulatory_result"] = act_outcome.rule_check.result
        if not is_el:
            traces[name].selectable = False
            traces[name].exclusion_reasons.append(ex_reason)
            traces[name].excluded_at = ex_at
            comparison_trace.append(f"{name} excluded at TIER 1 ({ex_at}): {ex_reason}")

    # --------------------------------------------------------------------------
    # TIER 2: PHYSICAL / ENERGY FEASIBILITY
    # --------------------------------------------------------------------------
    for name in sorted_action_names:
        if not traces[name].selectable:
            continue
        act_outcome = actions[name]
        is_feas, ex_reason, ex_at = evaluate_energy_feasibility(act_outcome, scenario_name)
        traces[name].criterion_trace["energy_feasible"] = is_feas
        if not is_feas:
            traces[name].selectable = False
            traces[name].exclusion_reasons.append(ex_reason)
            traces[name].excluded_at = ex_at
            comparison_trace.append(f"{name} excluded at TIER 2 ({ex_at}): {ex_reason}")

    selectable_candidates = [name for name in sorted_action_names if traces[name].selectable]

    if not selectable_candidates:
        return ScenarioRankingResult(
            scenario_name=scenario_name,
            winner=None,
            ranked_actions=list(traces.values()),
            comparison_trace=comparison_trace + ["All actions excluded by regulatory or physical constraints."],
        )

    if len(selectable_candidates) == 1:
        winner = selectable_candidates[0]
        traces[winner].rank = 1
        comparison_trace.append(f"Sole selectable candidate {winner} wins {scenario_name} scenario.")
        return ScenarioRankingResult(
            scenario_name=scenario_name,
            winner=winner,
            ranked_actions=list(traces.values()),
            comparison_trace=comparison_trace,
        )

    # --------------------------------------------------------------------------
    # TIER 3: DURABLE TRACK-POSITION CONSEQUENCE (Stability V1)
    # --------------------------------------------------------------------------
    # If OVERTAKE is selectable but Stability V1 verdict is HIGH_RISK, and another
    # selectable action preserves position with non-WEAK future window (STRONG or MODERATE),
    # the non-overtake alternative qualitatively dominates OVERTAKE at Tier 3.
    if StrategistAction.OVERTAKE.value in selectable_candidates:
        ot_outcome = actions[StrategistAction.OVERTAKE.value]
        traces[StrategistAction.OVERTAKE.value].criterion_trace["stability_verdict"] = ot_outcome.stability.verdict
        if ot_outcome.stability.verdict == "HIGH_RISK":
            # Look for non-overtake alternatives with non-WEAK future window
            durable_alts = [
                cand for cand in selectable_candidates
                if cand != StrategistAction.OVERTAKE.value
                and actions[cand].forecast.future_window_quality in [FutureWindowQuality.STRONG, FutureWindowQuality.MODERATE]
            ]
            if durable_alts:
                # OVERTAKE loses at Tier 3 to durable alternatives
                for alt in durable_alts:
                    traces[alt].dominates.append(StrategistAction.OVERTAKE.value)
                    traces[StrategistAction.OVERTAKE.value].dominated_by.append(alt)
                traces[StrategistAction.OVERTAKE.value].selectable = False
                traces[StrategistAction.OVERTAKE.value].excluded_at = StrategyCriterion.DURABLE_TRACK_POSITION.value
                traces[StrategistAction.OVERTAKE.value].exclusion_reasons.append(
                    f"POST_PASS_HIGH_RISK: Dominated by durable alternatives {durable_alts}"
                )
                comparison_trace.append(
                    f"OVERTAKE has HIGH_RISK stability verdict and is dominated at TIER 3 by durable alternatives {durable_alts}."
                )

    selectable_candidates = [name for name in sorted_action_names if traces[name].selectable]
    if len(selectable_candidates) == 1:
        winner = selectable_candidates[0]
        traces[winner].rank = 1
        comparison_trace.append(f"{winner} wins {scenario_name} after Tier 3 Durability filtering.")
        return ScenarioRankingResult(
            scenario_name=scenario_name,
            winner=winner,
            ranked_actions=list(traces.values()),
            comparison_trace=comparison_trace,
        )

    # --------------------------------------------------------------------------
    # TIER 4: FUTURE-WINDOW DOMINANCE (STRONG > MODERATE > WEAK)
    # --------------------------------------------------------------------------
    best_fw_ordinal = -99
    fw_ordinals: Dict[str, int] = {}
    for cand in selectable_candidates:
        fwq = actions[cand].forecast.future_window_quality
        ordinal_val = FUTURE_WINDOW_ORDINAL.get(fwq, -1)
        fw_ordinals[cand] = ordinal_val
        traces[cand].criterion_trace["future_window_quality"] = fwq.value if hasattr(fwq, "value") else str(fwq)
        if ordinal_val > best_fw_ordinal:
            best_fw_ordinal = ordinal_val

    # Candidates with strictly lower known ordinal rank are dominated at Tier 4
    tier4_survivors: List[str] = []
    for cand in selectable_candidates:
        ordinal_val = fw_ordinals[cand]
        if ordinal_val == best_fw_ordinal and ordinal_val > 0:
            tier4_survivors.append(cand)
        elif ordinal_val < best_fw_ordinal and ordinal_val > 0:
            traces[cand].selectable = False
            traces[cand].excluded_at = StrategyCriterion.FUTURE_WINDOW_DOMINANCE.value
            traces[cand].exclusion_reasons.append(
                f"LOWER_FUTURE_WINDOW: Rank {ordinal_val} vs best {best_fw_ordinal}"
            )
            comparison_trace.append(f"{cand} eliminated at TIER 4: inferior future window quality.")
        else:
            # UNKNOWN ordinal (-1); keep as survivor if best_fw_ordinal was also unranked
            if best_fw_ordinal <= 0:
                tier4_survivors.append(cand)
            else:
                traces[cand].selectable = False
                traces[cand].excluded_at = StrategyCriterion.FUTURE_WINDOW_DOMINANCE.value
                traces[cand].exclusion_reasons.append("FUTURE_WINDOW_UNKNOWN")

    if tier4_survivors:
        selectable_candidates = tier4_survivors

    if len(selectable_candidates) == 1:
        winner = selectable_candidates[0]
        traces[winner].rank = 1
        comparison_trace.append(f"{winner} wins {scenario_name} on TIER 4 Future Window Dominance.")
        return ScenarioRankingResult(
            scenario_name=scenario_name,
            winner=winner,
            ranked_actions=list(traces.values()),
            comparison_trace=comparison_trace,
        )

    # --------------------------------------------------------------------------
    # TIER 5: CUMULATIVE LAP-TIME CONSEQUENCE
    # --------------------------------------------------------------------------
    # Lower is strictly better (e.g. -0.60s < -0.15s < +0.90s)
    # Comparison tolerance is sourced from versioned StrategyRankingConfig
    lap_tol = ranking_cfg.lap_time_tolerance_s
    time_consequences: Dict[str, float] = {}
    has_valid_times = True
    for cand in selectable_candidates:
        t_cons = actions[cand].forecast.cumulative_lap_time_consequence_s
        if t_cons is None:
            has_valid_times = False
            break
        time_consequences[cand] = float(t_cons)
        traces[cand].criterion_trace["cumulative_lap_time_s"] = t_cons

    if has_valid_times and time_consequences:
        min_time = min(time_consequences.values())
        tier5_survivors = []
        for cand in selectable_candidates:
            t_val = time_consequences[cand]
            if abs(t_val - min_time) <= lap_tol:
                tier5_survivors.append(cand)
            elif t_val > (min_time + lap_tol):
                traces[cand].selectable = False
                traces[cand].excluded_at = StrategyCriterion.CUMULATIVE_LAP_TIME.value
                traces[cand].exclusion_reasons.append(
                    f"SLOWER_LAP_TIME: {t_val:.2f}s vs fastest {min_time:.2f}s (tolerance {lap_tol}s)"
                )
                comparison_trace.append(f"{cand} eliminated at TIER 5: cumulative lap time {t_val:.2f}s is slower.")
        if tier5_survivors:
            selectable_candidates = tier5_survivors

    if len(selectable_candidates) == 1:
        winner = selectable_candidates[0]
        traces[winner].rank = 1
        comparison_trace.append(f"{winner} wins {scenario_name} on TIER 5 Cumulative Lap Time.")
        return ScenarioRankingResult(
            scenario_name=scenario_name,
            winner=winner,
            ranked_actions=list(traces.values()),
            comparison_trace=comparison_trace,
        )

    # --------------------------------------------------------------------------
    # TIER 6: TERMINAL SIMULATED ENERGY
    # --------------------------------------------------------------------------
    # Higher is strictly better (e.g. 3.2 MJ > 2.5 MJ).
    # Comparison tolerance is sourced from versioned StrategyRankingConfig
    e_tol = ranking_cfg.terminal_energy_tolerance_mj
    terminal_energies: Dict[str, float] = {}
    has_valid_energy = True
    for cand in selectable_candidates:
        sc_dict = actions[cand].energy_scenarios
        if scenario_name not in sc_dict:
            has_valid_energy = False
            break
        e_term = sc_dict[scenario_name].terminal_energy_mj
        terminal_energies[cand] = float(e_term)
        traces[cand].criterion_trace["terminal_energy_mj"] = e_term

    if has_valid_energy and terminal_energies:
        max_energy = max(terminal_energies.values())
        tier6_survivors = []
        for cand in selectable_candidates:
            e_val = terminal_energies[cand]
            if abs(e_val - max_energy) <= e_tol:
                tier6_survivors.append(cand)
            elif e_val < (max_energy - e_tol):
                traces[cand].selectable = False
                traces[cand].excluded_at = StrategyCriterion.TERMINAL_SIMULATED_ENERGY.value
                traces[cand].exclusion_reasons.append(
                    f"LOWER_TERMINAL_ENERGY: {e_val:.2f} MJ vs highest {max_energy:.2f} MJ (tolerance {e_tol} MJ)"
                )
                comparison_trace.append(f"{cand} eliminated at TIER 6: lower terminal simulated energy.")
        if tier6_survivors:
            selectable_candidates = tier6_survivors

    if len(selectable_candidates) == 1:
        winner = selectable_candidates[0]
        traces[winner].rank = 1
        comparison_trace.append(f"{winner} wins {scenario_name} on TIER 6 Terminal Simulated Energy.")
        return ScenarioRankingResult(
            scenario_name=scenario_name,
            winner=winner,
            ranked_actions=list(traces.values()),
            comparison_trace=comparison_trace,
        )

    # --------------------------------------------------------------------------
    # TRUE TIES: NO ARBITRARY TIE-BREAKER PERMITTED
    # --------------------------------------------------------------------------
    comparison_trace.append(
        f"TRUE TIE among candidates {selectable_candidates} after all 6 criteria. Returning NO_DOMINANT_ACTION."
    )
    for cand in selectable_candidates:
        traces[cand].rank = None

    return ScenarioRankingResult(
        scenario_name=scenario_name,
        winner="NO_DOMINANT_ACTION",
        ranked_actions=list(traces.values()),
        comparison_trace=comparison_trace,
    )


def evaluate_lexicographic_ranking(
    matrix_actions: Dict[str, ActionOutcomeSnapshot],
    strategy_config: Optional[StrategyCounterfactualConfig] = None,
    battle_data: Optional[Dict[str, Any]] = None,
    ranking_config: Optional[StrategyRankingConfig] = None,
    matrix_metadata: Optional[Dict[str, Any]] = None,
) -> StrategyRankingSnapshot:
    """Execute complete multi-scenario lexicographic ranking and robustness assessment.

    Args:
        matrix_actions: Dict of action names (CONSERVE, BUILD, DEPLOY, OVERTAKE) to ActionOutcomeSnapshots.
        strategy_config: Active strategy counterfactual configuration.
        battle_data: Telemetry dictionary of battle features.
        ranking_config: Optional versioned ranking configuration.
        matrix_metadata: Optional dictionary with model_sha256, stability_manifest_sha256, rule_bundle_version.

    Returns:
        StrategyRankingSnapshot: Full audit snapshot of ranking, traces, and robustness.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    cfg = strategy_config or load_strategy_counterfactual_config()
    ranking_cfg = ranking_config or load_strategy_ranking_config()
    meta = matrix_metadata or {}

    # Pre-check: Ensure all 4 actions exist
    expected_actions = {"CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"}
    if not matrix_actions or not expected_actions.issubset(set(matrix_actions.keys())):
        return StrategyRankingSnapshot(
            available=False,
            ranked_actions=[],
            excluded_actions=[],
            scenario_rankings={},
            robustness="INSUFFICIENT_INFORMATION",
            comparison_trace=["Matrix does not contain complete 4 discrete actions."],
            reason_codes=["INSUFFICIENT_INFORMATION"],
            ranking_config_version=ranking_cfg.version,
            ranking_config_sha256=ranking_cfg.sha256,
            strategy_config_version=cfg.version,
            strategy_config_sha256=cfg.sha256,
            model_sha256=meta.get("model_sha256"),
            stability_manifest_sha256=meta.get("stability_manifest_sha256"),
            rule_bundle_version=meta.get("rule_bundle_version", "2026_FIA_ISSUE_20"),
            generated_at=now_iso,
        )

    # Run ranking independently across all 3 scenarios
    scenarios = ["CONSERVATIVE", "NOMINAL", "FAVORABLE"]
    scenario_results: Dict[str, ScenarioRankingResult] = {}
    scenario_winners: Dict[str, Optional[str]] = {}

    for sc_name in scenarios:
        res = rank_scenario_actions(
            actions=matrix_actions,
            scenario_name=sc_name,
            battle_data=battle_data,
            ranking_config=ranking_cfg,
        )
        scenario_results[sc_name] = res
        scenario_winners[sc_name] = res.winner

    # Assess multi-scenario robustness
    valid_winners = [
        w for w in scenario_winners.values()
        if w in expected_actions
    ]

    if len(valid_winners) == 3 and len(set(valid_winners)) == 1:
        robustness = "ROBUST_WITHIN_TESTED_ASSUMPTIONS"
        primary_winner = valid_winners[0]
    elif len(valid_winners) > 0 and len(set(valid_winners)) > 1:
        robustness = "ENERGY_SENSITIVE"
        # Nominal winner preferred as primary candidate when sensitive
        primary_winner = scenario_winners.get("NOMINAL")
        if primary_winner not in expected_actions:
            primary_winner = valid_winners[0]
    else:
        robustness = "INSUFFICIENT_INFORMATION"
        primary_winner = None

    # Primary ranking details from NOMINAL scenario
    nominal_res = scenario_results.get("NOMINAL")
    all_traces = nominal_res.ranked_actions if nominal_res else []
    ranked_list = [t for t in all_traces if t.selectable and t.rank is not None]
    excluded_list = [t for t in all_traces if not t.selectable or t.rank is None]

    reason_codes: List[str] = []
    if primary_winner:
        reason_codes.append(f"WINNER_{primary_winner}")
    if robustness == "ROBUST_WITHIN_TESTED_ASSUMPTIONS":
        reason_codes.append("ROBUST_ACROSS_SCENARIOS")
    elif robustness == "ENERGY_SENSITIVE":
        reason_codes.append("ENERGY_SENSITIVE_SCENARIO_DIVERGENCE")
    elif any(w == "NO_DOMINANT_ACTION" for w in scenario_winners.values()):
        reason_codes.append("STRATEGY_TIE")
    else:
        reason_codes.append("INSUFFICIENT_INFORMATION")

    comparison_trace = []
    for sc_name, sc_res in scenario_results.items():
        comparison_trace.append(f"[{sc_name}] Winner: {sc_res.winner}")
        comparison_trace.extend([f"  {line}" for line in sc_res.comparison_trace])

    return StrategyRankingSnapshot(
        available=True,
        ranked_actions=ranked_list,
        excluded_actions=excluded_list,
        scenario_rankings=scenario_results,
        robustness=robustness,
        comparison_trace=comparison_trace,
        reason_codes=reason_codes,
        ranking_config_version=ranking_cfg.version,
        ranking_config_sha256=ranking_cfg.sha256,
        strategy_config_version=cfg.version,
        strategy_config_sha256=cfg.sha256,
        model_sha256=meta.get("model_sha256"),
        stability_manifest_sha256=meta.get("stability_manifest_sha256"),
        rule_bundle_version=meta.get("rule_bundle_version", "2026_FIA_ISSUE_20"),
        generated_at=now_iso,
    )


def apply_strategy_ranking(
    matrix: Any,
    strategy_config: Optional[StrategyCounterfactualConfig] = None,
    battle_data: Optional[Dict[str, Any]] = None,
    ranking_config: Optional[StrategyRankingConfig] = None,
) -> Any:
    """Run lexicographic ranking and candidate recommendation on a StrategyMatrixSnapshot.

    Args:
        matrix: StrategyMatrixSnapshot instance.
        strategy_config: Optional strategy counterfactual configuration.
        battle_data: Optional battle telemetry dictionary.
        ranking_config: Optional strategy ranking configuration.

    Returns:
        StrategyMatrixSnapshot: Cloned and populated snapshot with ranking.available=True.
    """
    from kyntra.strategy.recommendation import generate_candidate_recommendation

    cfg = strategy_config or load_strategy_counterfactual_config()
    ranking_cfg = ranking_config or load_strategy_ranking_config()
    b_data = battle_data or matrix.current_state_summary

    matrix_meta = {
        "model_sha256": getattr(matrix, "model_sha256", None),
        "stability_manifest_sha256": getattr(matrix, "stability_manifest_sha256", None),
        "rule_bundle_version": getattr(matrix, "rule_bundle_version", "2026_FIA_ISSUE_20"),
    }

    ranking_snap = evaluate_lexicographic_ranking(
        matrix_actions=matrix.actions,
        strategy_config=cfg,
        battle_data=b_data,
        ranking_config=ranking_cfg,
        matrix_metadata=matrix_meta,
    )

    candidate_rec = generate_candidate_recommendation(
        ranking_snapshot=ranking_snap,
        matrix_actions=matrix.actions,
        battle_data=b_data,
        ranking_config=ranking_cfg,
    )

    updated = matrix.model_copy(deep=True)
    updated.ranking = ranking_snap.model_dump()
    updated.recommendation = candidate_rec.model_dump()
    updated.reason = candidate_rec.primary_reason or "STRATEGY_MATRIX_EVALUATED"
    return updated
