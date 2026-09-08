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
