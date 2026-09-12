"""Candidate KYNTRA Call recommendation generator.

Synthesizes the CandidateRecommendation from the Lexicographic StrategyRankingSnapshot.
Enforces:
1. Exact UI call mapping:
   - CONSERVE -> SAVE ENERGY
   - BUILD -> PREPARE
   - DEPLOY -> APPLY PRESSURE
   - OVERTAKE -> OVERTAKE NOW
2. Transparent publication gate status: publication_status = "PENDING_FINAL_GATE"
3. Mandatory deterministic "WHY NOT OVERTAKE NOW?" token generation
4. First-class abstention when ranking produces NO_DOMINANT_ACTION or INSUFFICIENT_INFORMATION.
"""

import logging
from typing import Any, Dict, List, Optional

from kyntra.strategy.explanations import generate_why_not_overtake, generate_why_selected
from kyntra.strategy.models import (
    ActionOutcomeSnapshot,
    CandidateRecommendation,
    StrategistAction,
    StrategyRankingSnapshot,
)

logger = logging.getLogger(__name__)

UI_CALL_MAP = {
    StrategistAction.CONSERVE.value: "SAVE ENERGY",
    StrategistAction.BUILD.value: "PREPARE",
    StrategistAction.DEPLOY.value: "APPLY PRESSURE",
    StrategistAction.OVERTAKE.value: "OVERTAKE NOW",
}


def generate_candidate_recommendation(
    ranking_snapshot: StrategyRankingSnapshot,
    matrix_actions: Dict[str, ActionOutcomeSnapshot],
    battle_data: Optional[Dict[str, Any]] = None,
) -> CandidateRecommendation:
    """Synthesize candidate strategist call from lexicographic ranking results.

    Returns:
        CandidateRecommendation: Candidate recommendation pending Phase 09 publication gate.
    """
    if not ranking_snapshot.available:
        overtake_act = matrix_actions.get(StrategistAction.OVERTAKE.value)
        why_not_ot = generate_why_not_overtake(
            overtake_outcome=overtake_act,
            selected_action=None,
            is_insufficient_info=True,
            battle_data=battle_data,
        )
        return CandidateRecommendation(
            available=False,
            backend_action=None,
            ui_call=None,
            robustness="INSUFFICIENT_INFORMATION",
            primary_reason="STRATEGY_RANKING_UNAVAILABLE",
            reason_codes=["INSUFFICIENT_INFORMATION"],
            why_selected=[],
            why_not_overtake=why_not_ot,
            scenario_winners={},
            publication_status="PENDING_FINAL_GATE",
        )

    scenario_winners: Dict[str, Optional[str]] = {
        name: res.winner for name, res in ranking_snapshot.scenario_rankings.items()
    }

    # Determine primary winner from NOMINAL scenario
    nominal_winner = scenario_winners.get("NOMINAL")
    robustness = ranking_snapshot.robustness

    # Check for true ties
    if nominal_winner == "NO_DOMINANT_ACTION" or any(w == "NO_DOMINANT_ACTION" for w in scenario_winners.values()):
        overtake_act = matrix_actions.get(StrategistAction.OVERTAKE.value)
        why_not_ot = generate_why_not_overtake(
            overtake_outcome=overtake_act,
            selected_action=None,
            is_tie=True,
            battle_data=battle_data,
        )
        return CandidateRecommendation(
            available=False,
            backend_action=None,
            ui_call=None,
            robustness=robustness,
            primary_reason="STRATEGY_TIE_REQUIRES_HUMAN_JUDGMENT",
            reason_codes=["STRATEGY_TIE", "NO_DOMINANT_ACTION"],
            why_selected=[],
            why_not_overtake=why_not_ot,
            scenario_winners=scenario_winners,
            publication_status="PENDING_FINAL_GATE",
        )

    # If no valid winner
    if not nominal_winner or nominal_winner not in UI_CALL_MAP:
        overtake_act = matrix_actions.get(StrategistAction.OVERTAKE.value)
        why_not_ot = generate_why_not_overtake(
            overtake_outcome=overtake_act,
            selected_action=None,
            is_insufficient_info=True,
            battle_data=battle_data,
        )
        return CandidateRecommendation(
            available=False,
            backend_action=None,
            ui_call=None,
            robustness="INSUFFICIENT_INFORMATION",
            primary_reason="NO_SAFE_ACTION",
            reason_codes=["NO_SAFE_ACTION"],
            why_selected=[],
            why_not_overtake=why_not_ot,
            scenario_winners=scenario_winners,
            publication_status="PENDING_FINAL_GATE",
        )

    ui_label = UI_CALL_MAP[nominal_winner]

    # Find evaluation trace for nominal winner
    nominal_res = ranking_snapshot.scenario_rankings.get("NOMINAL")
    winner_trace: Dict[str, Any] = {}
    if nominal_res:
        for t in nominal_res.ranked_actions:
            if t.action.value == nominal_winner:
                winner_trace = t.criterion_trace
                break

    why_sel = generate_why_selected(
        selected_action=nominal_winner,
        criterion_trace=winner_trace,
        robustness=robustness,
        scenario_winners=scenario_winners,
    )

    overtake_act = matrix_actions.get(StrategistAction.OVERTAKE.value)
    why_not_ot = generate_why_not_overtake(
        overtake_outcome=overtake_act,
        selected_action=nominal_winner,
        robustness=robustness,
        battle_data=battle_data,
    )

    primary_reason = f"LEXICOGRAPHIC_WINNER_{nominal_winner}"
    reason_codes = list(ranking_snapshot.reason_codes)

    return CandidateRecommendation(
        available=True,
        backend_action=nominal_winner,
        ui_call=ui_label,
        robustness=robustness,
        primary_reason=primary_reason,
        reason_codes=reason_codes,
        why_selected=why_sel,
        why_not_overtake=why_not_ot,
        scenario_winners=scenario_winners,
        publication_status="PENDING_FINAL_GATE",
    )
