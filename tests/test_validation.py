"""Tests for data validation checks and reporting."""

import pytest
from kyntra.processing.normalizer import normalize_laps
from kyntra.processing.validation import generate_validation_report
from kyntra.schemas import ValidationReport


def test_generate_validation_report_metrics(mock_fastf1_session):
    """Verify validation report computes driver, lap, missingness, and compound stats."""
    df = normalize_laps(mock_fastf1_session)
    report = generate_validation_report(df)

    assert isinstance(report, ValidationReport)
    assert report.num_drivers == 2
    assert set(report.driver_codes) == {"HAM", "VER"}
    assert report.num_laps == 6
    assert report.lap_range == (1, 3)
    assert set(report.available_compounds) == {"MEDIUM", "SOFT"}
    assert report.pit_stop_rows == 1
    assert set(report.track_status_values) == {"1", "2"}

    # Missingness check
    assert report.missingness["PitOutTime"].missing_count == 6
    assert report.missingness["PitOutTime"].missing_pct == 100.0
    assert report.missingness["LapTime"].missing_count == 0
    assert report.missingness["LapTime"].missing_pct == 0.0

    # Summary text renders without errors
    summary = report.summary_text()
    assert "KYNTRA RACE VALIDATION REPORT" in summary
    assert "Total Drivers       : 2" in summary


def test_generate_validation_report_empty():
    """Verify validation report generation fails on empty dataframe."""
    import pandas as pd
    with pytest.raises(ValueError, match="Cannot generate validation report"):
        generate_validation_report(pd.DataFrame())
