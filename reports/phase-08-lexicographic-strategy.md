# KYNTRA — PHASE 08 REPORT
## LEXICOGRAPHIC STRATEGY RANKING + CANDIDATE KYNTRA CALL

**Timestamp:** 2026-09-12T20:53:00+05:30  
**Phase Status:** PASSED  
**Frozen Model Bundle SHA-256:** `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (VERIFIED MATCH)  
**Backend Test Suite:** 188 / 188 PASSED (160 legacy baseline + 28 new Phase 08 ranking tests)  
**Frontend Production Build:** PASSED (Vite production build clean in 767ms)  
**Candidate Recommendation Publication Status:** `PENDING_FINAL_GATE` (Held for Phase 09)

---

### 1. Executive Summary & Decision Philosophy

Phase 08 implements the decision-making brain of KYNTRA. It transforms the fair, multi-action counterfactual substrate established in Phase 07 and hardened in Phase 07.5 (`StrategyMatrixSnapshot`) into an audit-traceable, transparent strategist ranking (`StrategyRankingSnapshot`) and candidate recommendation (`CandidateRecommendation`).

#### Rejection of Scalar Weighted Scoring and "Attack Values"
A central architectural requirement of KYNTRA is the complete rejection of scalar composite scoring:
- **No Incommensurable Combinations:** Real race strategy cannot multiply millijoules of energy by tenths of a second of lap-time delta and add a categorical FIA regulation status to create an "Attack Score" or arbitrary probability index.
- **Fail-Closed Safety:** In high-speed motorsport decision support, a severe regulatory restriction (e.g., yellow flags / SC) or physical energy exhaustion must strictly eliminate an action, regardless of how fast or attractive the vehicle is dynamically. Weighted scores allow high performance in one dimension to inappropriately compensate for fatal deficits in safety or legality.
- **Pure Lexicographic Dominance:** Actions are compared across six strictly prioritized tiers. An action only competes at Tier $N+1$ if it is eligible, feasible, and non-dominated across Tiers $1 \dots N$.

---

### 2. Lexicographic Decision Order & Elimination Semantics

Each energy scenario (`CONSERVATIVE`, `NOMINAL`, `FAVORABLE`) evaluates the 4 strategist actions (`CONSERVE`, `BUILD`, `DEPLOY`, `OVERTAKE`) using deterministic action-order independent comparison.

| Tier | Criterion | Evaluation Logic | Elimination / Dominance Semantics |
|---|---|---|---|
| **Tier 1** | `REGULATORY_ELIGIBILITY` | Evaluates FIA Article 33.4 / 55.1 / Track Limits / Delta flags. | `BLOCKED` actions are immediately eliminated (`selectable = False`). `UNKNOWN` legality cannot be recommended for risk-bearing actions (`OVERTAKE`). Only `ALLOWED` actions advance. |
| **Tier 2** | `PHYSICAL_ENERGY_FEASIBILITY` | Assesses simulated MGU-K state against 4.0 MJ capacity and state availability. | Actions with `available = False` or energy exhaustion during deployment are marked unselectable. |
| **Tier 3** | `DURABLE_TRACK_POSITION` | Post-Pass Stability V1 consensus (`HIGH_RISK`, `CAUTION`, `UNKNOWN`). | If `OVERTAKE` stability is `HIGH_RISK`, and a non-overtake action (`BUILD`, `DEPLOY`, `CONSERVE`) preserves track position with a non-WEAK future window (`STRONG` or `MODERATE`), `OVERTAKE` is eliminated as dominated. |
| **Tier 4** | `FUTURE_WINDOW_DOMINANCE` | Categorical future window quality (`STRONG > MODERATE > WEAK`). | Candidates with strictly lower ordinal quality than the best surviving candidate are eliminated. `UNKNOWN` cannot dominate known states. |
| **Tier 5** | `CUMULATIVE_LAP_TIME` | 3-lap projected cumulative lap-time delta ($\Delta t_{\text{cum}}$ in seconds). | Lower (more negative) cumulative time consequence is preferred. Actions slower by $>0.05\text{s}$ tolerance are dominated. |
| **Tier 6** | `TERMINAL_SIMULATED_ENERGY` | Projected battery state of charge at end of 3-lap horizon ($E_{\text{term}}$ in MJ). | Final tie-break: Higher terminal energy wins if lap times are identical within tolerance. |

#### Deterministic Tie-Breaking
If two or more selectable candidates remain identical across all six criteria:
- **No Arbitrary Priorities:** KYNTRA refuses to arbitrarily favor `CONSERVE` over `BUILD` or `DEPLOY`.
- **Verdict:** Winner is set to `NO_DOMINANT_ACTION`.
- **Recommendation Status:** `available = False`, reason: `STRATEGY_TIE_REQUIRES_HUMAN_JUDGMENT`.

---

### 3. Multi-Scenario Robustness Engine

Each battle matrix projects three versioned energy assumption scenarios:
1. **`CONSERVATIVE`**: Degraded harvest (-15%), standard deployment.
2. **`NOMINAL`**: Calibrated baseline harvest and deployment (1.0x).
3. **`FAVORABLE`**: Elevated recovery (+15%), efficient deployment (0.95x).

The robustness engine compares scenario winners:
- `ROBUST_WITHIN_TESTED_ASSUMPTIONS`: The same action wins across all 3 scenarios.
- `ENERGY_SENSITIVE`: Different actions win across scenarios (e.g., `BUILD` wins under nominal/favorable, but `CONSERVE` wins under conservative).
- `INSUFFICIENT_INFORMATION`: Any scenario has no valid winner or missing telemetry.

---

### 4. Candidate Recommendation & "WHY NOT OVERTAKE NOW?"

When a dominant action is identified, KYNTRA maps the internal action to the pit-wall candidate directive:
- `CONSERVE` $\rightarrow$ **`SAVE ENERGY`**
- `BUILD` $\rightarrow$ **`PREPARE`**
- `DEPLOY` $\rightarrow$ **`APPLY PRESSURE`**
- `OVERTAKE` $\rightarrow$ **`OVERTAKE NOW`**

#### Publication Gate
To preserve the end-to-end invariant before Phase 09 final publication gating, all candidate recommendations are stamped:
```json
"publication_status": "PENDING_FINAL_GATE"
```

#### Deterministic "WHY NOT OVERTAKE NOW?" Explanations
When the winning candidate is *not* `OVERTAKE`, the system must provide explicit, telemetry-grounded explanation tokens:
- `RULE_RESTRICTION`: Flagged if `OVERTAKE` is blocked by FIA safety car, yellow flag, or track restrictions.
- `ENERGY_INFEASIBILITY`: Flagged if battery store cannot support 350kW MGU-K overtake demand.
- `POST_PASS_INSTABILITY`: Flagged if Post-Pass Stability V1 evaluated the pass as `HIGH_RISK` (high repass probability).
- `FUTURE_WINDOW_DOMINANCE`: Flagged if holding / preparing yields a superior subsequent attack opportunity.
- `REAR_THREAT`: Flagged if backing off or preparing exposes the car to high closing rate from behind.
- `KINEMATIC_OPPORTUNITY_DEFICIT`: Flagged if current gap ($>0.8\text{s}$) or closing rate is insufficient.
- `ENERGY_SENSITIVITY`: Flagged if overtake viability collapses under conservative energy assumptions.
- `STRATEGY_TIE`: Flagged if actions are deadlocked across all criteria.

---

### 5. Adversarial Test Suite Validation

All 7 adversarial stress tests passed cleanly:

| Test Case | Scenario Setup | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| **CASE 1** | `OVERTAKE` fastest lap time (-0.60s) but regulatory status `BLOCKED` (Yellow Flag). | `OVERTAKE` excluded at Tier 1; cannot win. `why_not_overtake` contains `RULE_RESTRICTION`. | `BLOCKED` excluded; `DEPLOY` wins; `RULE_RESTRICTION` logged. | **PASS** |
| **CASE 2** | `OVERTAKE` fastest but `HIGH_RISK` stability; `BUILD` has `STRONG` future window. | `OVERTAKE` dominated at Tier 3 by `BUILD`. `why_not_overtake` contains `POST_PASS_INSTABILITY`. | `OVERTAKE` excluded at Tier 3; `BUILD` wins; `POST_PASS_INSTABILITY` logged. | **PASS** |
| **CASE 3** | `DEPLOY` fastest short-term delta (-0.35s) but energy storage infeasible/unavailable. | `DEPLOY` excluded at Tier 2; cannot win. | `DEPLOY` excluded; compliant feasible candidate wins. | **PASS** |
| **CASE 4** | `BUILD` wins `NOMINAL` & `FAVORABLE`, but `CONSERVE` wins `CONSERVATIVE`. | Robustness evaluated as `ENERGY_SENSITIVE`. | `robustness_assessment = "ENERGY_SENSITIVE"`. | **PASS** |
| **CASE 5** | All 4 actions synthetic clones with identical eligibility, feasibility, window, and metrics. | Lexicographic deadlock: `winner = NO_DOMINANT_ACTION`; recommendation `available = False`. | Tied deadlock detected; recommendation withheld for human judgment. | **PASS** |
| **CASE 6** | `OVERTAKE` regulatory status `UNKNOWN` (missing flag telemetry). | `OVERTAKE` unselectable for positive candidate recommendation. | `OVERTAKE` barred from selection; fails closed. | **PASS** |
| **CASE 7** | Corrupted / missing stability and future window across all actions. | Safe abstention: `available = False`, `why_selected` explains data deficit. | Fails closed; human pit wall judgment flagged. | **PASS** |

---

### 6. Performance Benchmarking

Benchmark conducted over 100 consecutive iterations evaluating full matrix construction, counterfactual simulation, 6-tier lexicographic ranking, robustness check, and explanation generation:

- **Median Latency:** 22.20 ms
- **95th Percentile (p95):** 38.41 ms
- **99th Percentile (p99):** 51.47 ms
- **Mean Latency:** 23.81 ms

*Conclusion:* The ranking engine runs in under 40 ms at p95, well within the real-time 100 ms pit wall telemetry dispatch loop.

---

### 7. Verification Invariants

1. **LightGBM Model Bundle Integrity:**
   - Path: `models/kyntra_overtake_bundle_v1.joblib`
   - Expected SHA-256: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`
   - Computed SHA-256: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`
   - Status: **UNTOUCHED & IDENTICAL**

2. **Backend Regression Testing:**
   - 188 / 188 tests passing across dataset, models, API, energy, stability, counterfactuals, and ranking suites.

3. **Frontend Production Build:**
   - Vite 8.2.2 compilation cleanly bundled in 767 ms with zero TypeScript or JSX errors.

---

### 8. Phase 09 Readiness

The candidate recommendation engine is fully operational in backend logic and verified under all adversarial race conditions. In accordance with safety protocol, candidate recommendations remain in `publication_status = "PENDING_FINAL_GATE"` until the final Phase 09 Freshness & Coherence Gate is deployed.

**VERDICT: PASS — KYNTRA STRATEGY BRAIN READY FOR FINAL GATE**
