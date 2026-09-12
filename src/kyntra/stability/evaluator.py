"""Manifest-driven runtime evaluator for post-pass position stability.

Evaluates incoming relative race observables strictly against formally ENABLED manifest rules
and enforces a manifest-driven multi-family consensus policy.
Production Python code contains zero hardcoded empirical thresholds.
"""

import math
from pathlib import Path
from typing import Any, Dict, List, Optional

from kyntra.stability.manifest import load_stability_manifest
from kyntra.stability.models import (
    ManifestRuleDefinition,
    StabilityEvidenceItem,
    StabilityPolicyModel,
    StabilityResult,
    StabilityRuleStatus,
    StabilityVerdict,
)


def _is_finite_and_present(value: Any) -> bool:
    """Check if value is present, non-null, and a finite quantity."""
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return not (math.isnan(value) or math.isinf(value))
    if isinstance(value, str):
        return len(value.strip()) > 0
    return True


def _get_rule_family(rule: ManifestRuleDefinition) -> str:
    """Resolve the canonical physical feature family for a rule."""
    if rule.family:
        return str(rule.family).upper()
    feat = rule.feature.lower()
    if "pace" in feat or "closing" in feat:
        return "PACE"
    if "speed" in feat:
        return "SPEED"
    if "tyre" in feat:
        return "TYRE"
    return "UNKNOWN_FAMILY"


def _evaluate_condition(observed: Any, operator: str, threshold: Any) -> bool:
    """Evaluate observation against rule threshold using dynamic operator.
    
    Zero hardcoded numeric boundaries in production Python code.
    """
    if not _is_finite_and_present(observed) or threshold is None:
        return False

    try:
        if operator in [">=", "<=", ">", "<"]:
            obs_num = float(observed)
            thresh_num = float(threshold)
            if operator == ">=":
                return obs_num >= thresh_num
            elif operator == "<=":
                return obs_num <= thresh_num
            elif operator == ">":
                return obs_num > thresh_num
            elif operator == "<":
                return obs_num < thresh_num
        elif operator in ["==", "="]:
            return str(observed).strip().lower() == str(threshold).strip().lower()
        elif operator in ["!=", "<>"]:
            return str(observed).strip().lower() != str(threshold).strip().lower()
        elif operator.lower() == "in":
            if isinstance(threshold, (list, tuple, set)):
                return observed in threshold
            return str(observed) in str(threshold)
    except (ValueError, TypeError):
        return False

    return False


def evaluate_stability(
    features: Optional[Dict[str, Any]] = None,
    manifest_path: Optional[Path] = None,
    force_reload_manifest: bool = False,
) -> StabilityResult:
    """Evaluate post-pass position durability using manifest-driven multi-family consensus.

    Safety & Consensus Contract:
    1. If manifest is missing, corrupt, incompatible, or lacks ENABLED rules:
       Returns verdict=UNKNOWN, available=False.
    2. CANDIDATE, DISABLED, or INSUFFICIENT_DATA rules NEVER mutate runtime state.
    3. Production Python contains zero hardcoded empirical numeric thresholds.
    4. A family is AVAILABLE if >= 1 enabled rule has a finite, non-null observed value.
    5. A family is TRIGGERED if >= 1 enabled rule triggers. Correlated rules in the same
       family (e.g. 3 PACE rules) count as ONE family.
    6. Policy (from manifest):
       - If < min_available_families available -> UNKNOWN (available=False)
       - If >= min_available_families available AND >= high_risk_min_triggered_families trigger -> HIGH_RISK (available=True)
       - If >= min_available_families available AND < high_risk_min_triggered_families trigger -> CAUTION (available=True)
       - FAVORABLE is disabled in V1 due to sparse retention samples.
    """
    feat_dict = features or {}

    # 1. Load and validate manifest
    manifest, manifest_sha = load_stability_manifest(
        path=manifest_path, force_reload=force_reload_manifest
    )

    if manifest is None:
        return StabilityResult(
            verdict=StabilityVerdict.UNKNOWN,
            available=False,
            evidence=[],
            reason="STABILITY_MANIFEST_UNAVAILABLE",
            manifest_version=None,
            manifest_sha256=None,
            dataset_sha256=None,
            available_families=[],
            triggered_families=[],
        )

    # 2. Filter strictly for ENABLED rules
    enabled_rules: List[ManifestRuleDefinition] = [
        r for r in manifest.rules if r.status == StabilityRuleStatus.ENABLED
    ]

    if not enabled_rules:
        return StabilityResult(
            verdict=StabilityVerdict.UNKNOWN,
            available=False,
            evidence=[],
            reason="STABILITY_RULESET_PENDING_VERIFICATION",
            manifest_version=manifest.manifest_version,
            manifest_sha256=manifest_sha,
            dataset_sha256=manifest.dataset_sha256,
            available_families=[],
            triggered_families=[],
        )

    # 3. Determine available families and evaluate rules
    available_families_set = set()
    triggered_families_set = set()
    matched_evidence: List[StabilityEvidenceItem] = []

    for rule in enabled_rules:
        fam = _get_rule_family(rule)
        obs_val = feat_dict.get(rule.feature)

        if _is_finite_and_present(obs_val):
            available_families_set.add(fam)

            if _evaluate_condition(obs_val, rule.operator, rule.threshold):
                triggered_families_set.add(fam)
                matched_evidence.append(
                    StabilityEvidenceItem(
                        feature=rule.feature,
                        observed_value=obs_val,
                        unit=rule.unit,
                        rule_id=rule.rule_id,
                        threshold=rule.threshold,
                        direction=rule.operator,
                        evidence_strength=rule.evidence_strength,
                        source_manifest_version=manifest.manifest_version,
                        reason_code=rule.reason_code,
                        family=fam,
                    )
                )

    available_families = sorted(list(available_families_set))
    triggered_families = sorted(list(triggered_families_set))

    # 4. Apply manifest-driven multi-family consensus policy
    policy = manifest.policy or StabilityPolicyModel()
    min_avail = policy.min_available_families
    min_trig = policy.high_risk_min_triggered_families

    # Policy Rule 1: Insufficient independent families available
    if len(available_families) < min_avail:
        return StabilityResult(
            verdict=StabilityVerdict.UNKNOWN,
            available=False,
            evidence=matched_evidence,
            reason="INSUFFICIENT_INDEPENDENT_STABILITY_EVIDENCE",
            manifest_version=manifest.manifest_version,
            manifest_sha256=manifest_sha,
            dataset_sha256=manifest.dataset_sha256,
            available_families=available_families,
            triggered_families=triggered_families,
        )

    # Policy Rule 2: Multi-family risk consensus achieved
    if len(triggered_families) >= min_trig:
        return StabilityResult(
            verdict=StabilityVerdict.HIGH_RISK,
            available=True,
            evidence=matched_evidence,
            reason="MULTI_FAMILY_POST_PASS_RISK",
            manifest_version=manifest.manifest_version,
            manifest_sha256=manifest_sha,
            dataset_sha256=manifest.dataset_sha256,
            available_families=available_families,
            triggered_families=triggered_families,
        )

    # Policy Rule 3: Sufficient families available, but no multi-family risk consensus
    return StabilityResult(
        verdict=StabilityVerdict.CAUTION,
        available=True,
        evidence=matched_evidence,
        reason="NO_MULTI_FAMILY_RISK_CONSENSUS",
        manifest_version=manifest.manifest_version,
        manifest_sha256=manifest_sha,
        dataset_sha256=manifest.dataset_sha256,
        available_families=available_families,
        triggered_families=triggered_families,
    )
