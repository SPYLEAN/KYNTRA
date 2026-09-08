"""Simulated MGU-K energy harvesting model.

SIMULATION ASSUMPTION NOTICE:
Public Formula 1 telemetry does not broadcast actual MGU-K electrical regeneration power.
This model calculates explicitly SIMULATED energy recovery using driver inputs (Brake, Throttle)
and vehicle speed as physical context.
None of these values represent real team electrical telemetry.
"""

from typing import Union
from pydantic import BaseModel, Field


class HarvestModelConfig(BaseModel):
    """Configurable parameters for simulated MGU-K kinetic recovery."""

    max_mgu_k_regen_power_kw: float = Field(
        350.0,
        ge=0.0,
        le=350.0,
        description="MGU-K maximum electrical generation capacity under FIA Article C5.2.7 (kW)",
    )
    brake_harvest_efficiency: float = Field(
        0.75,
        ge=0.0,
        le=1.0,
        description="Assumed mechanical-to-electrical kinetic recovery efficiency factor [Prototype Simulation Assumption: 75%]",
    )
    lift_and_coast_regen_power_kw: float = Field(
        35.0,
        ge=0.0,
        description="Assumed baseline MGU-K regeneration during off-throttle coasting [Prototype Simulation Assumption: 35 kW]",
    )

    min_harvest_speed_kmh: float = Field(
        50.0,
        ge=0.0,
        description="Speed threshold below which kinetic harvesting is deactivated (km/h)",
    )


DEFAULT_HARVEST_CONFIG = HarvestModelConfig()


def calculate_step_harvest_mj(
    speed_kmh: float,
    throttle_pct: float,
    brake: Union[bool, float, int],
    dt_s: float,
    current_lap_harvested_mj: float,
    max_recharge_limit_mj: float,
    config: HarvestModelConfig = DEFAULT_HARVEST_CONFIG,
) -> float:
    """Calculate simulated electrical energy harvested by MGU-K during a time step dt_s.

    Strictly enforces FIA per-lap recharge limit:
    current_lap_harvested_mj + step_harvest_mj <= max_recharge_limit_mj.

    Args:
        speed_kmh: Instantaneous car speed (km/h).
        throttle_pct: Driver throttle application (0.0 - 100.0).
        brake: Driver brake pedal application (boolean or 0 - 100).
        dt_s: Time step duration in seconds.
        current_lap_harvested_mj: Cumulative energy harvested so far on this lap.
        max_recharge_limit_mj: FIA per-lap recovery limit (e.g. 8.5 MJ).
        config: Harvest model configuration parameters.

    Returns:
        float: Simulated energy harvested in this step (Megajoules, MJ).
    """
    if dt_s <= 0.0:
        return 0.0

    # 1. Enforce per-lap recharge ceiling
    recharge_headroom_mj = max(0.0, max_recharge_limit_mj - current_lap_harvested_mj)
    if recharge_headroom_mj <= 0.0:
        return 0.0

    # 2. Cutoff at very low speeds
    if speed_kmh < config.min_harvest_speed_kmh:
        return 0.0

    # 3. Determine instantaneous regenerative power in kW based on driver context
    regen_power_kw = 0.0

    # Check brake application
    is_braking = False
    brake_intensity = 0.0
    if isinstance(brake, (bool, np_bool := type(True))):
        is_braking = bool(brake)
        brake_intensity = 1.0 if is_braking else 0.0
    elif isinstance(brake, (int, float)):
        is_braking = float(brake) > 0.0
        # If 0-100 scale, normalize to [0, 1], else if binary 0/1 use direct
        brake_intensity = (float(brake) / 100.0) if float(brake) > 1.0 else float(brake)

    if is_braking:
        # Under braking: MGU-K acts as primary regenerative brake up to 350 kW
        # Scaled by brake application intensity and recovery efficiency
        regen_power_kw = (
            config.max_mgu_k_regen_power_kw
            * brake_intensity
            * config.brake_harvest_efficiency
        )
    elif throttle_pct < 5.0:
        # Off-throttle coasting: baseline overrun regeneration
        regen_power_kw = config.lift_and_coast_regen_power_kw
    else:
        # Power on: no kinetic harvesting
        regen_power_kw = 0.0

    # Bound by absolute MGU-K generation ceiling (350 kW)
    regen_power_kw = min(regen_power_kw, config.max_mgu_k_regen_power_kw)

    # Convert kW * seconds to Megajoules (1 kWh = 3.6 MJ, 1 kW*s = 0.001 MJ)
    step_harvest_mj = (regen_power_kw * dt_s) / 1000.0

    # Cap by remaining per-lap recharge allowance
    return min(step_harvest_mj, recharge_headroom_mj)
