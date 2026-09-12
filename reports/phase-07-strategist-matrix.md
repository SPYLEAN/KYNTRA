# KYNTRA — PHASE 07 TECHNICAL REPORT
**Dynamic Strategist Matrix + Counterfactual Scenario Engine**
*Date: 2026-09-12*

## 1. Executive Summary
Phase 07 implements the canonical backend **Strategist Matrix** (`StrategyMatrixSnapshot`), providing coherent, multivariate counterfactual action rollouts across four discrete strategist alternatives: `CONSERVE`, `BUILD`, `DEPLOY`, and `OVERTAKE`.

Key Accomplishments:
- **Fair Baseline Invariant**: All four actions evaluate from the exact same initial state. Cloned state rollouts ensure complete action evaluation order independence.
- **Critical ML Truth Invariant**: The frozen LightGBM model outputs baseline $P_1, P_2, P_3$ pass probabilities. No fake action-conditioned probabilities are fabricated (`action_effect_available = False`).
- **Simulated Energy Scenarios**: Every action produces three deterministic 2026 regulation-constrained assumption cases (`CONSERVATIVE`, `NOMINAL`, `FAVORABLE`), strictly tagged `SIMULATED`, never called measured SOC.
- **Regulatory Independence**: Sporting restrictions (e.g. SC/VSC Article B5.12.2(c)) block `OVERTAKE` while `DEPLOY`, `CONSERVE`, and `BUILD` remain independently evaluated and allowed.
- **Stability V1 Integration**: Reuses locked Stability V1 consensus. `CONSERVE` and `BUILD` receive `NOT_APPLICABLE` as they do not gain position; `OVERTAKE` evaluates post-pass durability; `DEPLOY` does not assume a pass has occurred.
- **Hardened Integrity**: Ranking and recommendation remain disabled (`ranking.available = False`, `recommendation.available = False`).
- **Test & Performance Verification**: 144 backend tests pass (100%), frozen LightGBM model bundle SHA remains unaltered, frontend build passes cleanly, and measured generation latency is **18.11ms median** / **23.03ms p95**.

---

## 2. Architecture & Domain Structure

```
src/kyntra/strategy/
├── __init__.py           # Public package interface
├── models.py             # Pydantic schemas (StrategyMatrixSnapshot, ActionOutcomeSnapshot, etc.)
├── counterfactuals.py    # Deterministic action simulators (regulation, energy, stability, forecast)
└── matrix.py             # Canonical matrix generator & snapshot assembler
```

### 2.1 Schema Hierarchy
- **`StrategyMatrixSnapshot`**:
  - Identity: `snapshot_id`, `battle_id`, `mode`, `source_mode`
  - Provenance & Time: `decision_time`, `event_time`, `received_time`, `state_age_ms`, `freshness_status`
  - Versions: `model_version`, `model_sha256`, `rule_bundle_version`, `stability_manifest_version`, `stability_manifest_sha256`, `dataset_sha256`
  - Context: `current_state_summary`, `pass_window`
  - Actions: Dictionary mapping `"CONSERVE"`, `"BUILD"`, `"DEPLOY"`, `"OVERTAKE"` to `ActionOutcomeSnapshot`
  - Gated Status: `ranking = {"available": False}`, `recommendation = {"available": False}`, `reason = "STRATEGY_RANKING_PENDING_PHASE_08"`
- **`ActionOutcomeSnapshot`**:
  - `action`: `CONSERVE | BUILD | DEPLOY | OVERTAKE`
  - `eligible`: Boolean reflecting regulatory legality
  - `rule_check`: `result` (`ALLOWED | BLOCKED | UNKNOWN`), `rule_ids`, `rule_bundle_version`
  - `energy`: `before_mj`, `planned_deployment_mj`, `expected_recovery_mj`, `after_mj`, `provenance`, `assumption_set`
  - `pass_context`: `current_p1`, `current_p2`, `current_p3`, `action_effect_available = False`
  - `stability`: `verdict`, `available`, `reason`, `available_families`, `triggered_families`
  - `forecast`: `horizon_laps`, `projected_position_delta`, `projected_gap_delta`, `cumulative_lap_time_consequence_s`, `future_window_quality`, `rear_threat`, `terminal_energy_mj`
  - `energy_scenarios`: `CONSERVATIVE`, `NOMINAL`, `FAVORABLE`
  - `robustness`: `"NOT_EVALUATED"` (reserved for future sensitivity phase)

---

## 3. Action Semantics & Counterfactual Assumptions

| Action | Tactical Intent | Regulatory Status (SC/VSC) | Energy Policy (Deployment/Harvest) | Stability Context | Projected Gap Trend | Future Window Quality |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **CONSERVE** | Minimize deployment; harvest energy | `ALLOWED` | 0.40 MJ deploy / 1.25 MJ harvest | `NOT_APPLICABLE` | Back off $+0.25$s/lap | `MODERATE` |
| **BUILD** | Prepare window; surplus charge | `ALLOWED` | 0.95 MJ deploy / 1.35 MJ harvest | `NOT_APPLICABLE` | Hold steady $\pm 0.0$s/lap | `STRONG` |
| **DEPLOY** | Tactical pace pressure; no pass assumed | `ALLOWED` | 1.65 MJ deploy / 1.20 MJ harvest | Current battle consensus | Close $-0.15$s to $-0.30$s/lap | `MODERATE` |
| **OVERTAKE** | Committed pass attempt on opportunity | `BLOCKED` (B5.12.2/B5.13.2) | 2.30 MJ deploy / 1.10 MJ harvest | Full Stability V1 durability | Collapse to pass delta | `STRONG` / `WEAK` (risk-gated) |

---

