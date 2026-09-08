"""Tests for EnergySimulator V1 and regulation constraints."""

from datetime import timedelta
import pytest
from kyntra.energy.actions import TacticalAction
from kyntra.energy.simulator import EnergySimulator
from kyntra.energy.state import TelemetrySource
from kyntra.regulations.compliance import ComplianceReason
from kyntra.regulations.loader import load_fia_2026_config


@pytest.fixture
def simulator():
    """Create standard simulator instance with verified FIA 2026 config."""
    return EnergySimulator()


def test_initial_energy_scenarios(simulator):
    """Verify scenario inputs for initial energy fraction (0.25, 0.50, 0.75)."""
    # 25% initial state (1.0 MJ)
    state_25 = simulator.initialize_state(initial_energy_fraction=0.25)
    assert state_25.energy_available_mj == 1.0
    assert state_25.energy_window_fraction == 0.25
    assert state_25.source == TelemetrySource.SIMULATED

    # 50% initial state (2.0 MJ)
    state_50 = simulator.initialize_state(initial_energy_fraction=0.50)
    assert state_50.energy_available_mj == 2.0
    assert state_50.energy_window_fraction == 0.50

    # 75% initial state (3.0 MJ)
    state_75 = simulator.initialize_state(initial_energy_fraction=0.75)
    assert state_75.energy_available_mj == 3.0
    assert state_75.energy_window_fraction == 0.75

    # Invalid fractions raise ValueError
    with pytest.raises(ValueError):
        simulator.initialize_state(initial_energy_fraction=1.2)
    with pytest.raises(ValueError):
        simulator.initialize_state(initial_energy_fraction=-0.1)


def test_energy_cannot_exceed_usable_window(simulator):
    """Verify energy cannot exceed the 4.0 MJ usable window even with excess harvesting."""
    # Start battery near full (3.9 MJ)
    state = simulator.initialize_state(initial_energy_fraction=0.975)
    assert state.energy_available_mj == 3.9

    # Massive braking step (speed 250 km/h, brake=100%, 5 seconds dt)
    next_state, _, harvest_mj, _ = simulator.step(
        current_state=state,
        speed_kmh=250.0,
        throttle_pct=0.0,
        brake=100.0,
        dt_s=5.0,  # Huge braking duration
        action=TacticalAction.CONSERVE,
    )

    # Must be clamped at exactly 4.0 MJ usable window
    assert next_state.energy_available_mj <= 4.0
    assert next_state.energy_available_mj == 4.0
    assert next_state.energy_window_fraction == 1.0
    assert next_state.source == TelemetrySource.SIMULATED


def test_energy_cannot_fall_below_zero(simulator):
    """Verify energy cannot deplete below zero when deployment demand exceeds stored energy."""
    # Start battery almost empty (0.01 MJ)
    state = simulator.initialize_state(initial_energy_fraction=0.0025)
    assert state.energy_available_mj == 0.01

    # Full throttle deployment step at 200 km/h (demands 350 kW)
    next_state, _, _, actual_deploy_mj = simulator.step(
        current_state=state,
        speed_kmh=200.0,
        throttle_pct=100.0,
        brake=False,
        dt_s=1.0,
        action=TacticalAction.DEPLOY,
    )

    # Deployed energy cannot exceed the 0.01 MJ that was in store
    assert actual_deploy_mj <= 0.01
    assert next_state.energy_available_mj >= 0.0
    assert next_state.energy_available_mj == 0.0
    assert next_state.energy_window_fraction == 0.0
    assert next_state.source == TelemetrySource.SIMULATED


def test_power_curve_tapering_enforced_in_deployment(simulator):
    """Verify that deployment respects the speed-dependent two-stage power curve."""
    state = simulator.initialize_state(initial_energy_fraction=1.0)

    # Step at 340 km/h: normal power curve allows exactly 100.0 kW (0.1 MJ in 1s)
    next_state, _, _, deploy_340_mj = simulator.step(
        current_state=state,
        speed_kmh=340.0,
        throttle_pct=100.0,
        brake=False,
        dt_s=1.0,
        action=TacticalAction.DEPLOY,
    )
    assert pytest.approx(deploy_340_mj, rel=1e-3) == 0.1

    # Step at 345 km/h: normal power curve is strictly 0.0 kW
    _, _, _, deploy_345_mj = simulator.step(
        current_state=next_state,
        speed_kmh=345.0,
        throttle_pct=100.0,
        brake=False,
        dt_s=1.0,
        action=TacticalAction.DEPLOY,
    )
    # Zero energy deployed because power limit at 345 km/h is 0 kW
    assert deploy_345_mj == 0.0



