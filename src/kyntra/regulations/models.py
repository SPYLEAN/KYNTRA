"""Pydantic data models for FIA 2026 Energy & Technical Regulations.

Follows official FIA Formula 1 Technical Regulations (Article 5: Power Unit)
and Official Event Power Unit Information documents.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RegulationProvenance(BaseModel):
    """Provenance tracking for official regulatory documentation."""

    document: str = Field(..., description="Official technical regulation document name")
    issue: str = Field(..., description="Technical issue / amendment identifier")
    publication_date: str = Field(..., description="Technical publication date (YYYY-MM-DD)")
    governing_body: str = Field(default="FIA World Motor Sport Council")
    sporting_document: Optional[str] = Field(None, description="Official sporting regulation document name")
    sporting_issue: Optional[str] = Field(None, description="Sporting issue identifier")
    sporting_publication_date: Optional[str] = Field(None, description="Sporting publication date (YYYY-MM-DD)")
    articles: List[str] = Field(default_factory=list, description="Relevant cited regulation articles")
    source_url: str = Field(..., description="Official verification URL")


class TimingLineInfo(BaseModel):
    """Timing line coordinate and loop designation with explicit provenance status."""

    distance_m: float = Field(..., description="Track distance coordinate in meters")
    loop: str = Field(..., description="Timing loop designation (e.g. L21, L22_SC1)")
    source_status: str = Field(
        default="VERIFIED",
        description="Provenance status, e.g. VERIFIED or TBC_IN_FIA_DOCUMENT. Never convert TBC to VERIFIED.",
    )


class RaceRechargeLimit(BaseModel):
    """Event-specific Energy Store recharge limit under differing tactical modes."""

    overtake_inactive: float = Field(
        8.0, description="Maximum recharge ceiling per lap when overtake mode is inactive (MJ)"
    )
    overtake_active: float = Field(
        8.5, description="Maximum recharge ceiling per lap when overtake mode is active (MJ)"
    )


class EventProvenance(BaseModel):
    """Provenance tracking for official Race Director Event Information."""

    document: str = Field(..., description="Official event document identifier")
    title: str = Field(..., description="Document title")
    publication_date: str = Field(..., description="Publication date (YYYY-MM-DD)")
    issuer: str = Field(default="FIA Formula One Race Director")
    source_status: str = Field(default="OFFICIAL_EVENT_DOCUMENT")


class EventRegulationConfig(BaseModel):
    """Event-specific FIA regulation configuration overriding global defaults."""

    name: str = Field(..., description="Event name (e.g. Australian Grand Prix)")
    year: int = Field(2026, description="Championship year")
    round: Optional[int] = Field(None, description="Championship round number")
    circuit: Optional[str] = Field(None, description="Circuit name")
    provenance: Optional[EventProvenance] = Field(None, description="Event document provenance")

    detection_gap_seconds: float = Field(1.0, description="Detection gap threshold in seconds")
    detection_line: TimingLineInfo = Field(..., description="Circuit detection point")
    activation_line: TimingLineInfo = Field(..., description="Circuit overtake activation point")

    race_recharge_limit_mj: RaceRechargeLimit = Field(
        default_factory=RaceRechargeLimit,
        description="Event recharge limits (overtake inactive vs active)",
    )
    qualifying_recharge_limit_mj: float = Field(7.0, description="Qualifying recharge limit in MJ")
    free_practice_recharge_limit_mj: Optional[float] = Field(
        8.5, description="Free practice recharge limit in MJ"
    )
    power_reduction_rate_limit_kw_per_s: float = Field(
        50.0, description="Power reduction rate limit in kW/s"
    )


class PowerCurvePoint(BaseModel):
    """Single point in a power-speed limit curve."""

    speed_kmh: float = Field(..., ge=0.0, description="Vehicle speed in km/h")
    max_power_kw: float = Field(..., ge=0.0, le=350.0, description="Max allowable power in kW")


class PowerCurveConfig(BaseModel):
    """Piecewise power curve configuration defining maximum allowable power vs speed.

    Supports:
    1. Two-stage regulation normal curve (Article C5.2.8(i)):
       - For v < 340 km/h: P(kW) = 1800 - 5*v (subject to 0 <= P <= 350 kW)
       - For 340 <= v < 345 km/h: P(kW) = 6900 - 20*v (subject to 0 <= P <= 350 kW)
       - For v >= 345 km/h: P = 0 kW
    2. Regulation overtake curve (Article C5.2.8(ii)):
       - For v < 355 km/h: P(kW) = 7100 - 20*v (subject to 0 <= P <= 350 kW)
       - For v >= 355 km/h: P = 0 kW
    3. Generic / legacy piecewise linear curves.
    """

    curve_type: str = Field(default="two_stage_piecewise")
    base_power_kw: float = Field(default=350.0, ge=0.0, le=350.0)

    # Legacy parameters (optional)
    taper_start_speed_kmh: Optional[float] = Field(None, ge=0.0)
    taper_end_speed_kmh: Optional[float] = Field(None, ge=0.0)
    taper_slope_kw_per_kmh: Optional[float] = Field(None, description="Explicit tapering slope")
    points: List[PowerCurvePoint] = Field(default_factory=list)

    # Normal curve formula parameters (Article C5.2.8(i))
    stage1_intercept: float = Field(default=1800.0)
    stage1_slope: float = Field(default=-5.0)
    stage1_speed_cutoff: float = Field(default=340.0)
    stage2_intercept: float = Field(default=6900.0)
    stage2_slope: float = Field(default=-20.0)
    stage2_speed_cutoff: float = Field(default=345.0)

    # Overtake curve formula parameters (Article C5.2.8(ii))
    overtake_intercept: float = Field(default=7100.0)
    overtake_slope: float = Field(default=-20.0)
    overtake_speed_cutoff: float = Field(default=355.0)

    def get_max_power_at_speed(self, speed_kmh: float) -> float:
        """Calculate maximum allowable MGU-K power at a given vehicle speed.

        Follows official FIA 2026 mathematical piecewise formulas:
        - Normal curve:
          * v < 340 km/h: P = min(350, max(0, 1800 - 5*v))
          * 340 <= v < 345 km/h: P = min(350, max(0, 6900 - 20*v))
          * v >= 345 km/h: P = 0
        - Overtake curve:
          * v < 355 km/h: P = min(350, max(0, 7100 - 20*v))
          * v >= 355 km/h: P = 0
        """
        if self.curve_type in ("two_stage_piecewise", "normal_regulation"):
            if speed_kmh < self.stage1_speed_cutoff:
                power = self.stage1_intercept + self.stage1_slope * speed_kmh
                return max(0.0, min(self.base_power_kw, power))
            elif speed_kmh < self.stage2_speed_cutoff:
                power = self.stage2_intercept + self.stage2_slope * speed_kmh
                return max(0.0, min(self.base_power_kw, power))
            else:
                return 0.0

        if self.curve_type in ("overtake_piecewise", "overtake_regulation"):
            if speed_kmh < self.overtake_speed_cutoff:
                power = self.overtake_intercept + self.overtake_slope * speed_kmh
                return max(0.0, min(self.base_power_kw, power))
            else:
                return 0.0

        # Generic / legacy piecewise linear fallback
        if self.taper_start_speed_kmh is not None and self.taper_end_speed_kmh is not None:
            if speed_kmh <= self.taper_start_speed_kmh:
                return self.base_power_kw
            if speed_kmh >= self.taper_end_speed_kmh:
                return 0.0

            if self.taper_slope_kw_per_kmh is not None:
                power = self.base_power_kw + self.taper_slope_kw_per_kmh * (speed_kmh - self.taper_start_speed_kmh)
                return max(0.0, min(self.base_power_kw, power))

            speed_range = self.taper_end_speed_kmh - self.taper_start_speed_kmh
            if speed_range <= 0:
                return 0.0
            fraction = (self.taper_end_speed_kmh - speed_kmh) / speed_range
            return max(0.0, min(self.base_power_kw, self.base_power_kw * fraction))

        return self.base_power_kw


class FIARegulationConfig(BaseModel):
    """Comprehensive typed representation of FIA 2026 Power Unit and Energy Regulations."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str = Field(..., description="Regulation document title")
    version: str = Field(..., description="Version identifier")
    governing_body: str = Field(default="FIA")

    # Document Provenance
    provenance: Optional[RegulationProvenance] = Field(
        None, description="Regulatory documentation provenance"
    )

    # Optional Event-Specific Configuration Override
    event_config: Optional[EventRegulationConfig] = Field(
        None, description="Event-specific configuration overriding global defaults"
    )

    # MGU-K & Energy Storage Limits (FIA Article 5)
    ers_k_absolute_power_limit_kw: float = Field(
        350.0, ge=0.0, le=350.0, description="Absolute maximum MGU-K electrical power"
    )
    energy_store_usable_window_mj: float = Field(
        4.0,
        ge=0.0,
        description="Operational capacity delta between maximum and minimum state of charge (MJ). NOT a per-lap quota.",
    )
    recharge_limit_mj: float = Field(
        8.5, ge=0.0, description="Baseline maximum Energy Store recovery limit per lap in MJ"
    )
    event_specific_recharge_limit_mj: Optional[float] = Field(
        None, ge=0.0, description="Reduced or tailored recharge limit from FIA Event Notes"
    )

    # Power curves
    normal_power_curve: PowerCurveConfig
    overtake_power_curve: PowerCurveConfig

    # Circuit & Race Specific Conditions (Explicitly null if unconfigured)
    detection_gap: Optional[float] = Field(
        None, ge=0.0, description="Time gap threshold behind leading car at detection point"
    )
    detection_line: Optional[str] = Field(
        None, description="Circuit mini-sector or coordinate of detection point"
    )
    activation_line: Optional[str] = Field(
        None, description="Circuit mini-sector or coordinate of overtake activation zone"
    )
    overtake_enabled: bool = Field(
        True, description="Global race control manual override permission flag"
    )
    low_grip_condition: bool = Field(
        False, description="Whether low grip / wet conditions impose deployment limits"
    )
    safety_car_active: bool = Field(
        False, description="Whether Safety Car or VSC is deployed"
    )

    def apply_event_config(self, event_config: EventRegulationConfig) -> None:
        """Apply event-specific configuration according to regulatory hierarchy."""
        self.event_config = event_config
        self.detection_gap = event_config.detection_gap_seconds
        self.detection_line = f"{event_config.detection_line.loop} ({event_config.detection_line.distance_m:.0f}m)"
        self.activation_line = f"{event_config.activation_line.loop} ({event_config.activation_line.distance_m:.0f}m)"

    def get_effective_recharge_limit_mj(self, is_overtake_active: bool = False) -> float:
        """Return effective recharge limit adhering to the hierarchy:
        1. Event-specific FIA configuration (if set):
           - if overtake active: race_recharge_limit_mj.overtake_active (e.g. 8.5 MJ)
           - if overtake inactive: race_recharge_limit_mj.overtake_inactive (e.g. 8.0 MJ)
        2. Fallback event_specific_recharge_limit_mj on FIARegulationConfig (if set)
        3. Global baseline recharge_limit_mj (8.5 MJ)
        """
        if self.event_config is not None:
            if is_overtake_active:
                return self.event_config.race_recharge_limit_mj.overtake_active
            return self.event_config.race_recharge_limit_mj.overtake_inactive
        if self.event_specific_recharge_limit_mj is not None:
            return self.event_specific_recharge_limit_mj
        return self.recharge_limit_mj

    def get_unconfigured_parameters(self) -> List[str]:
        """List sporting / circuit parameters that are unconfigured (None)."""
        unconfigured = []
        if self.detection_gap is None:
            unconfigured.append("detection_gap")
        if self.detection_line is None:
            unconfigured.append("detection_line")
        if self.activation_line is None:
            unconfigured.append("activation_line")
        return unconfigured

    def verify_provenance(self) -> bool:
        """Check whether regulation provenance is documented."""
        return self.provenance is not None and bool(self.provenance.document and self.provenance.source_url)

