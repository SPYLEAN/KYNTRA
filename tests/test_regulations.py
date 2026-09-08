"""Tests for FIA 2026 regulation configuration and loader."""

import pytest
from kyntra.regulations.loader import RegulationConfigError, load_fia_2026_config
from kyntra.regulations.models import FIARegulationConfig


def test_load_fia_2026_config_defaults():
    """Verify loading default configs/fia_2026_energy.yaml."""
    config = load_fia_2026_config()
    assert isinstance(config, FIARegulationConfig)
    assert config.ers_k_absolute_power_limit_kw == 350.0
    assert config.energy_store_usable_window_mj == 4.0
    assert config.recharge_limit_mj == 8.5
    assert config.event_specific_recharge_limit_mj is None
    assert config.get_effective_recharge_limit_mj() == 8.5

    # Unconfigured parameters are detected explicitly as null
    unconfigured = config.get_unconfigured_parameters()
    assert "detection_gap" in unconfigured
    assert "detection_line" in unconfigured
    assert "activation_line" in unconfigured


def test_power_curve_tapering_normal():
    """Verify normal power curve two-stage tapering behavior."""
    config = load_fia_2026_config()
    normal = config.normal_power_curve

    # Below 290 km/h -> full 350 kW
    assert normal.get_max_power_at_speed(100.0) == 350.0
    assert normal.get_max_power_at_speed(290.0) == 350.0

    # At 315 km/h: 1800 - 5*(315) = 225.0 kW
    assert pytest.approx(normal.get_max_power_at_speed(315.0), rel=1e-3) == 225.0

    # At 340 km/h: 6900 - 20*(340) = 100.0 kW
    assert pytest.approx(normal.get_max_power_at_speed(340.0), rel=1e-3) == 100.0

    # At 345 km/h and above -> 0 kW
    assert normal.get_max_power_at_speed(345.0) == 0.0
    assert normal.get_max_power_at_speed(350.0) == 0.0


def test_power_curve_tapering_overtake():
    """Verify overtake (manual override) power curve tapering behavior."""
    config = load_fia_2026_config()
    overtake = config.overtake_power_curve

    # Overtake holds full 350 kW up to 337.5 km/h
    assert overtake.get_max_power_at_speed(300.0) == 350.0
    assert overtake.get_max_power_at_speed(337.0) == 350.0
    assert overtake.get_max_power_at_speed(337.5) == 350.0

    # At 340 km/h, overtake provides 300 kW whereas normal is 100 kW
    overtake_power = overtake.get_max_power_at_speed(340.0)
    normal_power = config.normal_power_curve.get_max_power_at_speed(340.0)
    assert pytest.approx(overtake_power, rel=1e-3) == 300.0
    assert pytest.approx(normal_power, rel=1e-3) == 100.0

    # At 345 km/h, overtake provides 200 kW whereas normal is 0 kW
    assert pytest.approx(overtake.get_max_power_at_speed(345.0), rel=1e-3) == 200.0
    assert config.normal_power_curve.get_max_power_at_speed(345.0) == 0.0

    # Taper ends at 355 km/h
    assert overtake.get_max_power_at_speed(355.0) == 0.0
    assert overtake.get_max_power_at_speed(360.0) == 0.0



def test_load_fia_2026_config_missing_file(tmp_path):
    """Verify RegulationConfigError raised when config file does not exist."""
    missing = tmp_path / "nonexistent.yaml"
    with pytest.raises(RegulationConfigError, match="not found"):
        load_fia_2026_config(missing)


def test_load_fia_2026_config_invalid_yaml(tmp_path):
    """Verify RegulationConfigError raised on invalid YAML or schema."""
    bad_file = tmp_path / "bad.yaml"
    bad_file.write_text("regulations:\n  ers_k_absolute_power_limit_kw: 9999\n", encoding="utf-8")
    with pytest.raises(RegulationConfigError):
        load_fia_2026_config(bad_file)
