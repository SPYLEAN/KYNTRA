"""Lap-level data normalization for KYNTRA."""

from typing import List
import logging
import pandas as pd
from fastf1.core import Session

logger = logging.getLogger(__name__)

# Standard core columns to select and normalize
REQUIRED_FIELDS: List[str] = [
    "Driver",
    "DriverNumber",
    "LapNumber",
    "Position",
    "LapTime",
    "Sector1Time",
    "Sector2Time",
    "Sector3Time",
    "Compound",
    "TyreLife",
    "Stint",
    "PitInTime",
    "PitOutTime",
    "TrackStatus",
    "IsAccurate",
    "Team",
]

PROVENANCE_FIELDS: List[str] = [
    "season",
    "event_name",
    "session_type",
]

TIMEDELTA_FIELDS: List[str] = [
    "LapTime",
    "Sector1Time",
    "Sector2Time",
    "Sector3Time",
    "PitInTime",
    "PitOutTime",
]

OPTIONAL_TIMING_FIELDS: List[str] = [
    "Time",
    "Sector1SessionTime",
    "Sector2SessionTime",
    "Sector3SessionTime",
    "SpeedI1",
    "SpeedI2",
    "SpeedFL",
    "SpeedST",
]


def _safe_to_timedelta(series: pd.Series) -> pd.Series:
    """Safely convert a pandas Series to timedelta64[ns], preserving NaT."""
    if pd.api.types.is_timedelta64_dtype(series):
        return series
    if pd.api.types.is_datetime64_dtype(series):
        if series.isna().all():
            return pd.Series(pd.NaT, index=series.index, dtype="timedelta64[ns]")
        return pd.to_timedelta(series.astype("int64"), unit="ns")
    return pd.to_timedelta(series, errors="coerce")


def normalize_laps(session: Session) -> pd.DataFrame:
    """Extract and normalize lap-level data from a FastF1 Session.

    Rules strictly observed:
    - Provenance metadata preserved (season, event_name, session_type).
    - Preserves all available real fields.
    - Preserves exact missingness without synthetic imputation or fabrication.
    - Timedeltas are consistently cast to timedelta64[ns] (native Parquet duration support).
    - Consistent typed schemas for categorical and identifier columns.

    Args:
        session: Fully loaded FastF1 Session object.

    Returns:
        pd.DataFrame: Clean, normalized lap-level dataframe.

    Raises:
        ValueError: If session laps dataframe is missing or empty.
    """
    if session.laps is None or session.laps.empty:
        raise ValueError("Session laps dataset is empty or uninitialized.")

    raw_laps = session.laps.copy()

    # 1. Extract provenance metadata
    season: int = int(session.event.year)
    event_name: str = str(session.event["EventName"])
    session_type: str = str(session.name)

    # 2. Extract available required fields
    df = pd.DataFrame()
    for col in REQUIRED_FIELDS:
        if col in raw_laps.columns:
            df[col] = raw_laps[col].copy()
        else:
            logger.warning("Field '%s' not present in session laps; setting as null", col)
            df[col] = pd.NA

    # 2b. Extract optional timing and speed fields if present in raw_laps
    for col in OPTIONAL_TIMING_FIELDS:
        if col in raw_laps.columns and col not in df.columns:
            if "Time" in col:
                df[col] = _safe_to_timedelta(raw_laps[col])
            else:
                df[col] = raw_laps[col].copy()

    # 3. Add provenance columns at the start
    df.insert(0, "season", season)
    df.insert(1, "event_name", event_name)
    df.insert(2, "session_type", session_type)

    # 4. Standardize identifiers and strings
    df["Driver"] = df["Driver"].astype(str)
    df["DriverNumber"] = df["DriverNumber"].astype(str)
    df["Team"] = df["Team"].astype(str)

    # Clean compound names (preserving missing values)
    df["Compound"] = df["Compound"].apply(
        lambda x: str(x).upper() if pd.notna(x) and str(x).strip() != "" else pd.NA
    )

    # Track status as string code (e.g., '1', '2', '4', etc.)
    df["TrackStatus"] = df["TrackStatus"].apply(
        lambda x: str(x) if pd.notna(x) else pd.NA
    )

    # 5. Standardize numeric columns
    df["LapNumber"] = pd.to_numeric(df["LapNumber"], errors="coerce").astype("int64")
    df["Position"] = pd.to_numeric(df["Position"], errors="coerce").astype("float64")
    df["TyreLife"] = pd.to_numeric(df["TyreLife"], errors="coerce").astype("float64")
    df["Stint"] = pd.to_numeric(df["Stint"], errors="coerce").astype("float64")

    # 6. Ensure timedelta columns are consistently represented as timedelta64[ns]
    for td_col in TIMEDELTA_FIELDS:
        if td_col in df.columns:
            df[td_col] = _safe_to_timedelta(df[td_col])

    # 7. Boolean casting (preserve None/NA)
    df["IsAccurate"] = df["IsAccurate"].astype("boolean")

    # 8. Deterministic ordering: by LapNumber, then Position (handling NaNs), then Driver
    df = df.sort_values(
        by=["LapNumber", "Position", "Driver"],
        ascending=[True, True, True],
        na_position="last",
    ).reset_index(drop=True)

    logger.info(
        "Normalized %d laps across %d drivers for %d %s",
        len(df),
        df["Driver"].nunique(),
        season,
        event_name,
    )

    return df


# Alias for backward compatibility
normalize_session_laps = normalize_laps

