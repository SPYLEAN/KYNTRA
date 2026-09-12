"""Domain models for manifest-driven post-pass stability evaluation.

Enforces typed evidence items, multi-family schemas, and consensus stability results.
No empirical numeric thresholds are hardcoded in this codebase.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class StabilityVerdict(str, Enum):
    """Ordinal post-pass position durability classifications."""
    FAVORABLE = "FAVORABLE"
    CAUTION = "CAUTION"
    HIGH_RISK = "HIGH_RISK"
    UNKNOWN = "UNKNOWN"


class StabilityRuleStatus(str, Enum):
    """Lifecycle activation status for individual stability rules."""
    CANDIDATE = "CANDIDATE"              # Under empirical review; strictly prohibited from mutating runtime state
    ENABLED = "ENABLED"                  # Formally approved and active for runtime evaluation
    DISABLED = "DISABLED"                # Explicitly deactivated
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA" # Sample too sparse or uncalibrated
    NO_STABLE_SIGNAL = "NO_STABLE_SIGNAL"   # No monotonic relationship with retention


class StabilityRuleFamily(str, Enum):
    """Independent physical/telemetry feature families for consensus evaluation."""
    PACE = "PACE"
    SPEED = "SPEED"
    TYRE = "TYRE"


class StabilityEvidenceItem(BaseModel):
    """Structured evidence item supporting or refuting position durability."""
    feature: str
    observed_value: Optional[Union[float, str, int]] = None
    unit: str = ""
    rule_id: str
    threshold: Any
    direction: str                       # e.g. ">=", "<=", "==", "in"
    evidence_strength: str = "MODERATE"  # STRONG | MODERATE | WEAK
    source_manifest_version: str = "1.1.0"
    reason_code: str
    family: Optional[str] = None


class StabilityResult(BaseModel):
    """Runtime result of post-pass stability evaluation."""
    verdict: StabilityVerdict = StabilityVerdict.UNKNOWN
    available: bool = False
    evidence: List[StabilityEvidenceItem] = Field(default_factory=list)
    reason: Optional[str] = "STABILITY_RULESET_PENDING_VERIFICATION"
    manifest_version: Optional[str] = None
    manifest_sha256: Optional[str] = None
    dataset_sha256: Optional[str] = None
    available_families: List[str] = Field(default_factory=list)
    triggered_families: List[str] = Field(default_factory=list)


class ManifestRuleDefinition(BaseModel):
    """Specification of an individual stability rule in the manifest."""
    rule_id: str
    feature: str
    family: Optional[str] = None
    status: StabilityRuleStatus = StabilityRuleStatus.CANDIDATE
    operator: str = ">="                 # ">=", "<=", "==", "!=", "in"
    threshold: Any
    target_verdict: StabilityVerdict = StabilityVerdict.CAUTION
    unit: str = ""
    reason_code: str
    evidence_strength: str = "MODERATE"
    description: Optional[str] = None
    source_quantile: Optional[float] = None
    train_support_count: Optional[int] = None
    validation_support_count: Optional[int] = None


class StabilityPolicyModel(BaseModel):
    """Manifest-driven consensus policy settings (Zero hardcoded values in Python)."""
    min_available_families: int = 2
    high_risk_min_triggered_families: int = 2
    favorable_enabled: bool = False


class StabilityManifestModel(BaseModel):
    """Validated schema for external stability evidence manifests."""
    manifest_version: str = "1.1.0"
    manifest_type: Optional[str] = "POST_PASS_STABILITY_CONSENSUS"
    name: str = "KYNTRA Post-Pass Stability Evidence Manifest"
    derivation_date: Optional[str] = None
    dataset_filename: Optional[str] = "kyntra_overtake_dataset.parquet"
    dataset_sha256: Optional[str] = None
    dataset_identity: Optional[str] = None
    dataset_rows: Optional[int] = 8357
    train_rows: Optional[int] = 6197
    validation_rows: Optional[int] = 2160
    evaluation_horizons_laps: List[int] = Field(default_factory=lambda: [1, 2, 3])
    primary_stability_horizon_laps: int = 2
    rule_families: List[str] = Field(default_factory=lambda: ["PACE", "SPEED", "TYRE"])
    policy: StabilityPolicyModel = Field(default_factory=StabilityPolicyModel)
    demonstration_holdouts_strictly_isolated: List[str] = Field(default_factory=list)
    polarity_conventions: Dict[str, str] = Field(default_factory=dict)
    ordinal_stability_classes: List[str] = Field(default_factory=list)
    rules: List[ManifestRuleDefinition] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
