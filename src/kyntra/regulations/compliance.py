"""Deterministic regulation compliance engine scaffold for FIA 2026 rules.

Evaluates tactical energy decisions against FIA 2026 technical and sporting regulations.
Never fabricates missing regulation parameters and returns explicit reason codes.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from kyntra.energy.state import EnergyState, TelemetrySource
from kyntra.regulations.models import FIARegulationConfig


class ComplianceReason(str, Enum):
    """Explicit decision outcomes from the regulation compliance evaluator."""

    ALLOWED = "ALLOWED"
    OVERTAKE_NOT_ENABLED = "OVERTAKE_NOT_ENABLED"
    NOT_ELIGIBLE_AT_DETECTION = "NOT_ELIGIBLE_AT_DETECTION"
    POWER_LIMIT_EXCEEDED = "POWER_LIMIT_EXCEEDED"
    RECHARGE_LIMIT_EXCEEDED = "RECHARGE_LIMIT_EXCEEDED"
    ENERGY_STATE_UNKNOWN = "ENERGY_STATE_UNKNOWN"
    REGULATION_CONFIG_INCOMPLETE = "REGULATION_CONFIG_INCOMPLETE"
    SAFETY_CAR_RESTRICTION = "SAFETY_CAR_RESTRICTION"
    INSUFFICIENT_ENERGY = "INSUFFICIENT_ENERGY"


class ComplianceResult(BaseModel):
    """Result of a deterministic regulation compliance check."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    is_compliant: bool = Field(..., description="Whether the requested energy action is strictly legal")
    reason: ComplianceReason = Field(..., description="Machine-readable compliance code")
    message: str = Field(..., description="Human-readable explanation of the ruling")
    requested_value: Optional[float] = Field(None, description="Requested metric value (e.g. kW or MJ)")
    max_permitted_value: Optional[float] = Field(None, description="Maximum legally permitted value")


def check_overtake_legality(
    config: FIARegulationConfig,
    energy_state: Optional[EnergyState],
) -> ComplianceResult:
    """Determine whether Manual Override (Overtake Mode) is legally available.

    Checks:
    1. Safety Car / VSC status.
    2. Global race control enable status.
    3. Energy state availability.
    4. Circuit detection parameters (fails safely if unconfigured).
    5. Driver eligibility at detection point.
    6. Minimum Energy Store reserve.
    """
    # 1. Neutralized race conditions
    if config.safety_car_active:
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.SAFETY_CAR_RESTRICTION,
            message="Overtake mode is prohibited under Safety Car or Virtual Safety Car conditions.",
        )

    # 2. Race Control permission
    if not config.overtake_enabled:
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.OVERTAKE_NOT_ENABLED,
            message="Manual Override has not been enabled by Race Control.",
        )

    # 3. Energy state availability
    if energy_state is None or energy_state.source == TelemetrySource.UNKNOWN:
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.ENERGY_STATE_UNKNOWN,
            message="Cannot verify overtake legality because car energy state is UNKNOWN.",
        )

    # 4. Check if detection parameters are unconfigured
    if config.detection_gap is None and energy_state.overtake_eligible is None:
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.REGULATION_CONFIG_INCOMPLETE,
            message="Circuit-specific detection gap/line is unconfigured; cannot infer eligibility.",
        )

    # 5. Check driver eligibility at detection line
    if energy_state.overtake_eligible is False:
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.NOT_ELIGIBLE_AT_DETECTION,
            message="Car did not satisfy detection window criteria at the designated detection line.",
        )

    # 6. Check battery reserve (need at least minimal operational energy)
    if energy_state.energy_available_mj <= 0.05:
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.INSUFFICIENT_ENERGY,
            message=f"Insufficient usable energy in Energy Store ({energy_state.energy_available_mj:.2f} MJ remaining).",
            requested_value=energy_state.energy_available_mj,
            max_permitted_value=0.05,
        )

    return ComplianceResult(
        is_compliant=True,
        reason=ComplianceReason.ALLOWED,
        message="Manual Override (Overtake Mode) is legally available and authorized.",
    )


def check_power_limit(
    config: FIARegulationConfig,
    requested_power_kw: float,
    speed_kmh: float,
    is_overtake_mode: bool = False,
) -> ComplianceResult:
    """Verify that requested MGU-K electrical power complies with FIA power curves.

    Under 2026 regulations:
    - Normal curve: 350 kW up to 290 km/h, tapering to 0 kW at 340 km/h.
    - Overtake curve: 350 kW up to 337 km/h, tapering to 0 kW at 355 km/h.
    """
    if requested_power_kw < 0.0:
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.POWER_LIMIT_EXCEEDED,
            message="Deployment power cannot be negative (use harvesting evaluation).",
            requested_value=requested_power_kw,
            max_permitted_value=0.0,
        )

    # Determine applicable power curve
    curve = config.overtake_power_curve if is_overtake_mode else config.normal_power_curve
    max_permitted = curve.get_max_power_at_speed(speed_kmh)

    # Also bounded by absolute MGU-K limit
    max_permitted = min(max_permitted, config.ers_k_absolute_power_limit_kw)

    if requested_power_kw > (max_permitted + 1e-4):
        mode_str = "Manual Override (Overtake)" if is_overtake_mode else "Normal"
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.POWER_LIMIT_EXCEEDED,
            message=(
                f"Requested {requested_power_kw:.1f} kW exceeds the {mode_str} "
                f"allowable limit of {max_permitted:.1f} kW at {speed_kmh:.1f} km/h."
            ),
            requested_value=requested_power_kw,
            max_permitted_value=round(max_permitted, 2),
        )

    return ComplianceResult(
        is_compliant=True,
        reason=ComplianceReason.ALLOWED,
        message=f"Requested power of {requested_power_kw:.1f} kW is within legal limit ({max_permitted:.1f} kW).",
        requested_value=requested_power_kw,
        max_permitted_value=round(max_permitted, 2),
    )


def check_recharge_limit(
    config: FIARegulationConfig,
    proposed_harvest_mj: float,
    current_lap_harvested_mj: float,
    is_overtake_active: bool = False,
) -> ComplianceResult:
    """Verify that proposed MGU-K recovery will not breach the per-lap recharge limit.

    Adheres to the regulatory hierarchy:
    1. Global FIA regulation default (8.5 MJ baseline)
    2. Event-specific FIA configuration (e.g. Australia 8.0 MJ inactive, 8.5 MJ active)
    3. Current race state (is_overtake_active flag)
    """
    effective_limit = config.get_effective_recharge_limit_mj(is_overtake_active=is_overtake_active)
    projected_total = proposed_harvest_mj + current_lap_harvested_mj

    if projected_total > (effective_limit + 1e-4):
        return ComplianceResult(
            is_compliant=False,
            reason=ComplianceReason.RECHARGE_LIMIT_EXCEEDED,
            message=(
                f"Total projected recovery ({projected_total:.2f} MJ) exceeds the "
                f"per-lap recharge limit of {effective_limit:.2f} MJ."
            ),
            requested_value=projected_total,
            max_permitted_value=effective_limit,
        )

    return ComplianceResult(
        is_compliant=True,
        reason=ComplianceReason.ALLOWED,
        message=f"Recovery is within per-lap limit ({projected_total:.2f} MJ / {effective_limit:.2f} MJ).",
        requested_value=projected_total,
        max_permitted_value=effective_limit,
    )

