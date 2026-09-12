"""Comprehensive test suite for KYNTRA Reviewed Composite Post-Pass Stability V1.

Tests cover all 18 required consensus scenarios:
1. Zero families available -> UNKNOWN
2. One family available -> UNKNOWN
3. Two families available / zero triggered -> CAUTION
4. Two families available / one triggered -> CAUTION
5. Two families available / two triggered -> HIGH_RISK
6. Three available / one triggered -> CAUTION
7. Three available / two triggered -> HIGH_RISK
8. All three triggered -> HIGH_RISK
9. Three PACE rules trigger alone -> still only ONE family -> CAUTION if another non-triggered family is available
10. PACE only -> UNKNOWN
11. NaN handling
12. Missing feature handling
13. Disabled rules ignored
14. CANDIDATE rules ignored
15. FAVORABLE cannot be emitted by V1
16. Dataset SHA exposed
17. Manifest SHA exposed
18. DecisionEngine integration
"""

import json
import math
import tempfile
from pathlib import Path
import pytest

from kyntra.decision.engine import compute_decision
from kyntra.stability.evaluator import evaluate_stability
from kyntra.stability.manifest import (
    compute_file_sha256,
    get_default_manifest_path,
    load_stability_manifest,
)
from kyntra.stability.models import (
    ManifestRuleDefinition,
    StabilityEvidenceItem,
    StabilityManifestModel,
    StabilityPolicyModel,
    StabilityResult,
    StabilityRuleStatus,
    StabilityVerdict,
)

CANONICAL_DATASET_SHA = "bec6dc848bcdd9a5b8c1b8aba63384e73abe7d41552656b218a5d6832984afac"


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmp:
        yield Path(tmp)


# ==============================================================================
# 1. Zero families available -> UNKNOWN
# ==============================================================================
def test_01_zero_families_available():
    """Empty features dict means 0 families available -> UNKNOWN, available=False."""
    res = evaluate_stability(features={}, force_reload_manifest=True)
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.reason == "INSUFFICIENT_INDEPENDENT_STABILITY_EVIDENCE"
    assert len(res.available_families) == 0
    assert len(res.triggered_families) == 0


