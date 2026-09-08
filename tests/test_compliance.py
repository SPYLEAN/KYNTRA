"""Tests for deterministic compliance engine."""

from datetime import timedelta
import pytest
from kyntra.energy.state import EnergyState, TelemetrySource
from kyntra.regulations.compliance import (
    ComplianceReason,
    check_overtake_legality,
    check_power_limit,
    check_recharge_limit,
)
from kyntra.regulations.loader import load_fia_2026_config


@pytest.fixture
def fia_config():
    """Load default 2026 FIA regulation configuration."""
    return load_fia_2026_config()


def test_power_limit_normal_mode_allowed(fia_config):
    """Verify power below normal limit is ALLOWED."""
    # At 250 km/h, max power is 350 kW
    res = check_power_limit(fia_config, requested_power_kw=300.0, speed_kmh=250.0, is_overtake_mode=False)
    assert res.is_compliant is True
    assert res.reason == ComplianceReason.ALLOWED


def test_power_limit_normal_mode_exceeded(fia_config):
    """Verify power above normal tapered limit returns POWER_LIMIT_EXCEEDED."""
    # Under Article C5.2.8(i): at 315 km/h, normal max power is 1800 - 5*(315) = 225.0 kW
    res = check_power_limit(fia_config, requested_power_kw=250.0, speed_kmh=315.0, is_overtake_mode=False)
    assert res.is_compliant is False
    assert res.reason == ComplianceReason.POWER_LIMIT_EXCEEDED
    assert res.max_permitted_value == 225.0



def test_power_limit_overtake_mode_allowed(fia_config):
    """Verify power that exceeds normal curve is ALLOWED in Overtake Mode up to 337 km/h."""
    # At 320 km/h, normal limit is ~140 kW, but overtake mode allows 350 kW
    res = check_power_limit(fia_config, requested_power_kw=320.0, speed_kmh=320.0, is_overtake_mode=True)
    assert res.is_compliant is True
    assert res.reason == ComplianceReason.ALLOWED


def test_power_limit_absolute_cap_exceeded(fia_config):
    """Verify power requested above 350 kW absolute limit is rejected."""
    res = check_power_limit(fia_config, requested_power_kw=360.0, speed_kmh=200.0, is_overtake_mode=True)
    assert res.is_compliant is False
    assert res.reason == ComplianceReason.POWER_LIMIT_EXCEEDED


def test_recharge_limit_allowed_and_exceeded(fia_config):
    """Verify recharge limit compliance."""
    # Limit is 8.5 MJ
    res_ok = check_recharge_limit(fia_config, proposed_harvest_mj=2.0, current_lap_harvested_mj=5.0)
    assert res_ok.is_compliant is True
    assert res_ok.reason == ComplianceReason.ALLOWED

    res_exceeded = check_recharge_limit(fia_config, proposed_harvest_mj=4.0, current_lap_harvested_mj=5.0)
    assert res_exceeded.is_compliant is False
    assert res_exceeded.reason == ComplianceReason.RECHARGE_LIMIT_EXCEEDED


def test_overtake_legality_allowed(fia_config):
    """Verify overtake legality when all conditions are satisfied."""
    state = EnergyState(
        timestamp=timedelta(seconds=100),
        lap=10,
        sector=1,
        energy_available_mj=2.5,
        energy_window_fraction=0.625,
        overtake_enabled=True,
        overtake_eligible=True,
        source=TelemetrySource.SIMULATED,
    )
    res = check_overtake_legality(fia_config, state)
    assert res.is_compliant is True
    assert res.reason == ComplianceReason.ALLOWED


def test_overtake_legality_safety_car(fia_config):
    """Verify overtake rejected under Safety Car."""
    fia_config.safety_car_active = True
    state = EnergyState(
        timestamp=timedelta(seconds=100),
        lap=10,
        sector=1,
        energy_available_mj=2.5,
        energy_window_fraction=0.625,
        overtake_eligible=True,
        source=TelemetrySource.SIMULATED,
    )
    res = check_overtake_legality(fia_config, state)
    assert res.is_compliant is False
    assert res.reason == ComplianceReason.SAFETY_CAR_RESTRICTION


def test_overtake_legality_race_control_disabled(fia_config):
    """Verify overtake rejected when Race Control has not enabled it."""
    fia_config.overtake_enabled = False
    state = EnergyState(
        timestamp=timedelta(seconds=100),
        lap=10,
        sector=1,
        energy_available_mj=2.5,
        energy_window_fraction=0.625,
        overtake_eligible=True,
        source=TelemetrySource.SIMULATED,
    )
    res = check_overtake_legality(fia_config, state)
    assert res.is_compliant is False
    assert res.reason == ComplianceReason.OVERTAKE_NOT_ENABLED


def test_overtake_legality_unknown_energy_state(fia_config):
    """Verify overtake rejected when energy state is UNKNOWN."""
    state = EnergyState(
        timestamp=timedelta(seconds=100),
        lap=10,
        sector=1,
        energy_available_mj=2.5,
        energy_window_fraction=0.625,
        overtake_eligible=True,
        source=TelemetrySource.UNKNOWN,
    )
    res = check_overtake_legality(fia_config, state)
    assert res.is_compliant is False
    assert res.reason == ComplianceReason.ENERGY_STATE_UNKNOWN


def test_overtake_legality_config_incomplete(fia_config):
    """Verify overtake returns REGULATION_CONFIG_INCOMPLETE if detection parameters and eligibility are unknown."""
    state = EnergyState(
        timestamp=timedelta(seconds=100),
        lap=10,
        sector=1,
        energy_available_mj=2.5,
        energy_window_fraction=0.625,
        overtake_eligible=None,  # Not evaluated / unknown
        source=TelemetrySource.SIMULATED,
    )
    res = check_overtake_legality(fia_config, state)
    assert res.is_compliant is False
    assert res.reason == ComplianceReason.REGULATION_CONFIG_INCOMPLETE


def test_overtake_legality_not_eligible_at_detection(fia_config):
    """Verify overtake rejected if car was not within detection window."""
    state = EnergyState(
        timestamp=timedelta(seconds=100),
        lap=10,
        sector=1,
        energy_available_mj=2.5,
        energy_window_fraction=0.625,
        overtake_eligible=False,
        source=TelemetrySource.SIMULATED,
    )
    res = check_overtake_legality(fia_config, state)
    assert res.is_compliant is False
    assert res.reason == ComplianceReason.NOT_ELIGIBLE_AT_DETECTION
