"""Typed interfaces and data models for energy state tracking.

Under KYNTRA engineering rules:
- Simulated values must NEVER be labeled as real telemetry.
- TelemetrySource explicitly tags data provenance.
"""

from datetime import timedelta
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class TelemetrySource(str, Enum):
    """Origin and provenance classification for energy measurements and states."""

    REAL_TEAM_TELEMETRY = "REAL_TEAM_TELEMETRY"
    SIMULATED = "SIMULATED"
    UNKNOWN = "UNKNOWN"


class EnergyState(BaseModel):
    """Conceptual energy state of a Formula 1 hybrid powertrain at a discrete timepoint."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    # Temporal & Spatial Coordinates
    timestamp: timedelta = Field(..., description="High-resolution elapsed session time")
    lap: int = Field(..., ge=1, description="1-indexed current lap number")
    sector: int = Field(..., ge=1, le=3, description="Track sector (1, 2, or 3)")

    # Energy Store State (MJ)
    energy_available_mj: float = Field(
        ...,
        ge=0.0,
        description="Current usable energy remaining in the Energy Store (MJ)",
    )
    energy_window_fraction: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Available energy expressed as a fraction of the 4.0 MJ regulatory window [0.0 - 1.0]",
    )

    # Lap Accumulators
    energy_harvested_this_lap_mj: float = Field(
        default=0.0,
        ge=0.0,
        description="Cumulative MGU-K electrical recovery during the current lap (MJ)",
    )
    energy_deployed_this_lap_mj: float = Field(
        default=0.0,
        ge=0.0,
        description="Cumulative MGU-K electrical deployment during the current lap (MJ)",
    )
    recharge_limit_remaining_mj: Optional[float] = Field(
        None,
        ge=0.0,
        description="Recharge allowance remaining on this lap before exceeding FIA limit (MJ)",
    )

    # Overtake (Manual Override) Status
    overtake_enabled: bool = Field(
        default=False,
        description="Whether Race Control has globally enabled the Manual Override system",
    )
    overtake_eligible: Optional[bool] = Field(
        None,
        description="Whether this specific car met the detection criteria (<1s gap) to activate overtake",
    )

    # Provenance
    source: TelemetrySource = Field(
        default=TelemetrySource.UNKNOWN,
        description="Source of data (REAL_TEAM_TELEMETRY, SIMULATED, or UNKNOWN)",
    )

    def is_real_telemetry(self) -> bool:
        """Return True only if source is genuine encrypted team telemetry."""
        return self.source == TelemetrySource.REAL_TEAM_TELEMETRY

    def is_simulated(self) -> bool:
        """Return True if values were calculated by an engineering or physics model."""
        return self.source == TelemetrySource.SIMULATED
