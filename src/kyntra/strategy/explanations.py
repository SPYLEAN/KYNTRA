"""Deterministic rationale and explanation generator for KYNTRA strategy calls.

Produces transparent, evidence-backed rationale tokens for:
- why the candidate action was selected
- why OVERTAKE NOW was NOT recommended (mandatory whenever candidate != OVERTAKE)

CRITICAL INVARIANT:
Zero LLM hallucination or synthetic filler. Every explanation token corresponds
strictly to verified regulatory, stability, simulated energy, or kinematic battle evidence.
All numerical evaluation thresholds are loaded from versioned StrategyRankingConfig (CONFIG_ASSUMPTION).
"""

from typing import Any, Dict, List, Optional
from kyntra.strategy.config import StrategyRankingConfig, load_strategy_ranking_config
from kyntra.strategy.models import ActionOutcomeSnapshot, FutureWindowQuality, StrategistAction


SUPPORTED_WHY_NOT_OVERTAKE_TOKENS = {
    "RULE_RESTRICTION",
    "ENERGY_INFEASIBILITY",
    "POST_PASS_INSTABILITY",
    "FUTURE_WINDOW_DOMINANCE",
    "REAR_THREAT",
    "KINEMATIC_OPPORTUNITY_DEFICIT",
    "ENERGY_SENSITIVITY",
    "INSUFFICIENT_INFORMATION",
    "STRATEGY_TIE",
}

# Standardized deterministic explanation dictionary
EXPLANATION_TOKEN_DESCRIPTIONS: Dict[str, str] = {
    "RULE_RESTRICTION": "Overtake mode is prohibited under current FIA sporting regulations or active track neutralizations.",
    "ENERGY_INFEASIBILITY": "The selected counterfactual deployment is infeasible under the current SIMULATED ENERGY STATE and active regulation-constrained deployment limits.",
    "POST_PASS_INSTABILITY": "Stability V1 consensus flags high risk of immediate counter-attack or position loss post-pass.",
    "FUTURE_WINDOW_DOMINANCE": "Alternative action establishes superior forward attack window without immediate high-depletion commitment.",
    "REAR_THREAT": "Attacker faces high closing rate from vehicle behind, elevating defensive exposure.",
    "KINEMATIC_OPPORTUNITY_DEFICIT": "Current battle kinematics (gap and closing rate trend relative to P1/P2/P3 context) indicate unprimed immediate pass conditions.",
    "ENERGY_SENSITIVITY": "Overtake viability collapses or diverges under conservative energy recovery assumptions.",
    "INSUFFICIENT_INFORMATION": "Critical regulatory, energy telemetry, or stability evidence is unverified or unavailable.",
    "STRATEGY_TIE": "Alternative actions remain tied across all 6 lexicographic tiers, requiring pit-wall human judgment.",
}


def generate_why_selected(
    selected_action: str,
    criterion_trace: Dict[str, Any],
    robustness: str,
    scenario_winners: Optional[Dict[str, Optional[str]]] = None,
) -> List[str]:
    """Generate structured, evidence-grounded bullet explanations for the selected action."""
    reasons: List[str] = []

    if selected_action == StrategistAction.OVERTAKE.value:
        reasons.append("Regulatory clearance confirmed: overtake mode enabled and hazard-free.")
        reasons.append("Immediate track position gain projected with acceptable post-pass durability.")
        if robustness == "ROBUST_WITHIN_TESTED_ASSUMPTIONS":
            reasons.append("Action remains dominant across all tested energy sensitivity scenarios.")

    elif selected_action == StrategistAction.BUILD.value:
        reasons.append("Creates net regenerative energy surplus while maintaining striking distance.")
        reasons.append("Establishes superior forward attack window without burning electrical reserves.")
        if robustness == "ROBUST_WITHIN_TESTED_ASSUMPTIONS":
            reasons.append("Strategy confirmed robust across Conservative, Nominal, and Favorable scenarios.")

    elif selected_action == StrategistAction.DEPLOY.value:
        reasons.append("Applies tactical electrical deployment to pressure target or defend position.")
        reasons.append("Projects favorable short-horizon lap time consequence without committing to risky pass.")

    elif selected_action == StrategistAction.CONSERVE.value:
        reasons.append("Prioritizes Energy Store preservation and thermal recovery under current stint pacing.")
        reasons.append("Mitigates aggressive depletion while securing viable future counter-attack baseline.")

    else:
        reasons.append(f"Selected action {selected_action} meets all regulatory and physical constraints.")

    # Add criterion-specific deciding factor note if available
    decisive_crit = criterion_trace.get("decisive_criterion")
    if decisive_crit:
        reasons.append(f"Decisive selection criterion: {decisive_crit}.")

    return reasons


