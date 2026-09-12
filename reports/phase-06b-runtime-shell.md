# KYNTRA — PHASE 06B-A RUNTIME SHELL REPORT
**Manifest-Driven Post-Pass Stability Architecture**
*Date: 2026-09-12*

## 1. Executive Summary
Phase 06B-A implements the production-grade, manifest-driven post-pass stability evaluation subsystem inside KYNTRA (`src/kyntra/stability/`). In accordance with strict non-negotiables:
- Zero hardcoded empirical numerical thresholds exist in production Python code.
- Runtime safety gates ensure that default evaluation output is strictly `UNKNOWN` with `available=False` and `reason="STABILITY_RULESET_PENDING_VERIFICATION"` until empirical rules derived in Phase 06A are reviewed and marked `ENABLED`.
- Rules marked `CANDIDATE`, `DISABLED`, `INSUFFICIENT_DATA`, or `NO_STABLE_SIGNAL` are ignored and never affect runtime classification.
- All 114 backend tests pass (11 dedicated stability tests + 103 baseline tests).
- Frozen LightGBM model bundle SHA-256 remains intact: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`.
- Web frontend passes TypeScript typecheck and production build (`npm run build`).

---

## 2. Architecture & File Layout

```
src/kyntra/stability/
├── __init__.py         # Public exports (models, manifest, evaluator)
├── models.py           # Typed domain models & Enums (Pydantic v2)
├── manifest.py         # Thread-safe manifest loader & SHA-256 validator
└── evaluator.py        # Safety-first deterministic stability evaluator

configs/
└── stability_evidence_manifest_v1.json  # Initial manifest schema (status="CANDIDATE")

tests/
└── test_stability_runtime.py            # Comprehensive 11-scenario test suite
```

---

## 3. Component Details

### 3.1 Domain Models (`src/kyntra/stability/models.py`)
- **`StabilityVerdict`**: `FAVORABLE`, `CAUTION`, `HIGH_RISK`, `UNKNOWN`.
- **`StabilityRuleStatus`**: `CANDIDATE`, `ENABLED`, `DISABLED`, `INSUFFICIENT_DATA`, `NO_STABLE_SIGNAL`.
- **`StabilityEvidenceItem`**: Typed evidence item capturing:
  - `feature`: Name of battle/race feature evaluated.
  - `observed_value`: Float, int, bool, or str observed at runtime.
  - `unit`: Physical or logical unit (e.g., `s`, `laps`, `km/h`).
  - `rule_id`: Unique identifier referencing the manifest rule.
  - `threshold`: Cutoff value defined in manifest.
  - `direction`: Comparison operator (`>`, `<`, `>=`, `<=`, `==`).
  - `evidence_strength`: Qualitative or quantitative statistical strength (`STRONG`, `MODERATE`, `WEAK`).
  - `source_manifest_version`: Manifest version string.
  - `reason_code`: Descriptive reason code for explainability.
- **`StabilityResult`**: Complete verdict container:
  - `verdict`: Final `StabilityVerdict`.
  - `available`: Boolean indicating whether verified stability inference is available.
  - `evidence`: List of `StabilityEvidenceItem`.
  - `reason`: Human/machine-readable justification.
  - `manifest_version`: Version string of active manifest.
  - `manifest_sha256`: SHA-256 digest of active manifest file.

### 3.2 Manifest Loader (`src/kyntra/stability/manifest.py`)
- Reads and parses JSON manifests against `StabilityManifestModel`.
- Computes SHA-256 checksum dynamically.
- Thread-safe caching mechanism (`load_stability_manifest(path, force_reload)`).
- Validates version compatibility (`manifest_version.startswith("1.")`).
- Fails closed safely if manifest file is missing or invalid, returning a safe fallback resulting in `UNKNOWN`.

### 3.3 Runtime Evaluator (`src/kyntra/stability/evaluator.py`)
- **Strict safety gating**: If zero `ENABLED` rules exist in the manifest, immediately returns `verdict=UNKNOWN`, `available=False`, `reason="STABILITY_RULESET_PENDING_VERIFICATION"`.
- **Precedence**: `HIGH_RISK` trumps `CAUTION`, which trumps `FAVORABLE`. If contradictory rules trigger, the conservative safety-critical risk verdict prevails.
- **Robust feature handling**: Missing features or `NaN` values trigger fallback evidence items (`reason_code="FEATURE_UNAVAILABLE"`) and fail safely without crashing.
- **Deterministic**: Pure function with zero external side effects or state leaks.

### 3.4 Decision Engine Integration (`src/kyntra/decision/engine.py` & `src/kyntra/schemas.py`)
- In `src/kyntra/decision/engine.py`, the engine extracts live battle features:
  - `recent_pace_delta_1lap`
  - `recent_pace_delta_3laps`
  - `tyre_age_delta`
  - `speed_trap_delta`
  - `rear_threat`
- Calls `evaluate_stability(features)`.
- Populates `DecisionSnapshot.stability` (`StabilitySnapshot`) maintaining full backward compatibility with the existing contract (`method="DETERMINISTIC_POST_PASS_STABILITY_V1"`).

---

## 4. Test Suite Execution & Verification

Executed via pytest:
```
============================== 114 passed in 3.65s ==============================
```

### Stability Specific Test Cases (`tests/test_stability_runtime.py`):
1. `test_default_manifest_returns_unknown_pending_verification`: Verifies default runtime with candidate rules returns `UNKNOWN` and `available=False`.
2. `test_missing_manifest_fails_closed_safely`: Verifies non-existent manifest path returns `UNKNOWN` safely.
3. `test_candidate_and_disabled_rules_ignored`: Verifies rules with `CANDIDATE`, `DISABLED`, `INSUFFICIENT_DATA`, `NO_STABLE_SIGNAL` are ignored even if triggered.
4. `test_enabled_favorable_rule_triggers_favorable`: Verifies valid `ENABLED` rule triggers `FAVORABLE` with complete evidence items.
5. `test_enabled_high_risk_rule_triggers_high_risk`: Verifies valid `ENABLED` rule triggers `HIGH_RISK`.
6. `test_high_risk_takes_precedence_over_favorable`: Verifies safety-first precedence when both `HIGH_RISK` and `FAVORABLE` conditions are met.
7. `test_missing_feature_and_nan_handled_safely`: Verifies `NaN` or missing keys in feature dict fail gracefully.
8. `test_thread_safe_caching_and_reload`: Verifies manifest caching and SHA computation.
9. `test_decision_engine_integration_with_stability`: Verifies end-to-end integration with `DecisionEngine.evaluate()`.
10. `test_decision_snapshot_schema_backward_compatibility`: Verifies `StabilitySnapshot` serializes cleanly and adheres to API schema.
11. `test_frozen_model_bundle_integrity`: Verifies LightGBM model bundle SHA-256 matches exact frozen hash.

---

## 5. Frozen Asset Verification

- **Model Bundle**: `models/kyntra_overtake_bundle_v1.joblib`
  - Computed SHA-256: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`
  - Status: **VERIFIED UNCHANGED**

- **Frontend Application**: `web/`
  - TypeScript compilation: **PASS**
  - Vite production bundle: **PASS** (341.19 kB bundle, 0 errors)

---

## 6. Next Steps
- Obtain empirical threshold evidence from Phase 06A Colab execution.
- Review empirical stability analysis report (`reports/KYNTRA_STABILITY_EDA_REPORT.md`).
- Update `configs/stability_evidence_manifest_v1.json` with empirical thresholds for vetted rules, changing status from `CANDIDATE` to `ENABLED` only for verified signals.
