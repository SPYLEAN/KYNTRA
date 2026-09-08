"""Tests for EnergyState interface and provenance tracking."""

from datetime import timedelta
import pytest
from pydantic import ValidationError
from kyntra.energy.state import EnergyState, TelemetrySource


def test_energy_state_creation_simulated():
    """Verify EnergyState model with simulated source."""
    state = EnergyState(
        timestamp=timedelta(seconds=120.5),
        lap=5,
        sector=2,
        energy_available_mj=3.2,
        energy_window_fraction=0.8,
        energy_harvested_this_lap_mj=1.5,
        energy_deployed_this_lap_mj=2.0,
        recharge_limit_remaining_mj=7.0,
        overtake_enabled=True,
        overtake_eligible=True,
        source=TelemetrySource.SIMULATED,
    )
    assert state.is_simulated() is True
    assert state.is_real_telemetry() is False
    assert state.energy_available_mj == 3.2
    assert state.energy_window_fraction == 0.8


def test_energy_state_creation_real_telemetry():
    """Verify EnergyState model with real telemetry source."""
    state = EnergyState(
        timestamp=timedelta(seconds=50.0),
        lap=1,
        sector=1,
        energy_available_mj=4.0,
        energy_window_fraction=1.0,
        source=TelemetrySource.REAL_TEAM_TELEMETRY,
    )
    assert state.is_real_telemetry() is True
    assert state.is_simulated() is False


def test_energy_state_validation_bounds():
    """Verify bounds enforcement on EnergyState."""
    # Negative energy
    with pytest.raises(ValidationError):
        EnergyState(
            timestamp=timedelta(seconds=10),
            lap=1,
            sector=1,
            energy_available_mj=-0.5,
            energy_window_fraction=0.5,
        )

    # Window fraction > 1.0
    with pytest.raises(ValidationError):
        EnergyState(
            timestamp=timedelta(seconds=10),
            lap=1,
            sector=1,
            energy_available_mj=2.0,
            energy_window_fraction=1.5,
        )

    # Invalid sector (must be 1, 2, or 3)
    with pytest.raises(ValidationError):
        EnergyState(
            timestamp=timedelta(seconds=10),
            lap=1,
            sector=4,
            energy_available_mj=2.0,
            energy_window_fraction=0.5,
        )
