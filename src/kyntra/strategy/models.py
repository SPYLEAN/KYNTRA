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


class ScenarioEnergySnapshot(BaseModel):
    """Discrete energy assumption scenario for an action rollout."""
    scenario_name: str  # CONSERVATIVE | NOMINAL | FAVORABLE
    deployment_mj: float = 0.0
    expected_recovery_mj: float = 0.0
    net_delta_mj: float = 0.0
    terminal_energy_mj: float = 0.0


class ActionEnergySnapshot(BaseModel):
    """Simulated 2026 regulation-constrained energy accounting for an action."""
    available: bool = True
    before_mj: Optional[float] = None
    planned_deployment_mj: Optional[float] = None
    expected_recovery_mj: Optional[float] = None
    after_mj: Optional[float] = None
    provenance: str = "SIMULATED — 2026 REGULATION CONSTRAINED"
    assumption_set: str = "FIA_2026_MGU_K_DEFAULT"


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
    current_state_summary: Dict[str, Any] = Field(default_factory=dict)
    pass_window: PassWindowSnapshot = Field(default_factory=PassWindowSnapshot)
    actions: Dict[str, ActionOutcomeSnapshot] = Field(default_factory=dict)
    ranking: Dict[str, Any] = Field(
        default_factory=lambda: {"available": False, "reason": "STRATEGY_RANKING_PENDING_PHASE_08"}
    )
    recommendation: Dict[str, Any] = Field(
        default_factory=lambda: {"available": False, "reason": "STRATEGY_RANKING_PENDING_PHASE_08"}
    )
    reason: str = "STRATEGY_RANKING_PENDING_PHASE_08"
