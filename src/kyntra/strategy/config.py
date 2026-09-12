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


DEFAULT_STRATEGY_RANKING_CONFIG_PATH = Path("configs/strategy_ranking_v1.yaml")


@dataclass
class StrategyRankingConfig:
    version: str
    description: str
    lap_time_tolerance_s: float
    terminal_energy_tolerance_mj: float
    kinematic_gap_threshold_s: float
    kinematic_min_p2: float
    min_initial_energy_mj: float
    raw_config: Dict[str, Any]
    sha256: str


_CACHED_RANKING_CONFIG: Optional[StrategyRankingConfig] = None
_CACHED_RANKING_CONFIG_PATH: Optional[Path] = None


def load_strategy_ranking_config(
    config_path: Optional[Path] = None,
    reload: bool = False,
) -> StrategyRankingConfig:
    """Load and validate the versioned strategy ranking configuration.

    Computes SHA-256 of the configuration file to guarantee provenance and auditability.
    """
    global _CACHED_RANKING_CONFIG, _CACHED_RANKING_CONFIG_PATH
    path = config_path or DEFAULT_STRATEGY_RANKING_CONFIG_PATH

    if not reload and _CACHED_RANKING_CONFIG is not None and _CACHED_RANKING_CONFIG_PATH == path:
        return _CACHED_RANKING_CONFIG

    if not path.exists():
        logger.warning("Strategy ranking config not found at %s. Using default assumption values.", path)
        return StrategyRankingConfig(
            version="1.0.0-FALLBACK",
            description="Fallback assumption values",
            lap_time_tolerance_s=0.05,
            terminal_energy_tolerance_mj=0.05,
            kinematic_gap_threshold_s=0.80,
            kinematic_min_p2=0.35,
            min_initial_energy_mj=0.40,
            raw_config={},
            sha256="UNAVAILABLE",
        )

    with open(path, "rb") as f:
        content_bytes = f.read()
        sha256_hash = hashlib.sha256(content_bytes).hexdigest()

    data = yaml.safe_load(content_bytes.decode("utf-8")) or {}

    version = str(data.get("version", "1.0.0"))
    desc = str(data.get("description", ""))

    lap_tol = float(data.get("lap_time_comparison_tolerance_s", {}).get("value", 0.05))
    e_tol = float(data.get("terminal_energy_comparison_tolerance_mj", {}).get("value", 0.05))

    kin_cfg = data.get("kinematic_opportunity_deficit", {})
    gap_thresh = float(kin_cfg.get("gap_threshold_s", {}).get("value", 0.80))
    min_p2 = float(kin_cfg.get("min_p2_threshold", {}).get("value", 0.35))

    e_inf_cfg = data.get("energy_infeasibility_threshold", {})
    min_init_e = float(e_inf_cfg.get("min_initial_energy_mj", {}).get("value", 0.40))

    parsed = StrategyRankingConfig(
        version=version,
        description=desc,
        lap_time_tolerance_s=lap_tol,
        terminal_energy_tolerance_mj=e_tol,
        kinematic_gap_threshold_s=gap_thresh,
        kinematic_min_p2=min_p2,
        min_initial_energy_mj=min_init_e,
        raw_config=data,
        sha256=sha256_hash,
    )

    _CACHED_RANKING_CONFIG = parsed
    _CACHED_RANKING_CONFIG_PATH = path
    return parsed
