"""FIA 2026 Regulations and Compliance Module for KYNTRA."""

from kyntra.regulations.compliance import (
    ComplianceReason,
    ComplianceResult,
    check_overtake_legality,
    check_power_limit,
    check_recharge_limit,
)
from kyntra.regulations.loader import (
    RegulationConfigError,
    get_default_config_path,
    get_event_config_path,
    load_event_config,
    load_fia_2026_config,
)
from kyntra.regulations.models import (
    EventProvenance,
    EventRegulationConfig,
    FIARegulationConfig,
    PowerCurveConfig,
    PowerCurvePoint,
    RaceRechargeLimit,
    RegulationProvenance,
    TimingLineInfo,
)

__all__ = [
    "FIARegulationConfig",
    "EventRegulationConfig",
    "EventProvenance",
    "TimingLineInfo",
    "RaceRechargeLimit",
    "PowerCurveConfig",
    "PowerCurvePoint",
    "RegulationProvenance",
    "load_fia_2026_config",
    "load_event_config",
    "get_default_config_path",
    "get_event_config_path",
    "RegulationConfigError",
    "ComplianceReason",
    "ComplianceResult",
    "check_overtake_legality",
    "check_power_limit",
    "check_recharge_limit",
]

