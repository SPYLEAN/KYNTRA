"""KYNTRA Development-Only Controlled Failure Injection Hooks.

Allows controlled simulation of real-world edge cases (e.g. telemetry loss,
energy outage, VSC neutralization, regulation ambiguity) for judge demos
and adversarial testing.

SAFETY INVARIANT: Strictly disabled outside development/synthetic testing mode.
"""

from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class FailureInjectionConfig:
    """Active fault injection configuration."""
    provider_outage: bool = False
    stale_telemetry_s: float = 0.0
    energy_unavailable: bool = False
    force_vsc: bool = False
    force_rule_uncertainty: bool = False


class FailureInjector:
    """Thread-safe controller for development fault injection."""

    def __init__(self, allow_injection: bool = False):
        self._allow_injection = allow_injection
        self._config = FailureInjectionConfig()

    @property
    def allow_injection(self) -> bool:
        return self._allow_injection

    def enable_injection_mode(self) -> None:
        """Explicitly enable fault injection (development only)."""
        self._allow_injection = True

    def disable_injection_mode(self) -> None:
        """Hard safety lock to prevent accidental fault injection."""
        self._allow_injection = False
        self.reset()

    def set_provider_outage(self, active: bool) -> bool:
        if not self._allow_injection:
            return False
        self._config.provider_outage = active
        return True

    def set_stale_telemetry(self, extra_age_s: float) -> bool:
        if not self._allow_injection:
            return False
        self._config.stale_telemetry_s = max(0.0, extra_age_s)
        return True

    def set_energy_unavailable(self, active: bool) -> bool:
        if not self._allow_injection:
            return False
        self._config.energy_unavailable = active
        return True

    def set_force_vsc(self, active: bool) -> bool:
        if not self._allow_injection:
            return False
        self._config.force_vsc = active
        return True

    def set_force_rule_uncertainty(self, active: bool) -> bool:
        if not self._allow_injection:
            return False
        self._config.force_rule_uncertainty = active
        return True

    def reset(self) -> None:
        """Clear all active failure hooks."""
        self._config = FailureInjectionConfig()

    @property
    def is_provider_outage(self) -> bool:
        return self._allow_injection and self._config.provider_outage

    @property
    def extra_telemetry_age_s(self) -> float:
        return self._config.stale_telemetry_s if self._allow_injection else 0.0

    @property
    def is_energy_unavailable(self) -> bool:
        return self._allow_injection and self._config.energy_unavailable

    @property
    def is_forced_vsc(self) -> bool:
        return self._allow_injection and self._config.force_vsc

    @property
    def is_forced_rule_uncertainty(self) -> bool:
        return self._allow_injection and self._config.force_rule_uncertainty

    def get_status(self) -> dict:
        return {
            "injection_allowed": self._allow_injection,
            "provider_outage": self.is_provider_outage,
            "stale_telemetry_s": self.extra_telemetry_age_s,
            "energy_unavailable": self.is_energy_unavailable,
            "force_vsc": self.is_forced_vsc,
            "force_rule_uncertainty": self.is_forced_rule_uncertainty,
        }
