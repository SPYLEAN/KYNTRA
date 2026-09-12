"""Data models and schemas for the KYNTRA Strategist Matrix and counterfactuals.

Defines typed contracts for:
- StrategistAction (CONSERVE, BUILD, DEPLOY, OVERTAKE)
- ActionOutcomeSnapshot (multivariate action rollout outcome)
- StrategyMatrixSnapshot (canonical counterfactual action matrix)
- Fair baseline, ML truth, and strict provenance enforcement.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class StrategistAction(str, Enum):
    """Canonical discrete strategist decision alternatives."""
    CONSERVE = "CONSERVE"
    BUILD = "BUILD"
    DEPLOY = "DEPLOY"
    OVERTAKE = "OVERTAKE"


class FutureWindowQuality(str, Enum):
    """Typed ordinal classification of projected future attack/defense window."""
    STRONG = "STRONG"
    MODERATE = "MODERATE"
    WEAK = "WEAK"
    UNKNOWN = "UNKNOWN"


class ProvenanceCategory(str, Enum):
    """Origin categories ensuring strict auditability and no mislabeling."""
    PUBLIC_SOURCE = "PUBLIC_SOURCE"
    DERIVED_PUBLIC = "DERIVED_PUBLIC"
    FROZEN_MODEL = "FROZEN_MODEL"
    SIMULATED_ENERGY = "SIMULATED_ENERGY"
    FORECAST_SIMULATION = "FORECAST_SIMULATION"
    RULE_CHECK = "RULE_CHECK"
    HISTORICAL_OUTCOME = "HISTORICAL_OUTCOME"
    UNKNOWN = "UNKNOWN"


class PassWindowSnapshot(BaseModel):
    """Frozen LightGBM overtake inference from current observable state."""
    available: bool = False
    p1: Optional[float] = None
    p2: Optional[float] = None
    p3: Optional[float] = None
    raw_p1: Optional[float] = None
    raw_p2: Optional[float] = None
    raw_p3: Optional[float] = None
    pav_applied: bool = False
    provenance: str = "FROZEN_MODEL"


class ActionRuleCheckSnapshot(BaseModel):
    """Deterministic sporting and technical regulation eligibility for an action."""
    result: str = "ALLOWED"  # ALLOWED | BLOCKED | UNKNOWN
    rule_ids: List[str] = Field(default_factory=list)
    rule_bundle_version: str = "2026_FIA_ISSUE_20"
    provenance: str = "RULE_CHECK"


class ScenarioEnergySnapshot(BaseModel):
    """Discrete energy assumption scenario for an action rollout."""
    scenario_name: str  # CONSERVATIVE | NOMINAL | FAVORABLE
    deployment_mj: float = 0.0
    expected_recovery_mj: float = 0.0
    net_delta_mj: float = 0.0
    terminal_energy_mj: float = 0.0
    status: str = "CONFIG_ASSUMPTION"
    provenance: str = "CONFIG_ASSUMPTION"
    assumption_details: Optional[Dict[str, Any]] = None


class ActionEnergySnapshot(BaseModel):
    """Simulated 2026 regulation-constrained energy accounting for an action."""
    available: bool = True
    before_mj: Optional[float] = None
    planned_deployment_mj: Optional[float] = None
    expected_recovery_mj: Optional[float] = None
    after_mj: Optional[float] = None
    provenance: str = "SIMULATED — 2026 REGULATION CONSTRAINED"
    provenance_category: str = "SIMULATED_ENERGY"
    assumption_set: str = "KYNTRA_V1_TACTICAL_NOMINAL"


class ActionPassContextSnapshot(BaseModel):
    """Pass probability context for an action.
    
    CRITICAL ML TRUTH: P1/P2/P3 represent the current observable battle state.
    They are NOT causal estimates for counterfactual actions.
    action_effect_available is strictly False in Phase 07.
    """
    current_p1: Optional[float] = None
    current_p2: Optional[float] = None
    current_p3: Optional[float] = None
    action_effect_available: bool = False
    provenance: str = "FROZEN_MODEL"


class ActionStabilitySnapshot(BaseModel):
    """Post-pass durability projection from Stability V1.
    
    CONSERVE and BUILD receive NOT_APPLICABLE because they do not gain position.
    OVERTAKE receives full durability evidence.
    DEPLOY does not assume a completed pass.
    """
    verdict: str = "UNKNOWN"  # HIGH_RISK | CAUTION | UNKNOWN | NOT_APPLICABLE
    available: bool = False
    reason: Optional[str] = None
    available_families: List[str] = Field(default_factory=list)
    triggered_families: List[str] = Field(default_factory=list)
    provenance: str = "ORDINAL_STABILITY_CONSENSUS"


class ActionForecastSnapshot(BaseModel):
    """Deterministic short-horizon action rollout."""
    available: bool = True
    horizon_laps: int = 3
    projected_position_delta: Optional[int] = 0
    projected_gap_delta: Optional[float] = None
    cumulative_lap_time_consequence_s: Optional[float] = None
    future_window_quality: FutureWindowQuality = FutureWindowQuality.UNKNOWN
    rear_threat: Optional[str] = None
    terminal_energy_mj: Optional[float] = None
    provenance: str = "FORECAST_SIMULATION"
    status: str = "CONFIG_ASSUMPTION"


class ActionOutcomeSnapshot(BaseModel):
    """Complete multivariate counterfactual outcome for a candidate strategist action."""
    action: StrategistAction
    available: bool = True
    eligible: bool = True
    exclusion_reasons: List[str] = Field(default_factory=list)
    rule_check: ActionRuleCheckSnapshot = Field(default_factory=ActionRuleCheckSnapshot)
    energy: ActionEnergySnapshot = Field(default_factory=ActionEnergySnapshot)
    pass_context: ActionPassContextSnapshot = Field(default_factory=ActionPassContextSnapshot)
    stability: ActionStabilitySnapshot = Field(default_factory=ActionStabilitySnapshot)
    forecast: ActionForecastSnapshot = Field(default_factory=ActionForecastSnapshot)
    energy_scenarios: Dict[str, ScenarioEnergySnapshot] = Field(default_factory=dict)
    robustness: str = "NOT_EVALUATED"
    reason_codes: List[str] = Field(default_factory=list)
    provenance: str = "FORECAST_SIMULATION"


class StrategyMatrixSnapshot(BaseModel):
    """Canonical Strategist Matrix: four counterfactual action outcomes from the same state."""
    snapshot_id: str
    battle_id: str
    mode: str = "REPLAY"  # LIVE | REPLAY | FORECAST
    source_mode: str = "HISTORICAL_REPLAY"  # LIVE_FEED | CAPTURED_LIVE | HISTORICAL_REPLAY | SYNTHETIC
    event_time: Optional[str] = None
    received_time: Optional[str] = None
    decision_time: str
    state_age_ms: Optional[float] = 0.0
    freshness_status: str = "FRESH"
    session_key: Optional[str] = None
    lap_number: int = 1
    attacker: str = "ANT"
    defender: str = "VER"
    model_version: str = "1.0.0"
    model_sha256: Optional[str] = None
    rule_bundle_version: str = "2026_FIA_ISSUE_20"
    stability_manifest_version: Optional[str] = "1.1.0"
    stability_manifest_sha256: Optional[str] = None
    dataset_sha256: Optional[str] = None
    strategy_config_version: str = "1.0.0"
    strategy_config_sha256: Optional[str] = None
    assumption_profile: str = "KYNTRA_V1_TACTICAL_NOMINAL"
    energy_config_version: Optional[str] = "2026.1"
    current_state_summary: Dict[str, Any] = Field(default_factory=dict)
    pass_window: PassWindowSnapshot = Field(default_factory=PassWindowSnapshot)
    actions: Dict[str, ActionOutcomeSnapshot] = Field(default_factory=dict)
    ranking: Dict[str, Any] = Field(default_factory=dict)
    recommendation: Dict[str, Any] = Field(default_factory=dict)
    reason: str = "STRATEGY_MATRIX_EVALUATED"


class StrategyCriterion(str, Enum):
    """Canonical 6-tier lexicographic strategy criteria in exact priority order."""
    REGULATORY_ELIGIBILITY = "REGULATORY_ELIGIBILITY"
    PHYSICAL_ENERGY_FEASIBILITY = "PHYSICAL_ENERGY_FEASIBILITY"
    DURABLE_TRACK_POSITION = "DURABLE_TRACK_POSITION"
    FUTURE_WINDOW_DOMINANCE = "FUTURE_WINDOW_DOMINANCE"
    CUMULATIVE_LAP_TIME = "CUMULATIVE_LAP_TIME"
    TERMINAL_SIMULATED_ENERGY = "TERMINAL_SIMULATED_ENERGY"


class ActionEvaluationTrace(BaseModel):
    """Audit trace of an individual action's performance through the lexicographic hierarchy."""
    action: StrategistAction
    rank: Optional[int] = None
    selectable: bool = True
    criterion_trace: Dict[str, Any] = Field(default_factory=dict)
    dominates: List[str] = Field(default_factory=list)
    dominated_by: List[str] = Field(default_factory=list)
    exclusion_reasons: List[str] = Field(default_factory=list)
    excluded_at: Optional[str] = None


