"""Tactical energy deployment action policies for KYNTRA.

Defines the four tactical decision policies:
- CONSERVE: Minimize electrical deployment to favor battery recovery and thermal management.
- BUILD: Controlled partial deployment; creates net positive energy surplus for upcoming attack windows.
- DEPLOY: Standard competitive pace tracking the full allowable normal power curve.
- OVERTAKE: Maximum allowable electrical boost tracking the Manual Override power curve.

NOTE: These are tactical decision policies, not literal team engine mapping files or speculative speed gains.
All deployment multipliers are configurable policy parameters.
"""

from enum import Enum
from pydantic import BaseModel, Field
from kyntra.regulations.models import FIARegulationConfig


class TacticalAction(str, Enum):
    """The four discrete tactical energy deployment policies."""

    CONSERVE = "CONSERVE"
    BUILD = "BUILD"
    DEPLOY = "DEPLOY"
    OVERTAKE = "OVERTAKE"


class ActionPolicyConfig(BaseModel):
    """Configurable deployment parameters for tactical policies."""

    conserve_deployment_fraction: float = Field(
        0.20,
        ge=0.0,
        le=1.0,
        description="Fraction of allowable normal power deployed in CONSERVE mode [Policy Parameter]",
    )
    build_deployment_fraction: float = Field(
        0.55,
        ge=0.0,
        le=1.0,
        description="Fraction of allowable normal power deployed in BUILD mode [Policy Parameter]",
    )
    deploy_deployment_fraction: float = Field(
        1.00,
        ge=0.0,
        le=1.0,
        description="Fraction of allowable normal power deployed in DEPLOY mode [Policy Parameter]",
    )
    overtake_deployment_fraction: float = Field(
        1.00,
        ge=0.0,
        le=1.0,
        description="Fraction of allowable overtake power deployed in OVERTAKE mode [Policy Parameter]",
    )
    min_throttle_deployment_threshold: float = Field(
        15.0,
        ge=0.0,
        le=100.0,
        description="Minimum driver throttle percentage required to initiate electrical deployment (%)",
    )


DEFAULT_ACTION_POLICY = ActionPolicyConfig()


def compute_target_deployment_power_kw(
    action: TacticalAction,
    speed_kmh: float,
    throttle_pct: float,
    regulation_config: FIARegulationConfig,
    policy_config: ActionPolicyConfig = DEFAULT_ACTION_POLICY,
) -> float:
    """Calculate the target MGU-K electrical deployment power in kW for a given tactical action.

    Args:
        action: TacticalAction enum (CONSERVE, BUILD, DEPLOY, OVERTAKE).
        speed_kmh: Instantaneous vehicle speed in km/h.
        throttle_pct: Driver throttle pedal position (0.0 - 100.0).
        regulation_config: Validated FIA 2026 technical regulations.
        policy_config: Configurable policy deployment fractions.

    Returns:
        float: Target deployment power in kW, compliant with regulatory ceilings.
    """
    # No deployment while off-throttle or braking
    if throttle_pct < policy_config.min_throttle_deployment_threshold:
        return 0.0

    throttle_scaling = min(1.0, throttle_pct / 100.0)

    if action == TacticalAction.OVERTAKE:
        max_curve_power = regulation_config.overtake_power_curve.get_max_power_at_speed(speed_kmh)
        target_power = (
            max_curve_power
            * policy_config.overtake_deployment_fraction
            * throttle_scaling
        )
    elif action == TacticalAction.DEPLOY:
        max_curve_power = regulation_config.normal_power_curve.get_max_power_at_speed(speed_kmh)
        target_power = (
            max_curve_power
            * policy_config.deploy_deployment_fraction
            * throttle_scaling
        )
    elif action == TacticalAction.BUILD:
        max_curve_power = regulation_config.normal_power_curve.get_max_power_at_speed(speed_kmh)
        target_power = (
            max_curve_power
            * policy_config.build_deployment_fraction
            * throttle_scaling
        )
    elif action == TacticalAction.CONSERVE:
        max_curve_power = regulation_config.normal_power_curve.get_max_power_at_speed(speed_kmh)
        target_power = (
            max_curve_power
            * policy_config.conserve_deployment_fraction
            * throttle_scaling
        )
    else:
        target_power = 0.0

    # Ensure target power never exceeds absolute MGU-K ceiling
    return min(target_power, regulation_config.ers_k_absolute_power_limit_kw)