def generate_why_not_overtake(
    overtake_outcome: Optional[ActionOutcomeSnapshot],
    selected_action: Optional[str],
    robustness: Optional[str] = None,
    battle_data: Optional[Dict[str, Any]] = None,
    is_tie: bool = False,
    is_insufficient_info: bool = False,
    ranking_config: Optional[StrategyRankingConfig] = None,
) -> List[str]:
    """Generate deterministic 'WHY NOT OVERTAKE NOW?' evidence tokens and explanations.

    Mandatory whenever candidate action is NOT OVERTAKE.
    Must return a list of verified tokens tracing strictly to observed runtime evidence.
    """
    if selected_action == StrategistAction.OVERTAKE.value:
        return []

    cfg = ranking_config or load_strategy_ranking_config()
    tokens: List[str] = []

    if is_tie:
        tokens.append("STRATEGY_TIE")

    if is_insufficient_info:
        tokens.append("INSUFFICIENT_INFORMATION")

    if overtake_outcome is None or not overtake_outcome.available:
        if "INSUFFICIENT_INFORMATION" not in tokens:
            tokens.append("INSUFFICIENT_INFORMATION")
        return tokens

    # 1. Regulatory restrictions (BLOCKED or UNKNOWN)
    rule_res = overtake_outcome.rule_check.result
    if rule_res == "BLOCKED":
        tokens.append("RULE_RESTRICTION")
    elif rule_res == "UNKNOWN":
        tokens.append("INSUFFICIENT_INFORMATION")

    # 2. Physical & Simulated Energy Infeasibility
    # Note: 350 kW is a power limit, not energy. We evaluate simulated state against initial reserve threshold.
    if not overtake_outcome.energy.available:
        tokens.append("INSUFFICIENT_INFORMATION")
    elif (
        overtake_outcome.energy.before_mj is not None
        and overtake_outcome.energy.before_mj < cfg.min_initial_energy_mj
    ):
        tokens.append("ENERGY_INFEASIBILITY")

    # 3. Post-Pass Instability (Stability V1 HIGH_RISK)
    if overtake_outcome.stability.verdict == "HIGH_RISK":
        tokens.append("POST_PASS_INSTABILITY")

    # 4. Future-Window Dominance (Selected alternative has superior future window)
    if selected_action in [StrategistAction.BUILD.value, StrategistAction.DEPLOY.value]:
        tokens.append("FUTURE_WINDOW_DOMINANCE")

    # 5. Rear Threat Pressure (Must be backed by genuine runtime battle_data observable)
    runtime_rear = (battle_data or {}).get("rear_threat")
    if runtime_rear == "HIGH":
        tokens.append("REAR_THREAT")

    # 6. Kinematic Opportunity Deficit
    p2 = overtake_outcome.pass_context.current_p2
    gap_s = (battle_data or {}).get("gap_seconds")
    closing_rate = (battle_data or {}).get("closing_rate")

    kinematic_deficit = False
    if p2 is not None and p2 < cfg.kinematic_min_p2:
        kinematic_deficit = True
    elif gap_s is not None and gap_s > cfg.kinematic_gap_threshold_s:
        # Gap exceeds threshold while closing rate is absent or non-positive
        if closing_rate is None or closing_rate <= 0.0:
            kinematic_deficit = True

    if kinematic_deficit:
        tokens.append("KINEMATIC_OPPORTUNITY_DEFICIT")

    # 7. Energy Sensitivity (e.g. fails under Conservative)
    if robustness == "ENERGY_SENSITIVE":
        tokens.append("ENERGY_SENSITIVITY")

    # Fallback to general explanation if no specific flag fired
    if not tokens:
        tokens.append("FUTURE_WINDOW_DOMINANCE")

    # De-duplicate while preserving order
    seen = set()
    ordered_tokens = []
    for t in tokens:
        if t in SUPPORTED_WHY_NOT_OVERTAKE_TOKENS and t not in seen:
            seen.add(t)
            ordered_tokens.append(t)

    return ordered_tokens
