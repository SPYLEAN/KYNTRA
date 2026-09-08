"""Data schemas and Pydantic validation models for KYNTRA."""

from datetime import timedelta
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, ConfigDict, Field


class NormalizedLapSchema(BaseModel):
    """Schema for a single normalized lap row in KYNTRA."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    # Provenance
    season: int = Field(..., description="F1 Championship season year")
    event_name: str = Field(..., description="Grand Prix name (e.g. Bahrain Grand Prix)")
    session_type: str = Field(..., description="Session identifier, e.g. 'R' for Race")

    # Driver & Car
    Driver: str = Field(..., description="Three-letter driver code (e.g. VER, HAM)")
    DriverNumber: str = Field(..., description="Car number as string")
    Team: Optional[str] = Field(None, description="Constructor / team name")

    # Lap & Race State
    LapNumber: int = Field(..., description="1-indexed lap number")
    Position: Optional[float] = Field(None, description="Track position at lap completion")
    LapTime: Optional[timedelta] = Field(None, description="Lap duration")
    Sector1Time: Optional[timedelta] = Field(None, description="Sector 1 duration")
    Sector2Time: Optional[timedelta] = Field(None, description="Sector 2 duration")
    Sector3Time: Optional[timedelta] = Field(None, description="Sector 3 duration")

    # Tyres & Stint
    Compound: Optional[str] = Field(None, description="Tyre compound (SOFT, MEDIUM, HARD, etc.)")
    TyreLife: Optional[float] = Field(None, description="Laps driven on this tyre set")
    Stint: Optional[int] = Field(None, description="Driver stint number in the race")

    # Pit & Track Conditions
    PitInTime: Optional[timedelta] = Field(None, description="Time driver entered pit lane")
    PitOutTime: Optional[timedelta] = Field(None, description="Time driver exited pit lane")
    TrackStatus: Optional[str] = Field(None, description="Track status code (1=Green, 2=Yellow, etc.)")
    IsAccurate: Optional[bool] = Field(None, description="FastF1 timing accuracy flag")


class MissingnessMetric(BaseModel):
    """Missing value statistics for a column."""

    missing_count: int
    total_count: int
    missing_pct: float


class ValidationReport(BaseModel):
    """Validation report summarizing race data quality and integrity."""

    season: int
    event_name: str
    session_type: str
    num_drivers: int
    driver_codes: List[str]
    num_laps: int
    lap_range: Tuple[int, int]
    available_compounds: List[str]
    pit_stop_rows: int
    track_status_values: List[str]
    missingness: Dict[str, MissingnessMetric]

    def summary_text(self) -> str:
        """Render a readable text summary of the validation report."""
        lines = [
            "=" * 60,
            f"KYNTRA RACE VALIDATION REPORT: {self.season} {self.event_name} ({self.session_type})",
            "=" * 60,
            f"Total Drivers       : {self.num_drivers} ({', '.join(self.driver_codes[:10])}{'...' if len(self.driver_codes) > 10 else ''})",
            f"Total Laps          : {self.num_laps}",
            f"Lap Range           : Laps {self.lap_range[0]} to {self.lap_range[1]}",
            f"Available Compounds : {', '.join(self.available_compounds)}",
            f"Pit-Stop Entries    : {self.pit_stop_rows} in-laps detected",
            f"Track Status Values : {', '.join(self.track_status_values)}",
            "-" * 60,
            "Missingness Summary (Field: Count / Total [Percentage]):",
        ]
        for field, metric in self.missingness.items():
            lines.append(
                f"  - {field:<16}: {metric.missing_count:>4} / {metric.total_count:>4} ({metric.missing_pct:6.2f}%)"
            )
        lines.append("=" * 60)
        return "\n".join(lines)


# ==============================================================================
# DecisionSnapshot Contract Schemas (Phase 3 Backend ↔ Frontend)
# ==============================================================================

class RaceStateSnapshot(BaseModel):
    """Race session identifiers and car positions at decision time."""
    event_id: Optional[str] = None
    event_name: Optional[str] = None
    lap: Optional[int] = None
    replay_time: Optional[float] = None
    attacker: Optional[str] = None
    defender: Optional[str] = None
    attacker_position: Optional[int] = None
    defender_position: Optional[int] = None


class ProvenanceSnapshot(BaseModel):
    """Source traceability for telemetry, models, and regulations."""
    telemetry_source: str = "REAL_PUBLIC_TELEMETRY"
    energy_source: str = "SIMULATED"
    regulation_config_version: Optional[str] = "2026_FIA_ISSUE_20"
    event_config_version: Optional[str] = "2026_V1"
    overtake_model_version: Optional[str] = "1.0.0"
    stability_method: Optional[str] = "DETERMINISTIC_POST_PASS_STABILITY_V1"


class BattleStateSnapshot(BaseModel):
    """Relative tactical race observables between attacker and defender."""
    gap_seconds: Optional[float] = None
    distance_gap_m: Optional[float] = None
    closing_rate: Optional[float] = None
    speed_delta: Optional[float] = None
    tyre_age_delta: Optional[float] = None
    laps_following: Optional[int] = None
    rear_threat: Optional[str] = None


class OvertakeInferenceSnapshot(BaseModel):
    """Frozen LightGBM overtake probabilities with monotonic horizon projection."""
    available: bool = False
    model_version: Optional[str] = "1.0.0"
    p_1_lap: Optional[float] = None
    p_2_laps: Optional[float] = None
    p_3_laps: Optional[float] = None
    raw_p_1_lap: Optional[float] = None
    raw_p_2_laps: Optional[float] = None
    raw_p_3_laps: Optional[float] = None
    horizon_projection_applied: bool = False
    feature_missingness: List[str] = Field(default_factory=list)


class StabilitySnapshot(BaseModel):
    """Deterministic post-pass position durability evaluation (No ML retention in V1)."""
    method: str = "DETERMINISTIC_POST_PASS_STABILITY_V1"
    verdict: str = "UNKNOWN"  # FAVORABLE | CAUTION | HIGH_RISK | UNKNOWN
    available: bool = False
    evidence: List[str] = Field(default_factory=list)
    reason: Optional[str] = "STABILITY_RULESET_PENDING_VERIFICATION"


class EnergySnapshot(BaseModel):
    """Simulated 2026 regulation-constrained electrical energy state."""
    available_energy_mj: Optional[float] = None
    fraction: Optional[float] = None
    scenario: Optional[str] = None
    simulated: bool = True
    provenance: str = "SIMULATED"
    projected_action_cost_mj: Optional[float] = None
    projected_post_action_reserve_mj: Optional[float] = None
    sensitivity: Optional[str] = None  # ROBUST | ENERGY_SENSITIVE


class ComplianceSnapshot(BaseModel):
    """Deterministic FIA regulation and track status compliance."""
    status: str = "UNKNOWN"  # LEGAL | BLOCKED | UNKNOWN
    allowed_actions: List[str] = Field(default_factory=list)
    blocked_actions: List[str] = Field(default_factory=list)
    reason_codes: List[str] = Field(default_factory=list)


class CounterfactualActionSnapshot(BaseModel):
    """Scenario simulation for a candidate tactical action."""
    action: str  # CONSERVE | BUILD | DEPLOY | OVERTAKE
    available: bool = False
    feasible: Optional[bool] = None
    pass_outcome: Optional[str] = None
    retention_outcome: Optional[str] = None
    ending_energy_mj: Optional[float] = None
    future_opportunity: Optional[str] = None
    rank: Optional[int] = None
    reason: Optional[str] = "COUNTERFACTUAL_ENGINE_PENDING_VERIFICATION"


class RecommendationSnapshot(BaseModel):
    """KYNTRA Call: tactical recommendation and structured fact rationale."""
    available: bool = False
    canonical_action: Optional[str] = None  # CONSERVE | BUILD | DEPLOY | OVERTAKE
    ui_label: Optional[str] = None          # SAVE ENERGY | PREPARE | APPLY PRESSURE | OVERTAKE NOW
    robust: Optional[bool] = None
    energy_sensitive: Optional[bool] = None
    why: List[str] = Field(default_factory=list)
    reason: Optional[str] = "STRATEGY_ENGINE_PENDING_VERIFICATION"


class DecisionSnapshot(BaseModel):
    """Complete coherent tactical decision snapshot for KYNTRA UI and API."""
    race: RaceStateSnapshot
    provenance: ProvenanceSnapshot
    battle: BattleStateSnapshot
    overtake: OvertakeInferenceSnapshot
    energy: EnergySnapshot
    stability: StabilitySnapshot
    compliance: ComplianceSnapshot
    counterfactuals: List[CounterfactualActionSnapshot]
    recommendation: RecommendationSnapshot