# ==============================================================================
# 2. One family available -> UNKNOWN
# ==============================================================================
def test_02_one_family_available():
    """Only SPEED family available (1 < 2 required) -> UNKNOWN, available=False."""
    res = evaluate_stability(
        features={"speed_trap_delta": -12.0},
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.reason == "INSUFFICIENT_INDEPENDENT_STABILITY_EVIDENCE"
    assert res.available_families == ["SPEED"]


# ==============================================================================
# 3. Two families available / zero triggered -> CAUTION
# ==============================================================================
def test_03_two_families_available_zero_triggered():
    """SPEED and TYRE available, but neither triggered -> CAUTION, available=True."""
    # SPEED rule: speed_trap_delta <= -9.0 (observed: +2.0, not triggered)
    # TYRE rule: tyre_age_delta <= -3.5 (observed: +1.0, not triggered)
    res = evaluate_stability(
        features={"speed_trap_delta": 2.0, "tyre_age_delta": 1.0},
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.CAUTION
    assert res.available is True
    assert res.reason == "NO_MULTI_FAMILY_RISK_CONSENSUS"
    assert sorted(res.available_families) == ["SPEED", "TYRE"]
    assert len(res.triggered_families) == 0


# ==============================================================================
# 4. Two families available / one triggered -> CAUTION
# ==============================================================================
def test_04_two_families_available_one_triggered():
    """SPEED and TYRE available, only SPEED triggered -> CAUTION, available=True."""
    # SPEED: -15.0 <= -9.0 (triggered)
    # TYRE: 0.0 > -3.5 (not triggered)
    res = evaluate_stability(
        features={"speed_trap_delta": -15.0, "tyre_age_delta": 0.0},
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.CAUTION
    assert res.available is True
    assert res.reason == "NO_MULTI_FAMILY_RISK_CONSENSUS"
    assert sorted(res.available_families) == ["SPEED", "TYRE"]
    assert res.triggered_families == ["SPEED"]


# ==============================================================================
# 5. Two families available / two triggered -> HIGH_RISK
# ==============================================================================
def test_05_two_families_available_two_triggered():
    """SPEED and TYRE available, both triggered -> HIGH_RISK, available=True."""
    # SPEED: -12.0 <= -9.0 (triggered)
    # TYRE: -5.0 <= -3.5 (triggered)
    res = evaluate_stability(
        features={"speed_trap_delta": -12.0, "tyre_age_delta": -5.0},
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.HIGH_RISK
    assert res.available is True
    assert res.reason == "MULTI_FAMILY_POST_PASS_RISK"
    assert sorted(res.available_families) == ["SPEED", "TYRE"]
    assert sorted(res.triggered_families) == ["SPEED", "TYRE"]


# ==============================================================================
# 6. Three available / one triggered -> CAUTION
# ==============================================================================
def test_06_three_families_available_one_triggered():
    """PACE, SPEED, TYRE all available, only TYRE triggered -> CAUTION."""
    res = evaluate_stability(
        features={
            "closing_rate": 0.5,             # > -0.192 (not triggered)
            "recent_pace_delta_1lap": 0.1,    # > -0.1959 (not triggered)
            "recent_pace_delta_3laps": 0.2,   # > -0.1816 (not triggered)
            "speed_trap_delta": 5.0,          # > -9.0 (not triggered)
            "tyre_age_delta": -6.0,           # <= -3.5 (triggered)
        },
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.CAUTION
    assert res.available is True
    assert res.reason == "NO_MULTI_FAMILY_RISK_CONSENSUS"
    assert sorted(res.available_families) == ["PACE", "SPEED", "TYRE"]
    assert res.triggered_families == ["TYRE"]


# ==============================================================================
# 7. Three available / two triggered -> HIGH_RISK
# ==============================================================================
def test_07_three_families_available_two_triggered():
    """PACE, SPEED, TYRE all available; PACE and SPEED triggered -> HIGH_RISK."""
    res = evaluate_stability(
        features={
            "closing_rate": -0.5,             # <= -0.192 (PACE triggered)
            "speed_trap_delta": -10.5,        # <= -9.0 (SPEED triggered)
            "tyre_age_delta": 2.0,            # > -3.5 (TYRE not triggered)
        },
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.HIGH_RISK
    assert res.available is True
    assert res.reason == "MULTI_FAMILY_POST_PASS_RISK"
    assert sorted(res.available_families) == ["PACE", "SPEED", "TYRE"]
    assert sorted(res.triggered_families) == ["PACE", "SPEED"]


# ==============================================================================
# 8. All three triggered -> HIGH_RISK
# ==============================================================================
def test_08_all_three_families_triggered():
    """PACE, SPEED, TYRE all available and all triggered -> HIGH_RISK."""
    res = evaluate_stability(
        features={
            "recent_pace_delta_1lap": -0.30,  # <= -0.1959 (PACE triggered)
            "speed_trap_delta": -14.0,        # <= -9.0 (SPEED triggered)
            "tyre_age_delta": -4.0,           # <= -3.5 (TYRE triggered)
        },
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.HIGH_RISK
    assert res.available is True
    assert res.reason == "MULTI_FAMILY_POST_PASS_RISK"
    assert sorted(res.available_families) == ["PACE", "SPEED", "TYRE"]
    assert sorted(res.triggered_families) == ["PACE", "SPEED", "TYRE"]


# ==============================================================================
# 9. Three PACE rules trigger alone -> still only ONE family -> CAUTION
# ==============================================================================
def test_09_three_pace_rules_trigger_alone_with_second_family_available():
    """All 3 PACE rules trigger simultaneously, but TYRE is clean -> only 1 family triggered -> CAUTION."""
    res = evaluate_stability(
        features={
            "closing_rate": -0.50,            # PACE triggered
            "recent_pace_delta_1lap": -0.40,  # PACE triggered
            "recent_pace_delta_3laps": -0.35, # PACE triggered
            "tyre_age_delta": 4.0,            # TYRE available, not triggered
        },
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.CAUTION
    assert res.available is True
    assert res.reason == "NO_MULTI_FAMILY_RISK_CONSENSUS"
    assert sorted(res.available_families) == ["PACE", "TYRE"]
    assert res.triggered_families == ["PACE"]
    # Verify 3 individual evidence items were recorded despite single family verdict
    pace_evidence = [e for e in res.evidence if e.family == "PACE"]
    assert len(pace_evidence) == 3


# ==============================================================================
# 10. PACE only -> UNKNOWN
# ==============================================================================
def test_10_pace_only_available_insufficient_evidence():
    """Even if all 3 PACE rules trigger, with 0 other families available -> UNKNOWN (available=False)."""
    res = evaluate_stability(
        features={
            "closing_rate": -0.50,
            "recent_pace_delta_1lap": -0.40,
            "recent_pace_delta_3laps": -0.35,
        },
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.reason == "INSUFFICIENT_INDEPENDENT_STABILITY_EVIDENCE"
    assert res.available_families == ["PACE"]
    assert res.triggered_families == ["PACE"]


# ==============================================================================
# 11. NaN handling
# ==============================================================================
def test_11_nan_feature_handling():
    """NaN values are treated strictly as missing/unobserved."""
    res = evaluate_stability(
        features={
            "closing_rate": float("nan"),
            "recent_pace_delta_1lap": float("nan"),
            "recent_pace_delta_3laps": float("nan"),
            "speed_trap_delta": float("nan"),
            "tyre_age_delta": float("nan"),
        },
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.reason == "INSUFFICIENT_INDEPENDENT_STABILITY_EVIDENCE"
    assert len(res.available_families) == 0
    assert len(res.triggered_families) == 0


# ==============================================================================
# 12. Missing feature handling
# ==============================================================================
def test_12_missing_feature_handling():
    """Explicit None values are safely ignored without raising exceptions."""
    res = evaluate_stability(
        features={
            "closing_rate": None,
            "speed_trap_delta": None,
            "tyre_age_delta": None,
        },
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.reason == "INSUFFICIENT_INDEPENDENT_STABILITY_EVIDENCE"


# ==============================================================================
# 13. Disabled rules ignored
# ==============================================================================
def test_13_disabled_rules_ignored(temp_dir):
    """Rules with status='DISABLED' must never mutate available or triggered families."""
    custom_manifest = {
        "manifest_version": "1.1.0",
        "dataset_sha256": CANONICAL_DATASET_SHA,
        "policy": {"min_available_families": 2, "high_risk_min_triggered_families": 2},
        "rules": [
            {
                "rule_id": "DISABLED_RULE_01",
                "feature": "speed_trap_delta",
                "family": "SPEED",
                "status": "DISABLED",
                "operator": "<=",
                "threshold": 100.0,  # Would trigger if evaluated
                "target_verdict": "HIGH_RISK",
                "reason_code": "DISABLED_TEST",
            },
            {
                "rule_id": "ENABLED_TYRE",
                "feature": "tyre_age_delta",
                "family": "TYRE",
                "status": "ENABLED",
                "operator": "<=",
                "threshold": -3.0,
                "target_verdict": "HIGH_RISK",
                "reason_code": "TYRE_RISK",
            }
        ]
    }
    p = temp_dir / "disabled_manifest.json"
    p.write_text(json.dumps(custom_manifest), encoding="utf-8")

    res = evaluate_stability(
        features={"speed_trap_delta": 50.0, "tyre_age_delta": -5.0},
        manifest_path=p,
        force_reload_manifest=True,
    )
    # Only TYRE was enabled; SPEED was disabled, so only 1 family available -> UNKNOWN
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.available_families == ["TYRE"]


# ==============================================================================
# 14. CANDIDATE rules ignored
# ==============================================================================
def test_14_candidate_rules_ignored(temp_dir):
    """Rules with status='CANDIDATE' must never mutate available or triggered families."""
    custom_manifest = {
        "manifest_version": "1.1.0",
        "dataset_sha256": CANONICAL_DATASET_SHA,
        "policy": {"min_available_families": 2, "high_risk_min_triggered_families": 2},
        "rules": [
            {
                "rule_id": "CAND_RULE_01",
                "feature": "speed_trap_delta",
                "family": "SPEED",
                "status": "CANDIDATE",
                "operator": "<=",
                "threshold": 100.0,
                "target_verdict": "HIGH_RISK",
                "reason_code": "CAND_TEST",
            }
        ]
    }
    p = temp_dir / "candidate_manifest.json"
    p.write_text(json.dumps(custom_manifest), encoding="utf-8")

    res = evaluate_stability(
        features={"speed_trap_delta": -20.0},
        manifest_path=p,
        force_reload_manifest=True,
    )
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.reason == "STABILITY_RULESET_PENDING_VERIFICATION"


# ==============================================================================
# 15. FAVORABLE cannot be emitted by V1
# ==============================================================================
def test_15_favorable_cannot_be_emitted_by_v1(temp_dir):
    """Even if a rule specifies target_verdict=FAVORABLE, V1 consensus policy restricts emissions."""
    fav_manifest = {
        "manifest_version": "1.1.0",
        "dataset_sha256": CANONICAL_DATASET_SHA,
        "policy": {
            "min_available_families": 2,
            "high_risk_min_triggered_families": 2,
            "favorable_enabled": False,
        },
        "rules": [
            {
                "rule_id": "FAV_TEST",
                "feature": "recent_pace_delta_1lap",
                "family": "PACE",
                "status": "ENABLED",
                "operator": ">=",
                "threshold": 0.5,
                "target_verdict": "FAVORABLE",
                "reason_code": "PACE_FAV",
            },
            {
                "rule_id": "TYRE_OK",
                "feature": "tyre_age_delta",
                "family": "TYRE",
                "status": "ENABLED",
                "operator": ">=",
                "threshold": 1.0,
                "target_verdict": "FAVORABLE",
                "reason_code": "TYRE_FAV",
            }
        ]
    }
    p = temp_dir / "fav_manifest.json"
    p.write_text(json.dumps(fav_manifest), encoding="utf-8")

    res = evaluate_stability(
        features={"recent_pace_delta_1lap": 1.0, "tyre_age_delta": 3.0},
        manifest_path=p,
        force_reload_manifest=True,
    )
    # V1 policy emits only HIGH_RISK, CAUTION, UNKNOWN
    assert res.verdict != StabilityVerdict.FAVORABLE
    assert res.verdict in [StabilityVerdict.CAUTION, StabilityVerdict.HIGH_RISK]


# ==============================================================================
# 16. Dataset SHA exposed
# ==============================================================================
def test_16_dataset_sha_exposed():
    """Active canonical dataset SHA-256 is exposed on StabilityResult."""
    res = evaluate_stability(
        features={"speed_trap_delta": -12.0, "tyre_age_delta": -4.0},
        force_reload_manifest=True,
    )
    assert res.dataset_sha256 == CANONICAL_DATASET_SHA


# ==============================================================================
# 17. Manifest SHA exposed
# ==============================================================================
def test_17_manifest_sha_exposed():
    """Active manifest SHA-256 digest is dynamically computed and exposed on StabilityResult."""
    res = evaluate_stability(
        features={"speed_trap_delta": -12.0, "tyre_age_delta": -4.0},
        force_reload_manifest=True,
    )
    assert res.manifest_sha256 is not None
    assert len(res.manifest_sha256) == 64
    assert res.manifest_version == "1.1.0"


# ==============================================================================
# 18. DecisionEngine integration
# ==============================================================================
def test_18_decision_engine_integration():
    """End-to-end DecisionSnapshot populates StabilitySnapshot with multi-family consensus."""
    # Realistic battle data with PACE, SPEED, and TYRE
    battle_info = {
        "gap_seconds": 0.45,
        "closing_rate": -0.25,            # <= -0.192 -> PACE triggered
        "recent_pace_delta_1lap": -0.22,  # <= -0.1959 -> PACE triggered
        "recent_pace_delta_3laps": -0.20, # <= -0.1816 -> PACE triggered
        "speed_trap_delta": -11.0,        # <= -9.0 -> SPEED triggered
        "tyre_age_delta": 0.0,            # > -3.5 -> TYRE not triggered
    }
    race_info = {
        "event_id": "2026_01_AUS",
        "attacker": "NOR",
        "defender": "VER",
        "lap": 24,
        "track_status": "1",
    }

    snap = compute_decision(race_data=race_info, battle_data=battle_info)
    assert snap.stability.method == "DETERMINISTIC_POST_PASS_STABILITY_V1"
    assert snap.stability.verdict == "HIGH_RISK"  # 2 families triggered (PACE, SPEED)
    assert snap.stability.available is True
    assert snap.stability.reason == "MULTI_FAMILY_POST_PASS_RISK"
    assert sorted(snap.stability.available_families) == ["PACE", "SPEED", "TYRE"]
    assert sorted(snap.stability.triggered_families) == ["PACE", "SPEED"]
    assert snap.stability.dataset_sha256 == CANONICAL_DATASET_SHA
    assert snap.stability.manifest_version == "1.1.0"
    assert snap.stability.manifest_sha256 is not None
    assert len(snap.stability.evidence) >= 2


# ==============================================================================
# Additional Edge Case: Missing or corrupt manifest fails closed safely
# ==============================================================================
def test_stability_missing_manifest_fails_closed(temp_dir):
    missing_path = temp_dir / "non_existent.json"
    res = evaluate_stability(features={"speed_trap_delta": 10.0}, manifest_path=missing_path)
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.reason == "STABILITY_MANIFEST_UNAVAILABLE"


def test_stability_corrupt_json_fails_closed(temp_dir):
    corrupt_file = temp_dir / "corrupt.json"
    corrupt_file.write_text("{ not json ", encoding="utf-8")
    res = evaluate_stability(features={"speed_trap_delta": 10.0}, manifest_path=corrupt_file)
    assert res.verdict == StabilityVerdict.UNKNOWN
    assert res.available is False
    assert res.reason == "STABILITY_MANIFEST_UNAVAILABLE"
