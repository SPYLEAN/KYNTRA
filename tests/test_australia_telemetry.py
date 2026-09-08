"""Tests for driver telemetry extraction pipeline."""

from unittest.mock import MagicMock
import pandas as pd
import pytest
from kyntra.ingestion.telemetry import RAW_TELEMETRY_CHANNELS, extract_driver_telemetry


@pytest.fixture
def mock_telemetry_session():
    """Build mock session with synthetic lap and telemetry data for offline testing."""
    session = MagicMock()

    # FastF1 Laps mock
    mock_laps = MagicMock()
    mock_laps.empty = False

    # Driver laps mock
    mock_driver_laps = MagicMock()
    mock_driver_laps.empty = False
    mock_driver_laps.nunique.return_value = 2

    # Mock individual lap rows
    lap2_mock = MagicMock()
    lap2_mock.__getitem__.side_effect = lambda k: 2 if k == "LapNumber" else "63"

    lap3_mock = MagicMock()
    lap3_mock.__getitem__.side_effect = lambda k: 3 if k == "LapNumber" else "63"

    # Synthetic telemetry samples
    tel_data = {
        "Speed": [120.0, 150.0, 220.0],
        "Throttle": [50.0, 80.0, 100.0],
        "Brake": [False, False, False],
        "RPM": [9000, 10500, 11800],
        "nGear": [3, 4, 5],
        "Distance": [10.0, 30.0, 60.0],
        "SessionTime": [
            pd.Timedelta(100.0, unit="s"),
            pd.Timedelta(100.1, unit="s"),
            pd.Timedelta(100.2, unit="s"),
        ],
        "X": [100.0, 120.0, 150.0],
        "Y": [200.0, 210.0, 225.0],
        "Z": [10.0, 10.0, 10.0],
        "DriverAhead": ["1", "1", "1"],
        "DistanceToDriverAhead": [15.0, 14.5, 13.8],
    }
    tel_df = pd.DataFrame(tel_data)
    lap2_mock.get_telemetry.return_value = tel_df.copy()
    lap3_mock.get_telemetry.return_value = tel_df.copy()

    mock_driver_laps.iterlaps.return_value = [
        (0, lap2_mock),
        (1, lap3_mock),
    ]
    mock_driver_laps.__getitem__.side_effect = lambda s: mock_driver_laps

    mock_laps.pick_drivers.return_value = mock_driver_laps
    session.laps = mock_laps
    return session


def test_extract_driver_telemetry_channels(mock_telemetry_session):
    """Verify extract_driver_telemetry preserves all raw channels and computes dt_s."""
    df = extract_driver_telemetry(mock_telemetry_session, driver="63")

    assert not df.empty
    assert "Driver" in df.columns
    assert "LapNumber" in df.columns
    assert "dt_s" in df.columns

    for ch in RAW_TELEMETRY_CHANNELS:
        assert ch in df.columns

    assert (df["Driver"] == "63").all()
    assert (df["dt_s"] > 0.0).all()
    assert len(df) == 6  # 3 points * 2 laps


def test_extract_driver_telemetry_driver_not_found():
    """Verify ValueError when driver does not exist in session."""
    session = MagicMock()
    mock_laps = MagicMock()
    mock_laps.empty = False
    mock_laps.pick_drivers.return_value = pd.DataFrame()
    session.laps = mock_laps

    with pytest.raises(ValueError, match="No laps found for driver"):
        extract_driver_telemetry(session, driver="999")
