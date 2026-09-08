"""YAML configuration loader for FIA 2026 Energy Regulations."""

from pathlib import Path
from typing import Optional, Union
import logging
import yaml
from kyntra.regulations.models import FIARegulationConfig

logger = logging.getLogger(__name__)


class RegulationConfigError(Exception):
    """Raised when regulation configuration cannot be loaded or validated."""


def get_default_config_path() -> Path:
    """Resolve default path to configs/fia_2026_energy.yaml relative to project root."""
    # This file is at src/kyntra/regulations/loader.py -> project root is 3 levels up
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    return project_root / "configs" / "fia_2026_energy.yaml"


def load_fia_2026_config(
    config_path: Optional[Union[str, Path]] = None,
) -> FIARegulationConfig:
    """Load and validate FIA 2026 energy regulations from YAML file.

    Args:
        config_path: Custom path to regulation YAML. Defaults to configs/fia_2026_energy.yaml.

    Returns:
        FIARegulationConfig: Fully validated typed regulation configuration.

    Raises:
        RegulationConfigError: If file is missing, unreadable, or invalid against schema.
    """
    if config_path is None:
        target_path = get_default_config_path()
    else:
        target_path = Path(config_path).resolve()

    if not target_path.exists():
        raise RegulationConfigError(
            f"Regulation configuration file not found at: '{target_path}'"
        )

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            raw_data = yaml.safe_load(f)
    except Exception as exc:
        raise RegulationConfigError(
            f"Failed to parse YAML file at '{target_path}': {exc}"
        ) from exc

    if not isinstance(raw_data, dict) or "regulations" not in raw_data:
        raise RegulationConfigError(
            f"Invalid regulation configuration format in '{target_path}': missing top-level 'regulations' key."
        )

    try:
        config = FIARegulationConfig.model_validate(raw_data["regulations"])
    except Exception as exc:
        raise RegulationConfigError(
            f"Regulation schema validation failed for '{target_path}': {exc}"
        ) from exc

    if not config.verify_provenance():
        raise RegulationConfigError(
            f"Regulation configuration in '{target_path}' lacks verifiable provenance metadata. "
            f"Official document name, issue, and source URL are required."
        )

    unconfigured = config.get_unconfigured_parameters()
    if unconfigured:
        logger.info(
            "FIA 2026 config loaded with %d explicitly unconfigured event parameters: %s",
            len(unconfigured),
            ", ".join(unconfigured),
        )

    return config


def get_event_config_path(event_name: str) -> Path:
    """Resolve event configuration YAML path under configs/events/."""
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    filename = event_name if event_name.endswith(".yaml") else f"{event_name}.yaml"
    return project_root / "configs" / "events" / filename


def load_event_config(
    event_path_or_name: Union[str, Path],
) -> "EventRegulationConfig":
    """Load and validate an official FIA event configuration YAML file.

    Args:
        event_path_or_name: Event identifier (e.g. '2026_australia') or full Path.

    Returns:
        EventRegulationConfig: Validated event configuration.
    """
    from kyntra.regulations.models import EventRegulationConfig

    p = Path(event_path_or_name)
    if not p.is_file():
        p = get_event_config_path(str(event_path_or_name))

    if not p.exists():
        raise RegulationConfigError(f"Event configuration file not found at: '{p}'")

    try:
        with open(p, "r", encoding="utf-8") as f:
            raw_data = yaml.safe_load(f)
    except Exception as exc:
        raise RegulationConfigError(f"Failed to parse event YAML at '{p}': {exc}") from exc

    if not isinstance(raw_data, dict) or "event" not in raw_data:
        raise RegulationConfigError(f"Missing top-level 'event' key in '{p}'")

    try:
        return EventRegulationConfig.model_validate(raw_data["event"])
    except Exception as exc:
        raise RegulationConfigError(f"Event schema validation failed for '{p}': {exc}") from exc

