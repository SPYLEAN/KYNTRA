"""Validation suite and data quality reporting for KYNTRA."""

from typing import Dict
import pandas as pd
from kyntra.schemas import MissingnessMetric, ValidationReport


def generate_validation_report(df: pd.DataFrame) -> ValidationReport:
    """Analyze normalized race lap data and generate a comprehensive validation report.

    Metrics calculated:
    - Number of unique drivers and their codes
    - Total lap records in the dataset
    - Lap range (min to max lap number)
    - Distinct tyre compounds observed
    - Pit-stop entries (rows where PitInTime is not null)
    - Distinct track-status codes
    - Per-field missingness counts and percentages

    Args:
        df: Normalized race lap DataFrame.

    Returns:
        ValidationReport: Structured quality report with summary formatting.

    Raises:
        ValueError: If DataFrame is empty.
    """
    if df.empty:
        raise ValueError("Cannot generate validation report on an empty DataFrame.")

    total_rows = len(df)

    # 1. Driver statistics
    unique_drivers = sorted(df["Driver"].dropna().unique().tolist())
    num_drivers = len(unique_drivers)

    # 2. Lap statistics
    min_lap = int(df["LapNumber"].min())
    max_lap = int(df["LapNumber"].max())

    # 3. Available compounds
    compounds = sorted(
        [str(c) for c in df["Compound"].dropna().unique() if str(c).strip() != ""]
    )

    # 4. Pit stops (rows where a driver entered the pits on that lap)
    pit_in_count = int(df["PitInTime"].notna().sum()) if "PitInTime" in df.columns else 0

    # 5. Track status values
    track_statuses = sorted(
        [str(ts) for ts in df["TrackStatus"].dropna().unique() if str(ts).strip() != ""]
    )

    # 6. Missingness analysis across all columns
    missingness_dict: Dict[str, MissingnessMetric] = {}
    for col in df.columns:
        null_count = int(df[col].isna().sum())
        null_pct = round((null_count / total_rows) * 100.0, 2)
        missingness_dict[col] = MissingnessMetric(
            missing_count=null_count,
            total_count=total_rows,
            missing_pct=null_pct,
        )

    # Extract provenance for the report
    season = int(df["season"].iloc[0]) if "season" in df.columns else 0
    event_name = str(df["event_name"].iloc[0]) if "event_name" in df.columns else "Unknown Event"
    session_type = str(df["session_type"].iloc[0]) if "session_type" in df.columns else "Unknown Session"

    return ValidationReport(
        season=season,
        event_name=event_name,
        session_type=session_type,
        num_drivers=num_drivers,
        driver_codes=unique_drivers,
        num_laps=total_rows,
        lap_range=(min_lap, max_lap),
        available_compounds=compounds,
        pit_stop_rows=pit_in_count,
        track_status_values=track_statuses,
        missingness=missingness_dict,
    )
