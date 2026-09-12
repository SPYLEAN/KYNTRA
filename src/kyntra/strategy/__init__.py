"""KYNTRA Strategist Matrix and counterfactual scenario modeling package."""

from kyntra.strategy.config import (
    ActionProfileConfig,
    ScenarioMultiplierConfig,
    StrategyCounterfactualConfig,
    StrategyRankingConfig,
    load_strategy_counterfactual_config,
    load_strategy_ranking_config,
)
from kyntra.strategy.counterfactuals import (
    evaluate_action_rule_check,
    evaluate_action_stability,
    simulate_action_energy_scenarios,
    simulate_action_forecast,
    simulate_action_outcome,
)
from kyntra.strategy.explanations import (
    EXPLANATION_TOKEN_DESCRIPTIONS,
    SUPPORTED_WHY_NOT_OVERTAKE_TOKENS,
    generate_why_not_overtake,
    generate_why_selected,
)
from kyntra.strategy.matrix import generate_strategy_matrix
from kyntra.strategy.models import (
    ActionEnergySnapshot,
    ActionEvaluationTrace,
    ActionForecastSnapshot,
    ActionOutcomeSnapshot,
    ActionPassContextSnapshot,
    ActionRuleCheckSnapshot,
    ActionStabilitySnapshot,
    CandidateRecommendation,
    FutureWindowQuality,
    PassWindowSnapshot,
    ProvenanceCategory,
    ScenarioEnergySnapshot,
    ScenarioRankingResult,
    StrategistAction,
    StrategyCriterion,
    StrategyMatrixSnapshot,
    StrategyRankingSnapshot,
)
from kyntra.strategy.ranking import (
    apply_strategy_ranking,
    evaluate_lexicographic_ranking,
    rank_scenario_actions,
)
from kyntra.strategy.recommendation import (
    UI_CALL_MAP,
    generate_candidate_recommendation,
)

__all__ = [
    "StrategistAction",
    "FutureWindowQuality",
    "ProvenanceCategory",
    "PassWindowSnapshot",
    "ActionRuleCheckSnapshot",
    "ScenarioEnergySnapshot",
    "ActionEnergySnapshot",
    "ActionPassContextSnapshot",
    "ActionStabilitySnapshot",
    "ActionForecastSnapshot",
    "ActionOutcomeSnapshot",
    "StrategyMatrixSnapshot",
    "StrategyCriterion",
    "ActionEvaluationTrace",
    "ScenarioRankingResult",
    "StrategyRankingSnapshot",
    "CandidateRecommendation",
    "generate_strategy_matrix",
    "simulate_action_outcome",
    "evaluate_action_rule_check",
    "simulate_action_energy_scenarios",
    "evaluate_action_stability",
    "simulate_action_forecast",
    "evaluate_lexicographic_ranking",
    "rank_scenario_actions",
    "apply_strategy_ranking",
    "generate_candidate_recommendation",
    "generate_why_selected",
    "generate_why_not_overtake",
    "UI_CALL_MAP",
    "SUPPORTED_WHY_NOT_OVERTAKE_TOKENS",
    "EXPLANATION_TOKEN_DESCRIPTIONS",
    "StrategyRankingConfig",
    "load_strategy_ranking_config",
]