## 4. Energy Scenarios (FIA 2026 Constraints)
Under FIA Article C5.2.7 and C5.2.9:
- Usable Energy Store window is strictly capped at $4.0$ MJ.
- Maximum per-lap recharge limit is $9.0$ MJ.
- For each action, three deterministic assumption cases are rolled out over the 3-lap horizon:
  - **`CONSERVATIVE`**: Harvest reduced by 20%, deployment draw increased by 10%.
  - **`NOMINAL`**: Baseline expected efficiency.
  - **`FAVORABLE`**: Harvest increased by 20%, deployment draw reduced by 10%.
- Physical Invariants Verified:
  - $E_{\text{terminal}}(\text{CONSERVATIVE}) \le E_{\text{terminal}}(\text{NOMINAL}) \le E_{\text{terminal}}(\text{FAVORABLE})$.
  - $E_{\text{terminal}}(\text{CONSERVE}) \ge E_{\text{terminal}}(\text{BUILD}) \ge E_{\text{terminal}}(\text{DEPLOY}) \ge E_{\text{terminal}}(\text{OVERTAKE})$.

---

## 5. Regulatory & Stability Behavior
- **Regulatory Independence**: If the race is neutralized under VSC, `OVERTAKE` is tagged `BLOCKED` with citation `FIA_SR_B5.12.2(c)`, while `DEPLOY`, `CONSERVE`, and `BUILD` remain `ALLOWED`.
- **Stability Mapping**:
  - `CONSERVE` and `BUILD` receive `verdict = "NOT_APPLICABLE"` and `reason = "ACTION_DOES_NOT_GAIN_POSITION"`.
  - `OVERTAKE` receives full post-pass durability evidence from Stability V1.
  - `DEPLOY` exposes current stability context but notes `reason = "DEPLOY_DOES_NOT_ASSUME_COMPLETED_PASS"`.

---

## 6. Future Window Quality Logic
Future window quality is a deterministic typed classification (`STRONG`, `MODERATE`, `WEAK`, `UNKNOWN`) driven by physics and risk:
- `BUILD` yields `STRONG` if terminal energy $\ge 2.5$ MJ, enabling a potent upcoming attack window (`PREPARE_ATTACK_WINDOW`).
- `OVERTAKE` yields `WEAK` if post-pass stability is `HIGH_RISK` (high repass probability), or `STRONG` if pass probability is favorable and stability is clear.
- `CONSERVE` and `DEPLOY` yield `MODERATE` due to energy-pace trade-offs.
- Incomplete battle telemetry safely falls back to `UNKNOWN` with `WINDOW_NOT_EVALUABLE`.

---

## 7. Failure Degradation & Provenance
- Missing energy telemetry gracefully degrades only the `energy` block (`available = False`, `before_mj = None`); `pass_context` and `rule_check` remain active.
- Missing stability observables fall back to `verdict = "UNKNOWN"` without exceptions.
- Missing model features degrade `pass_window.available = False` with `FROZEN_MODEL_FEATURE_MISSING`.
- All fields carry strict provenance: `FROZEN_MODEL`, `SIMULATED — 2026 REGULATION CONSTRAINED`, `FORECAST_SIMULATION`, `RULE_CHECK`. No simulated figures are labeled as measured or historical.

---

## 8. API Integration
The Strategist Matrix is exposed via REST endpoints:
- `GET /api/strategy/matrix/current`: Active / default race battle matrix.
- `GET /api/strategy/matrix/{event_id}/{lap}`: Replay matrix at specific lap.
- `GET /api/strategy/matrix/{event_id}/{lap}/{attacker}/{defender}`: Explicit battle pair matrix.
- `POST /api/strategy/matrix`: On-demand matrix generation from custom payload.

---

## 9. Automated Verification & Benchmark Results

### 9.1 Pytest Suite
```
tests/test_strategy_matrix.py ..................... [ 100% ]
======================== 144 passed, 38 warnings in 26.58s ========================
```
- Total backend tests: **144 passed** (100% pass rate).
- Dedicated strategy matrix tests: **21 passed**.
  - All 4 actions present.
  - Shared initial state across actions.
  - Action evaluation order independence confirmed (forward vs reverse execution identical).
  - P1/P2/P3 preserved from frozen model.
  - ML truth invariant verified (`action_effect_available is False`).
  - SC/VSC regulatory blocking verified.
  - Energy scenario invariants verified.
  - No simulated SOC as measured.
  - Provenance tagging verified.
  - Replay and synthetic source modes preserved.
  - Ranking & recommendation gated as unavailable.
  - Model SHA verified.

### 9.2 Measured Performance
Benchmarked across 100 consecutive full matrix generations:
- **Median Runtime**: **18.11 ms**
- **P95 Runtime**: **23.03 ms**
- Result: **WELL WITHIN REAL-TIME LIMITS (< 50 ms)**

### 9.3 Frozen Model Bundle Checksum
- Path: `models/kyntra_overtake_bundle_v1.joblib`
- SHA-256: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`
- Status: **VERIFIED UNTOUCHED**

### 9.4 Web Frontend Build
- `npm run build` in `web/`: **BUILT IN 1.04s (0 ERRORS)**.

---

## 10. Known Limitations
1. **No Causal Action Probabilities**: The system deliberately does not claim that choosing `DEPLOY` increases $P_1$ by $X\%$, preserving strict ML integrity.
2. **Fixed Rollout Horizon**: Rollouts use a 3-lap horizon; multi-stint pit stop strategy is out of scope for tactical battle counterfactuals.
3. **Robustness Evaluation Deferred**: Action robustness sensitivity analysis is set to `NOT_EVALUATED` pending the Phase 08 ranking engine.
