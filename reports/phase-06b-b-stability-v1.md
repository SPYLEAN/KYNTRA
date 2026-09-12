# KYNTRA — PHASE 06B-B TECHNICAL REPORT
**Reviewed Composite Post-Pass Stability V1 Architecture**
*Date: 2026-09-12*

## 1. Executive Summary
Phase 06B-B transitions the KYNTRA post-pass position stability subsystem from the unconfigured runtime shell (Phase 06B-A) into the conservative, empirically grounded **KYNTRA Post-Pass Stability V1**.
- **Evidence-Driven Multi-Family Consensus**: Rather than evaluating isolated rules independently, Stability V1 enforces an independent multi-family consensus policy across three physical families: `PACE`, `SPEED`, and `TYRE`.
- **Zero Empirical Thresholds in Python**: All cutoff boundaries, rule directions, physical units, and consensus policy criteria reside purely in [`configs/stability_evidence_manifest_v1.json`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/configs/stability_evidence_manifest_v1.json).
- **FAVORABLE Deliberately Suppressed in V1**: Given sparse retention event density in the canonical training splits, emitting `FAVORABLE` in production is statistically unsupportable. The subsystem emits only `HIGH_RISK`, `CAUTION`, and `UNKNOWN`.
- **Integrity**: 123 backend tests pass (100%), frozen LightGBM model bundle SHA remains unaltered, and frontend build passes cleanly.

---

## 2. Empirical Source & Canonical Dataset
The reviewed evidence rules were derived strictly from the canonical training split of the locked overtake dataset without utilizing demonstration holdouts.

| Parameter | Canonical Value |
| :--- | :--- |
| **Dataset Filename** | `kyntra_overtake_dataset.parquet` |
| **Dataset SHA-256** | `bec6dc848bcdd9a5b8c1b8aba63384e73abe7d41552656b218a5d6832984afac` |
| **Total Rows / Columns** | 8,357 rows × 78 columns |
| **TRAIN Cohort** | 6,197 rows (used for threshold derivation) |
| **VALIDATION Cohort** | 2,160 rows (used for directional verification) |
| **Isolated Demo Holdouts** | `2026_01_AUS`, `2026_03_JPN`, `2026_04_MIA`, `2026_13_ITA` (100% untouched) |
| **Primary Evaluation Horizon** | 2 Laps post-pass |

---

## 3. Reviewed Rule Configuration & Family Semantics

Rules are categorized into three physical families. A family is **AVAILABLE** if at least one enabled rule in that family has a non-null, finite observed value. A family is **TRIGGERED** if at least one enabled rule in that family triggers its threshold condition.

### 3.1 Enabled Risk Rules
| Rule ID | Feature | Family | Direction | Threshold | Unit | Target Verdict | Status | Evidence Strength |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `PACE_CLOSE_RATE_RISK` | `closing_rate` | `PACE` | `<=` | -0.192 | m/s | `HIGH_RISK` | `ENABLED` | `STRONG` |
| `PACE_1L_RISK` | `recent_pace_delta_1lap` | `PACE` | `<=` | -0.1959 | s | `HIGH_RISK` | `ENABLED` | `STRONG` |
| `PACE_3L_RISK` | `recent_pace_delta_3laps` | `PACE` | `<=` | -0.1816 | s | `HIGH_RISK` | `ENABLED` | `STRONG` |
| `SPEED_TRAP_DEFICIT_RISK` | `speed_trap_delta` | `SPEED` | `<=` | -9.0 | km/h | `HIGH_RISK` | `ENABLED` | `STRONG` |
| `TYRE_AGE_DISADVANTAGE_RISK` | `tyre_age_delta` | `TYRE` | `<=` | -3.5 | laps | `HIGH_RISK` | `ENABLED` | `STRONG` |

*Note on Correlated Evidence*: Multiple triggered rules within the `PACE` family still count as exactly **ONE** triggered risk family, preventing statistical double-counting of correlated telemetry.

### 3.2 Disabled Candidates
| Rule ID / Candidate | Status | Reason for Deactivation |
| :--- | :--- | :--- |
| `rear_distance_gap_m` | `DISABLED` | Pending multi-car spatial tracking validation; high sensor noise in single-pair feeds. |
| `gap_seconds` | `DISABLED` | Evaluates overtake opportunity arrival rather than post-pass durability. |
| Any `FAVORABLE` candidate | `DISABLED` | Sparse repass sample cannot statistically justify affirmative durability calls in V1. |

---

## 4. Manifest-Driven Classification Policy
The runtime evaluator strictly enforces the consensus policy defined in manifest `policy`:
```json
"policy": {
  "min_available_families": 2,
  "high_risk_min_triggered_families": 2,
  "favorable_enabled": false
}
```

1. **Insufficient Evidence**: If `len(available_families) < 2`:
   - `verdict = UNKNOWN`
   - `available = False`
   - `reason = "INSUFFICIENT_INDEPENDENT_STABILITY_EVIDENCE"`
