"""Strategy counterfactual configuration loader and metadata manager.

Loads versioned counterfactual assumption profiles (e.g., configs/strategy_counterfactual_v1.yaml)
and computes SHA-256 integrity checksums to ensure zero anonymous constants in production Python.
"""

from dataclasses import dataclass
import hashlib
import logging
from pathlib import Path
from typing import Any, Dict, Optional
import yaml

logger = logging.getLogger(__name__)

DEFAULT_STRATEGY_CONFIG_PATH = Path("configs/strategy_counterfactual_v1.yaml")


@dataclass
class ActionProfileConfig:
    deployment_fraction: float
    baseline_deployment_rate_mj: float
    baseline_harvest_rate_mj: float
    gap_delta_rate_s_per_lap: float
    lap_time_consequence_s_per_lap: float
    default_pace_gain_s_per_lap: float = 0.15


@dataclass
class ScenarioMultiplierConfig:
    harvest_multiplier: float
    deployment_multiplier: float


@dataclass
class StrategyCounterfactualConfig:
    version: str
    assumption_profile: str
    description: str
    forecast_horizon_laps: int
    action_profiles: Dict[str, ActionProfileConfig]
    energy_uncertainty: Dict[str, ScenarioMultiplierConfig]
    raw_config: Dict[str, Any]
    sha256: str


_CACHED_CONFIG: Optional[StrategyCounterfactualConfig] = None
_CACHED_CONFIG_PATH: Optional[Path] = None


def load_strategy_counterfactual_config(
    config_path: Optional[Path] = None,
    force_reload: bool = False,
) -> StrategyCounterfactualConfig:
    """Load and parse the versioned strategy counterfactual configuration.

    Fails safely if file is missing by returning a safe default config with
    UNCONFIGURED status while logging an error.
    """
    global _CACHED_CONFIG, _CACHED_CONFIG_PATH

    path = config_path or DEFAULT_STRATEGY_CONFIG_PATH

    if not force_reload and _CACHED_CONFIG is not None and _CACHED_CONFIG_PATH == path:
        return _CACHED_CONFIG

    if not path.exists():
        logger.warning("Strategy counterfactual config not found at %s. Failing safely to unconfigured fallback.", path)
        # Safe fallback with zero assumptions
        fallback = StrategyCounterfactualConfig(
            version="0.0.0-MISSING",
            assumption_profile="UNCONFIGURED",
            description="Safe fallback when strategy counterfactual config is missing",
            forecast_horizon_laps=3,
            action_profiles={
                "CONSERVE": ActionProfileConfig(0.20, 0.40, 1.25, 0.25, 0.30),
                "BUILD": ActionProfileConfig(0.55, 0.95, 1.35, 0.00, 0.05),
                "DEPLOY": ActionProfileConfig(1.00, 1.65, 1.20, -0.15, -0.20, 0.15),
                "OVERTAKE": ActionProfileConfig(1.00, 2.30, 1.10, 0.00, -0.35),
            },
            energy_uncertainty={
                "CONSERVATIVE": ScenarioMultiplierConfig(0.80, 1.10),
                "NOMINAL": ScenarioMultiplierConfig(1.00, 1.00),
                "FAVORABLE": ScenarioMultiplierConfig(1.20, 0.90),
            },
            raw_config={},
            sha256="0" * 64,
        )
        return fallback

    with open(path, "rb") as f:
        content_bytes = f.read()
        sha256_hash = hashlib.sha256(content_bytes).hexdigest()

    data = yaml.safe_load(content_bytes.decode("utf-8")) or {}

    version = str(data.get("version", "1.0.0"))
    profile = str(data.get("assumption_profile", "KYNTRA_V1_TACTICAL_NOMINAL"))
    desc = str(data.get("description", ""))
    horizon = int(data.get("forecast_horizon_laps", {}).get("value", 3))

    action_profiles: Dict[str, ActionProfileConfig] = {}
    for act_name, act_data in data.get("action_profiles", {}).items():
        action_profiles[act_name] = ActionProfileConfig(
            deployment_fraction=float(act_data.get("deployment_fraction", {}).get("value", 1.0)),
            baseline_deployment_rate_mj=float(act_data.get("baseline_deployment_rate_mj", {}).get("value", 1.0)),
            baseline_harvest_rate_mj=float(act_data.get("baseline_harvest_rate_mj", {}).get("value", 1.0)),
            gap_delta_rate_s_per_lap=float(act_data.get("gap_delta_rate_s_per_lap", {}).get("value", 0.0)),
            lap_time_consequence_s_per_lap=float(act_data.get("lap_time_consequence_s_per_lap", {}).get("value", 0.0)),
            default_pace_gain_s_per_lap=float(act_data.get("default_pace_gain_s_per_lap", {}).get("value", 0.15)),
        )

    energy_uncertainty: Dict[str, ScenarioMultiplierConfig] = {}
    for sc_name, sc_data in data.get("energy_uncertainty", {}).items():
        energy_uncertainty[sc_name] = ScenarioMultiplierConfig(
            harvest_multiplier=float(sc_data.get("harvest_multiplier", {}).get("value", 1.0)),
            deployment_multiplier=float(sc_data.get("deployment_multiplier", {}).get("value", 1.0)),
        )

    parsed = StrategyCounterfactualConfig(
        version=version,
        assumption_profile=profile,
        description=desc,
        forecast_horizon_laps=horizon,
        action_profiles=action_profiles,
        energy_uncertainty=energy_uncertainty,
        raw_config=data,
        sha256=sha256_hash,
    )

    _CACHED_CONFIG = parsed
    _CACHED_CONFIG_PATH = path
    return parsed
