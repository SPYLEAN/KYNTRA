"""Telemetry extraction pipeline preserving raw FastF1 channels."""

from typing import List, Optional
import logging
import numpy as np
import pandas as pd
from fastf1.core import Session

logger = logging.getLogger(__name__)

RAW_TELEMETRY_CHANNELS: List[str] = [
    "Speed",
    "Throttle",
    "Brake",
    "RPM",
    "nGear",
    "Distance",
    "SessionTime",
    "X",
    "Y",
    "Z",
    "DriverAhead",
    "DistanceToDriverAhead",
]


def extract_driver_telemetry(
    session: Session,
    driver: str,
    lap_numbers: Optional[List[int]] = None,
) -> pd.DataFrame:
    """Extract and compile raw high-frequency telemetry for a specified driver.

    Preserves raw values for:
    Speed, Throttle, Brake, RPM, nGear, Distance, SessionTime, X, Y, Z,
    DriverAhead, DistanceToDriverAhead.

    Args:
        session: Fully loaded FastF1 Session object with telemetry=True.
        driver: Driver code or car number (e.g. '63').
        lap_numbers: Optional subset of lap numbers to extract. If None, extracts all.

    Returns:
        pd.DataFrame: Continuous telemetry trace with provenance columns and sample delta (dt_s).

    Raises:
        ValueError: If driver not found or session has no laps.
    """
    if session.laps is None or session.laps.empty:
        raise ValueError("Session contains no lap data.")

    driver_laps = session.laps.pick_drivers(driver)
    if driver_laps.empty:
        raise ValueError(f"No laps found for driver '{driver}' in this session.")

    if lap_numbers is not None:
        driver_laps = driver_laps[driver_laps["LapNumber"].isin(lap_numbers)]
        if driver_laps.empty:
            raise ValueError(f"No laps match requested lap numbers {lap_numbers} for driver '{driver}'.")

    telemetry_frames: List[pd.DataFrame] = []

    for _, lap_row in driver_laps.iterlaps():
        lap_num = int(lap_row["LapNumber"])
        try:
            lap_tel = lap_row.get_telemetry()
        except Exception as exc:
            logger.warning("Could not load telemetry for driver %s lap %d: %s", driver, lap_num, exc)
            continue

        if lap_tel.empty:
            continue

        # Extract available required channels
        frame = pd.DataFrame()
        for ch in RAW_TELEMETRY_CHANNELS:
            if ch in lap_tel.columns:
                frame[ch] = lap_tel[ch].copy()
            else:
                frame[ch] = np.nan

        # Attach lap provenance
        frame.insert(0, "Driver", str(driver))
        frame.insert(1, "LapNumber", lap_num)

        telemetry_frames.append(frame)

    if not telemetry_frames:
        raise ValueError(f"No valid telemetry samples extracted for driver '{driver}'.")

    combined_df = pd.concat(telemetry_frames, ignore_index=True)

    # Compute high-precision sample duration delta (dt_s) in seconds
    session_times = pd.to_timedelta(combined_df["SessionTime"])
    dt_series = session_times.diff().dt.total_seconds()
    # Replace initial/negative transitions with median sampling frequency (~0.1s)
    median_dt = dt_series[dt_series > 0].median() if not dt_series[dt_series > 0].empty else 0.1
    dt_series = dt_series.fillna(median_dt)
    dt_series = dt_series.apply(lambda x: median_dt if x <= 0 or x > 1.0 else x)
    combined_df["dt_s"] = dt_series

    logger.info(
        "Extracted %d telemetry samples across %d laps for driver %s",
        len(combined_df),
        combined_df["LapNumber"].nunique(),
        driver,
    )

    return combined_df