2. **Multi-Family Risk Consensus**: If `len(available_families) >= 2` AND `len(triggered_families) >= 2`:
   - `verdict = HIGH_RISK`
   - `available = True`
   - `reason = "MULTI_FAMILY_POST_PASS_RISK"`
3. **No Risk Consensus (Safe Middle Ground)**: If `len(available_families) >= 2` AND `len(triggered_families) < 2`:
   - `verdict = CAUTION`
   - `available = True`
   - `reason = "NO_MULTI_FAMILY_RISK_CONSENSUS"`

*CAUTION is explicitly treated as ordinal risk classification, NEVER as a pseudo-probability of retention.*

---

## 5. Missingness & Robustness Behavior
- **Missing / None Inputs**: If a feature is `None`, it is treated as unobserved.
- **NaN / Inf Inputs**: If a feature is `math.isnan(x)` or `math.isinf(x)`, it is rejected from family availability and cannot trigger rules.
- **Partial Family Availability**: If `closing_rate` is missing but `recent_pace_delta_1lap` is present, the `PACE` family is valid and evaluated.
- **Fail-Closed Fallback**: If the manifest is unreadable, missing, or malformed, the evaluator returns `verdict = UNKNOWN`, `available = False`, `reason = "STABILITY_MANIFEST_UNAVAILABLE"`.

---

## 6. Decision Engine & Schema Integration
- In `compute_decision()` (`src/kyntra/decision/engine.py`), genuine observables (`closing_rate`, `recent_pace_delta_1lap`, `recent_pace_delta_3laps`, `speed_trap_delta`, `tyre_age_delta`) are passed into `evaluate_stability()`.
- Neither `rear_threat` nor `gap_seconds` is passed as stability evidence.
- `StabilitySnapshot` and `DecisionSnapshot.stability` expose full provenance:
  - `method = "DETERMINISTIC_POST_PASS_STABILITY_V1"`
  - `verdict = "HIGH_RISK" | "CAUTION" | "UNKNOWN"`
  - `available = True | False`
  - `available_families = ["PACE", "SPEED", "TYRE"]`
  - `triggered_families = [...]`
  - `dataset_sha256 = "bec6dc848bcdd9a5b8c1b8aba63384e73abe7d41552656b218a5d6832984afac"`
  - `manifest_version = "1.1.0"`
  - `manifest_sha256 = <dynamically computed hex SHA>`

---

## 7. Verification & Automated Test Results
- **Full Backend Pytest Suite**: **123 passed** in 18.61s (100% pass rate).
- **Stability Consensus Test Suite** (`tests/test_stability_runtime.py`): **20 passed**.
  1. Zero families available $\rightarrow$ `UNKNOWN`
  2. One family available $\rightarrow$ `UNKNOWN`
  3. Two families available / zero triggered $\rightarrow$ `CAUTION`
  4. Two families available / one triggered $\rightarrow$ `CAUTION`
  5. Two families available / two triggered $\rightarrow$ `HIGH_RISK`
  6. Three available / one triggered $\rightarrow$ `CAUTION`
  7. Three available / two triggered $\rightarrow$ `HIGH_RISK`
  8. All three triggered $\rightarrow$ `HIGH_RISK`
  9. Three PACE rules trigger alone $\rightarrow$ still only ONE family $\rightarrow$ `CAUTION` if another family available
  10. PACE only $\rightarrow$ `UNKNOWN`
  11. NaN handling $\rightarrow$ unobserved, fail closed
  12. Missing feature handling $\rightarrow$ unobserved, fail closed
  13. Disabled rules ignored $\rightarrow$ strictly skipped
  14. CANDIDATE rules ignored $\rightarrow$ strictly skipped
  15. FAVORABLE cannot be emitted by V1 $\rightarrow$ verified suppressed
  16. Dataset SHA exposed $\rightarrow$ exact match with canonical hash
  17. Manifest SHA exposed $\rightarrow$ 64-char hex string
  18. DecisionEngine integration $\rightarrow$ end-to-end `DecisionSnapshot` verified
  19. Missing manifest $\rightarrow$ fails closed safely to `UNKNOWN`
  20. Corrupt manifest JSON $\rightarrow$ fails closed safely to `UNKNOWN`
- **Frozen Model Bundle SHA**: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (**VERIFIED UNTOUCHED**).
- **Frontend Production Build**: `npm run build` in `web/` built cleanly in 2.04s (0 errors).

---

## 8. Known Limitations
1. **No Favorable Affirmation**: Retention events are sparse; drivers who pass rarely repass in clear air, rendering false positive costs high. Affirmative retention calls require future multi-car pack modelling.
2. **Horizon Sensitivity**: Rules operate on a 2-lap primary stability horizon. Dynamic tyre degradation cliffs beyond lap 3 are not currently modeled in this deterministic shell.
3. **Absence of Track Temperature Dynamics**: Asphalt temperature shifts altering tyre compound grip fall outside the 5 verified feature paths.
