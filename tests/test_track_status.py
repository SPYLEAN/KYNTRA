"""Tests for track status parsing and semantic separation."""

from kyntra.processing.track_status import (
    is_red_flag_active,
    is_safety_car_active,
    is_track_clear,
    is_yellow_flag_active,
    parse_track_status_codes,
)


def test_parse_track_status_single():
    """Verify single digit parsing."""
    assert parse_track_status_codes("1") == ["1"]
    assert parse_track_status_codes("2") == ["2"]
    assert parse_track_status_codes("4") == ["4"]


def test_parse_track_status_composite_no_semantic_guess():
    """Verify composite status (e.g. '12', '21') decomposes into raw digits without semantic guessing."""
    assert parse_track_status_codes("12") == ["1", "2"]
    assert parse_track_status_codes("21") == ["2", "1"]
    assert parse_track_status_codes("24") == ["2", "4"]


def test_parse_track_status_empty_or_none():
    """Verify safe handling of null, empty or invalid values."""
    assert parse_track_status_codes(None) == []
    assert parse_track_status_codes("") == []
    assert parse_track_status_codes("nan") == []


def test_track_condition_flags():
    """Verify boolean condition flags."""
    # Green/clear
    assert is_track_clear("1") is True
    assert is_track_clear("12") is False  # Contains yellow '2'
    assert is_yellow_flag_active("12") is True
    assert is_yellow_flag_active("21") is True

    # Safety car
    assert is_safety_car_active("4") is True
    assert is_safety_car_active("24") is True
    assert is_safety_car_active("6") is True  # VSC
    assert is_safety_car_active("1") is False

    # Red flag
    assert is_red_flag_active("5") is True
    assert is_red_flag_active("1") is False
