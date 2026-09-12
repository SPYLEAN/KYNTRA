"""Manifest loader and schema validator for post-pass stability evidence rules."""

import hashlib
import json
import logging
from pathlib import Path
from threading import Lock
from typing import Optional, Tuple
from pydantic import ValidationError

from kyntra.stability.models import (
    ManifestRuleDefinition,
    StabilityManifestModel,
    StabilityPolicyModel,
    StabilityRuleStatus,
    StabilityVerdict,
)

logger = logging.getLogger(__name__)

_DEFAULT_MANIFEST_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "configs"
    / "stability_evidence_manifest_v1.json"
)

_MANIFEST_CACHE_LOCK = Lock()
_CACHED_MANIFEST: Optional[StabilityManifestModel] = None
_CACHED_SHA256: Optional[str] = None
_CACHED_PATH: Optional[Path] = None


def get_default_manifest_path() -> Path:
    """Return canonical path to configs/stability_evidence_manifest_v1.json."""
    return _DEFAULT_MANIFEST_PATH


def compute_file_sha256(path: Path) -> str:
    """Calculate hex SHA-256 digest of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_manifest_dict(raw_data: dict) -> StabilityManifestModel:
    """Parse raw JSON dict into a typed StabilityManifestModel.
    
    Handles both direct rule lists and structured rule dictionary blocks.
    """
    version = str(raw_data.get("manifest_version", "1.1.0"))
    major_ver = version.split(".")[0]
    if major_ver != "1":
        raise ValueError(f"Incompatible manifest major version: {version}. Expected 1.x.")

    raw_rules = raw_data.get("rules", [])
    parsed_rules = []

    if isinstance(raw_rules, list):
        for item in raw_rules:
            if isinstance(item, dict):
                parsed_rules.append(ManifestRuleDefinition.model_validate(item))
    elif isinstance(raw_rules, dict):
        # Support dict mapping of rules e.g. {"RULE_01": {...}}
        for r_id, r_def in raw_rules.items():
            if isinstance(r_def, dict):
                data = dict(r_def)
                if "rule_id" not in data:
                    data["rule_id"] = r_id
                parsed_rules.append(ManifestRuleDefinition.model_validate(data))

    policy_data = raw_data.get("policy", {})
    policy_model = (
        StabilityPolicyModel.model_validate(policy_data)
        if policy_data
        else StabilityPolicyModel()
    )

    return StabilityManifestModel(
        manifest_version=version,
        manifest_type=raw_data.get("manifest_type", "POST_PASS_STABILITY_CONSENSUS"),
        name=raw_data.get("name", "KYNTRA Post-Pass Stability Evidence Manifest"),
        derivation_date=raw_data.get("derivation_date"),
        dataset_filename=raw_data.get("dataset_filename", "kyntra_overtake_dataset.parquet"),
        dataset_sha256=raw_data.get("dataset_sha256"),
        dataset_identity=raw_data.get("dataset_identity"),
        dataset_rows=raw_data.get("dataset_rows", 8357),
        train_rows=raw_data.get("train_rows", 6197),
        validation_rows=raw_data.get("validation_rows", 2160),
        evaluation_horizons_laps=raw_data.get("evaluation_horizons_laps", [1, 2, 3]),
        primary_stability_horizon_laps=raw_data.get("primary_stability_horizon_laps", 2),
        rule_families=raw_data.get("rule_families", ["PACE", "SPEED", "TYRE"]),
        policy=policy_model,
        demonstration_holdouts_strictly_isolated=raw_data.get(
            "demonstration_holdouts_strictly_isolated", []
        ),
        polarity_conventions=raw_data.get("polarity_conventions", {}),
        ordinal_stability_classes=raw_data.get("ordinal_stability_classes", []),
        rules=parsed_rules,
        metadata=raw_data.get("metadata", {}),
    )


def load_stability_manifest(
    path: Optional[Path] = None, force_reload: bool = False
) -> Tuple[Optional[StabilityManifestModel], Optional[str]]:
    """Load, validate, and cache stability evidence manifest.

    Args:
        path: Path to manifest JSON file. Defaults to configs/stability_evidence_manifest_v1.json.
        force_reload: If True, bypass in-memory cache and re-read disk.

    Returns:
        Tuple of (StabilityManifestModel, sha256_hex_str) on success.
        Tuple of (None, None) if missing, invalid JSON, or schema incompatible.
    """
    global _CACHED_MANIFEST, _CACHED_SHA256, _CACHED_PATH

    target_path = path or get_default_manifest_path()

    with _MANIFEST_CACHE_LOCK:
        if (
            not force_reload
            and _CACHED_MANIFEST is not None
            and _CACHED_PATH == target_path
        ):
            return _CACHED_MANIFEST, _CACHED_SHA256

        if not target_path.exists():
            logger.warning(f"Stability manifest not found at: {target_path}")
            return None, None

        try:
            sha = compute_file_sha256(target_path)
            with open(target_path, "r", encoding="utf-8") as f:
                raw_json = json.load(f)

            manifest_model = parse_manifest_dict(raw_json)

            _CACHED_MANIFEST = manifest_model
            _CACHED_SHA256 = sha
            _CACHED_PATH = target_path
            return _CACHED_MANIFEST, _CACHED_SHA256

        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.error(f"Failed to decode stability manifest JSON: {e}")
            return None, None
        except (ValidationError, ValueError) as e:
            logger.error(f"Stability manifest schema validation failed: {e}")
            return None, None
        except Exception as e:
            logger.error(f"Unexpected error loading stability manifest: {e}")
            return None, None