def test_recharge_limit_obeyed(simulator):
    """Verify harvesting ceases once per-lap recharge limit (8.5 MJ) is reached."""
    # Create state where current lap harvested is already at 8.49 MJ
    state = simulator.initialize_state(initial_energy_fraction=0.1)
    state.energy_harvested_this_lap_mj = 8.49

    # Step under heavy braking
    next_state, _, harvest_mj, _ = simulator.step(
        current_state=state,
        speed_kmh=200.0,
        throttle_pct=0.0,
        brake=100.0,
        dt_s=2.0,
        action=TacticalAction.CONSERVE,
    )

    # Can harvest at most 0.01 MJ to reach 8.5 MJ limit
    assert pytest.approx(harvest_mj, abs=1e-5) == 0.01
    assert pytest.approx(next_state.energy_harvested_this_lap_mj, abs=1e-5) == 8.5
    assert next_state.recharge_limit_remaining_mj == 0.0

    # Subsequent braking cannot harvest anything
    next_state_2, _, harvest_2, _ = simulator.step(
        current_state=next_state,
        speed_kmh=200.0,
        throttle_pct=0.0,
        brake=100.0,
        dt_s=2.0,
    )
    assert harvest_2 == 0.0


def test_overtake_blocked_when_race_control_disabled(simulator):
    """Verify OVERTAKE is blocked and downgraded when race control disables it."""
    simulator.reg_config.overtake_enabled = False
    state = simulator.initialize_state(initial_energy_fraction=0.8)

    next_state, comp_res, _, _ = simulator.step(
        current_state=state,
        speed_kmh=250.0,
        throttle_pct=100.0,
        brake=False,
        dt_s=0.1,
        action=TacticalAction.OVERTAKE,
        overtake_eligible=True,
    )

    assert comp_res.is_compliant is False
    assert comp_res.reason == ComplianceReason.OVERTAKE_NOT_ENABLED


def test_overtake_blocked_when_eligibility_unknown(simulator):
    """Verify OVERTAKE is blocked when driver eligibility at detection line is unknown."""
    state = simulator.initialize_state(initial_energy_fraction=0.8)

    next_state, comp_res, _, _ = simulator.step(
        current_state=state,
        speed_kmh=250.0,
        throttle_pct=100.0,
        brake=False,
        dt_s=0.1,
        action=TacticalAction.OVERTAKE,
        overtake_eligible=None,  # Unknown / unconfigured
    )

    assert comp_res.is_compliant is False
    assert comp_res.reason == ComplianceReason.REGULATION_CONFIG_INCOMPLETE


def test_safety_car_restriction(simulator):
    """Verify Safety Car deployment blocks overtake and suppresses deployment."""
    state = simulator.initialize_state(initial_energy_fraction=0.8)

    next_state, comp_res, _, deploy_mj = simulator.step(
        current_state=state,
        speed_kmh=150.0,
        throttle_pct=50.0,
        brake=False,
        dt_s=0.1,
        action=TacticalAction.OVERTAKE,
        is_sc_active=True,
        overtake_eligible=True,
    )

    assert comp_res.is_compliant is False
    assert comp_res.reason == ComplianceReason.SAFETY_CAR_RESTRICTION
    assert deploy_mj == 0.0


def test_simulated_provenance_never_omitted(simulator):
    """Verify SIMULATED provenance tag is strictly maintained across transitions."""
    state = simulator.initialize_state(initial_energy_fraction=0.5)
    assert state.source == TelemetrySource.SIMULATED

    for _ in range(5):
        state, _, _, _ = simulator.step(
            current_state=state,
            speed_kmh=200.0,
            throttle_pct=80.0,
            brake=False,
            dt_s=0.1,
        )
        assert state.source == TelemetrySource.SIMULATED
        assert state.is_simulated() is True
        assert state.is_real_telemetry() is False