class ScenarioRankingResult(BaseModel):
    """Lexicographic ranking outcome under a discrete energy sensitivity scenario."""
    scenario_name: str  # CONSERVATIVE | NOMINAL | FAVORABLE
    winner: Optional[str] = None  # CONSERVE | BUILD | DEPLOY | OVERTAKE | NO_DOMINANT_ACTION | INSUFFICIENT_INFORMATION
    ranked_actions: List[ActionEvaluationTrace] = Field(default_factory=list)
    comparison_trace: List[str] = Field(default_factory=list)


class StrategyRankingSnapshot(BaseModel):
    """Complete transparent lexicographic ranking snapshot for the strategist matrix."""
    available: bool = False
    ranked_actions: List[ActionEvaluationTrace] = Field(default_factory=list)
    excluded_actions: List[ActionEvaluationTrace] = Field(default_factory=list)
    scenario_rankings: Dict[str, ScenarioRankingResult] = Field(default_factory=dict)
    robustness: str = "INSUFFICIENT_INFORMATION"  # ROBUST_WITHIN_TESTED_ASSUMPTIONS | ENERGY_SENSITIVE | INSUFFICIENT_INFORMATION
    comparison_trace: List[str] = Field(default_factory=list)
    reason_codes: List[str] = Field(default_factory=list)
    strategy_config_version: str = "1.0.0"
    strategy_config_sha256: Optional[str] = None
    generated_at: str = Field(default_factory=str)


class CandidateRecommendation(BaseModel):
    """Candidate KYNTRA Call emitted from lexicographic ranking, pending final publication gate."""
    available: bool = False
    backend_action: Optional[str] = None  # CONSERVE | BUILD | DEPLOY | OVERTAKE
    ui_call: Optional[str] = None         # SAVE ENERGY | PREPARE | APPLY PRESSURE | OVERTAKE NOW
    robustness: str = "INSUFFICIENT_INFORMATION"
    primary_reason: Optional[str] = None
    reason_codes: List[str] = Field(default_factory=list)
    why_selected: List[str] = Field(default_factory=list)
    why_not_overtake: List[str] = Field(default_factory=list)
    scenario_winners: Dict[str, Optional[str]] = Field(default_factory=dict)
    publication_status: str = "PENDING_FINAL_GATE"

