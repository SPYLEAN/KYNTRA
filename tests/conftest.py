"""Test fixtures and synthetic mock data for KYNTRA test suite."""

import sys
from pathlib import Path
from unittest.mock import MagicMock
import numpy as np
import pandas as pd
import pytest

# Ensure src directory is in sys.path for test imports
TESTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TESTS_DIR.parent
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


@pytest.fixture
def mock_fastf1_session():
    """Build a mock FastF1 Session object with synthetic lap data for offline tests."""
    mock_session = MagicMock()

    # Mock event metadata
    mock_session.event.year = 2024
    mock_session.event.__getitem__.side_effect = lambda k: "Bahrain Grand Prix" if k == "EventName" else None
    mock_session.name = "Race"

    # Synthetic lap data
    data = {
        "Driver": ["VER", "VER", "VER", "HAM", "HAM", "HAM"],
        "DriverNumber": ["1", "1", "1", "44", "44", "44"],
        "LapNumber": [1, 2, 3, 1, 2, 3],
        "Position": [1.0, 1.0, 1.0, 2.0, 2.0, 3.0],
        "LapTime": [
            pd.Timedelta(96.4, unit="s"),
            pd.Timedelta(95.1, unit="s"),
            pd.Timedelta(95.3, unit="s"),
            pd.Timedelta(97.2, unit="s"),
            pd.Timedelta(96.0, unit="s"),
            pd.Timedelta(96.5, unit="s"),
        ],
        "Sector1Time": [
            pd.Timedelta(30.1, unit="s"),
            pd.Timedelta(29.8, unit="s"),
            pd.Timedelta(29.9, unit="s"),
            pd.Timedelta(30.5, unit="s"),
            pd.Timedelta(30.0, unit="s"),
            pd.Timedelta(30.2, unit="s"),
        ],
        "Sector2Time": [
            pd.Timedelta(41.2, unit="s"),
            pd.Timedelta(40.5, unit="s"),
            pd.Timedelta(40.6, unit="s"),
            pd.Timedelta(41.5, unit="s"),
            pd.Timedelta(41.0, unit="s"),
            pd.Timedelta(41.1, unit="s"),
        ],
        "Sector3Time": [
            pd.Timedelta(25.1, unit="s"),
            pd.Timedelta(24.8, unit="s"),
            pd.Timedelta(24.8, unit="s"),
            pd.Timedelta(25.2, unit="s"),
            pd.Timedelta(25.0, unit="s"),
            pd.Timedelta(25.2, unit="s"),
        ],
        "Compound": ["SOFT", "SOFT", "SOFT", "MEDIUM", "MEDIUM", "MEDIUM"],
        "TyreLife": [1.0, 2.0, 3.0, 1.0, 2.0, 3.0],
        "Stint": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        "PitInTime": [pd.NaT, pd.NaT, pd.NaT, pd.NaT, pd.NaT, pd.Timedelta(96.5, unit="s")],
        "PitOutTime": [pd.NaT, pd.NaT, pd.NaT, pd.NaT, pd.NaT, pd.NaT],
        "TrackStatus": ["1", "1", "1", "1", "1", "2"],
        "IsAccurate": [True, True, True, True, True, False],
        "Team": [
            "Red Bull Racing",
            "Red Bull Racing",
            "Red Bull Racing",
            "Mercedes",
            "Mercedes",
            "Mercedes",
        ],
    }
    df = pd.DataFrame(data)
    df["PitInTime"] = pd.to_timedelta(df["PitInTime"])
    df["PitOutTime"] = pd.Series([pd.NaT] * len(df), dtype="timedelta64[ns]")
    mock_session.laps = df
    return mock_session
