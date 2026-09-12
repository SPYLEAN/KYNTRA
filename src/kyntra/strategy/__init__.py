"""KYNTRA Strategist Matrix and counterfactual scenario modeling package."""

from kyntra.strategy.config import (
    ActionProfileConfig,
    ScenarioMultiplierConfig,
    StrategyCounterfactualConfig,
    load_strategy_counterfactual_config,
)
from kyntra.strategy.counterfactuals import (
    evaluate_action_rule_check,
    evaluate_action_stability,
    simulate_action_energy_scenarios,
    simulate_action_forecast,
    simulate_action_outcome,
)
from kyntra.strategy.matrix import generate_strategy_matrix
from kyntra.strategy.models import (
    ActionEnergySnapshot,
    ActionForecastSnapshot,
    ActionOutcomeSnapshot,
    ActionPassContextSnapshot,
    ActionRuleCheckSnapshot,
    ActionStabilitySnapshot,
    FutureWindowQuality,
    PassWindowSnapshot,
    ProvenanceCategory,
    ScenarioEnergySnapshot,
    StrategistAction,
    StrategyMatrixSnapshot,
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
    "generate_strategy_matrix",
    "simulate_action_outcome",
    "evaluate_action_rule_check",
    "simulate_action_energy_scenarios",
    "evaluate_action_stability",
    "simulate_action_forecast",
]
