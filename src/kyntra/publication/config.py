"""Configuration loader and provenance manager for decision publication."""

from dataclasses import dataclass
import hashlib
import logging
from pathlib import Path
from typing import Any, Dict, Optional
import yaml

logger = logging.getLogger(__name__)

DEFAULT_PUBLICATION_CONFIG_PATH = Path("configs/decision_publication_v1.yaml")


@dataclass
class PublicationConfig:
    version: str
    description: str
    battle_state_budget_s: float
    race_control_budget_s: float
    energy_state_budget_s: float
    model_features_budget_s: float
    matrix_snapshot_budget_s: float
    call_validity_budget_s: float
    aging_threshold_fraction: float
    max_cross_stream_skew_s: float
    raw_config: Dict[str, Any]
    sha256: str


_CACHED_PUB_CONFIG: Optional[PublicationConfig] = None
_CACHED_PUB_CONFIG_PATH: Optional[Path] = None


def load_publication_config(
    config_path: Optional[Path] = None,
    reload: bool = False,
) -> PublicationConfig:
    """Load and validate the decision publication configuration.

    Computes SHA-256 checksum for immutable provenance tracking.
    """
    global _CACHED_PUB_CONFIG, _CACHED_PUB_CONFIG_PATH
    path = config_path or DEFAULT_PUBLICATION_CONFIG_PATH

    if not reload and _CACHED_PUB_CONFIG is not None and _CACHED_PUB_CONFIG_PATH == path:
        return _CACHED_PUB_CONFIG

    if not path.exists():
        logger.warning("Publication config not found at %s. Using default fallback budgets.", path)
        return PublicationConfig(
            version="1.0.0-FALLBACK",
            description="Fallback publication budgets",
            battle_state_budget_s=2.50,
            race_control_budget_s=1.50,
            energy_state_budget_s=3.00,
            model_features_budget_s=3.00,
            matrix_snapshot_budget_s=4.00,
            call_validity_budget_s=6.00,
            aging_threshold_fraction=0.70,
            max_cross_stream_skew_s=1.50,
            raw_config={},
            sha256="UNAVAILABLE",
        )

    with open(path, "rb") as f:
        content_bytes = f.read()
        sha256_hash = hashlib.sha256(content_bytes).hexdigest()

    data = yaml.safe_load(content_bytes.decode("utf-8")) or {}

    version = str(data.get("version", "1.0.0"))
    desc = str(data.get("description", ""))

    budgets = data.get("freshness_budgets", {})
    battle_budget = float(budgets.get("battle_state", {}).get("value", 2.50))
    rc_budget = float(budgets.get("race_control", {}).get("value", 1.50))
    energy_budget = float(budgets.get("energy_state", {}).get("value", 3.00))
    feat_budget = float(budgets.get("model_features", {}).get("value", 3.00))
    matrix_budget = float(budgets.get("matrix_snapshot", {}).get("value", 4.00))

    lifecycle_cfg = data.get("call_lifecycle", {})
    validity_budget = float(lifecycle_cfg.get("validity_budget_s", {}).get("value", 6.00))
    aging_frac = float(lifecycle_cfg.get("aging_threshold_fraction", {}).get("value", 0.70))

    coherence_cfg = data.get("temporal_coherence", {})
    skew_budget = float(coherence_cfg.get("max_cross_stream_skew_s", {}).get("value", 1.50))

    parsed = PublicationConfig(
        version=version,
        description=desc,
        battle_state_budget_s=battle_budget,
        race_control_budget_s=rc_budget,
        energy_state_budget_s=energy_budget,
        model_features_budget_s=feat_budget,
        matrix_snapshot_budget_s=matrix_budget,
        call_validity_budget_s=validity_budget,
        aging_threshold_fraction=aging_frac,
        max_cross_stream_skew_s=skew_budget,
        raw_config=data,
        sha256=sha256_hash,
    )

    _CACHED_PUB_CONFIG = parsed
    _CACHED_PUB_CONFIG_PATH = path
    return parsed
