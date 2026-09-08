"""Tests for lap normalization logic."""

import pandas as pd
import pytest
from kyntra.processing.normalizer import (
    PROVENANCE_FIELDS,
    REQUIRED_FIELDS,
    TIMEDELTA_FIELDS,
    normalize_laps,
)


def test_normalize_laps_columns_and_provenance(mock_fastf1_session):
    """Verify normalize_laps retains required fields and injects provenance."""
    df = normalize_laps(mock_fastf1_session)

    # Check provenance
    for field in PROVENANCE_FIELDS:
        assert field in df.columns
    assert (df["season"] == 2024).all()
    assert (df["event_name"] == "Bahrain Grand Prix").all()
    assert (df["session_type"] == "Race").all()

    # Check required fields
    for field in REQUIRED_FIELDS:
        assert field in df.columns

    # Check total shape
    assert len(df) == 6
    assert set(df["Driver"].unique()) == {"VER", "HAM"}


def test_normalize_laps_timedeltas_and_types(mock_fastf1_session):
    """Verify timedelta types and categorical types are strictly preserved."""
    df = normalize_laps(mock_fastf1_session)

    for td_col in TIMEDELTA_FIELDS:
        assert pd.api.types.is_timedelta64_dtype(df[td_col])

    assert pd.api.types.is_integer_dtype(df["LapNumber"])
    assert pd.api.types.is_float_dtype(df["Position"])
    assert pd.api.types.is_string_dtype(df["Driver"])
    assert pd.api.types.is_string_dtype(df["DriverNumber"])
    assert pd.api.types.is_string_dtype(df["Team"])


def test_normalize_laps_no_fabricated_missing_values(mock_fastf1_session):
    """Verify that null values (e.g. PitInTime, PitOutTime) are preserved as NaT/NA without fabrication."""
    df = normalize_laps(mock_fastf1_session)

    # PitOutTime in mock was completely null
    assert df["PitOutTime"].isna().all()
    # PitInTime had exactly 1 event (HAM lap 3)
    assert df["PitInTime"].notna().sum() == 1
    assert pd.isna(df.loc[df["Driver"] == "VER", "PitInTime"]).all()


def test_normalize_laps_empty_session():
    """Verify normalize_laps raises ValueError on empty session."""
    mock_session = pytest.importorskip("unittest.mock").MagicMock()
    mock_session.laps = pd.DataFrame()
    with pytest.raises(ValueError, match="empty or uninitialized"):
        normalize_laps(mock_session)
