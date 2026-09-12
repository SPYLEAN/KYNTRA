# KYNTRA — PHASE 08.5 REPORT
## STRATEGY RANKING TRUTH + EXPLANATION HARDENING

**Timestamp:** 2026-09-12T21:01:00+05:30  
**Phase Status:** PASSED  
**Frozen Model Bundle SHA-256:** `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (VERIFIED MATCH)  
**Backend Test Suite:** 205 / 205 PASSED (188 baseline + 17 new Phase 08.5 truth-hardening tests)  
**Frontend Production Build:** PASSED (Vite production build clean in 588ms)  
**Candidate Recommendation Publication Status:** `PENDING_FINAL_GATE` (Preserved for Phase 09)

---

### 1. Constant Audit & Classification

A comprehensive audit was performed across all Phase 08 ranking, recommendation, and explanation production code (`src/kyntra/strategy/ranking.py`, `src/kyntra/strategy/explanations.py`, `src/kyntra/strategy/recommendation.py`). Every numerical literal has been identified, classified, and externalized:

| Constant | Location / Usage | Old Classification | New Classification & Resolution |
|---|---|---|---|
| **`0.05 s`** | Lap-time comparison tolerance (Tier 5) | Anonymous literal | **`CONFIG_ASSUMPTION`**: Moved to `configs/strategy_ranking_v1.yaml` (`lap_time_comparison_tolerance_s`). Explicitly labeled as simulation noise equivalence band. |
| **`0.05 MJ`** | Terminal simulated energy tolerance (Tier 6) | Anonymous literal | **`CONFIG_ASSUMPTION`**: Moved to `configs/strategy_ranking_v1.yaml` (`terminal_energy_comparison_tolerance_mj`). Explicitly labeled as numerical rounding tolerance. |
| **`0.80 s`** | Battle gap threshold for `KINEMATIC_OPPORTUNITY_DEFICIT` | Anonymous heuristic | **`CONFIG_ASSUMPTION`**: Moved to `configs/strategy_ranking_v1.yaml` (`kinematic_opportunity_deficit.gap_threshold_s`). Gated alongside closing rate and frozen P1/P2/P3 context. |
| **`0.35`** | P2 pass probability floor for kinematic deficit | Anonymous heuristic | **`CONFIG_ASSUMPTION`**: Moved to `configs/strategy_ranking_v1.yaml` (`kinematic_opportunity_deficit.min_p2_threshold`). Represents model-projected pass opportunity floor. |
| **`0.40 MJ`** | Minimum starting energy floor for overtake deployment | Anonymous heuristic | **`CONFIG_ASSUMPTION`**: Moved to `configs/strategy_ranking_v1.yaml` (`energy_infeasibility_threshold.min_initial_energy_mj`). Minimum single-burst reserve. |
| **`4.0 MJ`** | Usable energy store ceiling per lap | Unnamed literal | **`SOURCE_BACKED`**: Declared as named constant `FIA_2026_MAX_ES_CAPACITY_MJ = 4.0` per FIA 2026 Technical Regulations. |

Zero anonymous comparison or explanation thresholds remain in production ranking Python.

---

### 2. Versioned Ranking Configuration

Created dedicated versioned configuration file:
- **Path:** [`configs/strategy_ranking_v1.yaml`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/configs/strategy_ranking_v1.yaml)
- **Version:** `1.0.0`
- **SHA-256 Integrity:** Dynamically hashed on load via `load_strategy_ranking_config()` in [`src/kyntra/strategy/config.py`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/src/kyntra/strategy/config.py).
- **Metadata Structure:** All entries expose `value`, `unit`, `status = "CONFIG_ASSUMPTION"`, `description`, and `rationale`.

---

### 3. Unknown Semantics & Uncertainty Preservation

Strict verification confirms that `UNKNOWN` is never silently promoted into `ALLOWED`, `FEASIBLE`, `SAFE`, `WEAK`, `MODERATE`, or `CAUTION`:

1. **Regulatory Legality (`rule_res == "UNKNOWN"`)**:
   - For risk-bearing actions (`OVERTAKE`): Fails closed immediately (`is_eligible = False`, `excluded_at = REGULATORY_ELIGIBILITY`). Cannot be positively recommended.
   - For neutral/defensive actions (`CONSERVE`, `BUILD`, `DEPLOY`): Allowed to continue as defensive fallback, but uncertainty is recorded in audit trace.
2. **Energy Feasibility (`available = False`)**:
   - Eliminates the action immediately at Tier 2 (`is_feasible = False`). Never assumed feasible.
3. **Stability Consensus (`stability.verdict == "UNKNOWN"`)**:
   - Stability V1 consensus only outputs `HIGH_RISK`, `CAUTION`, or `UNKNOWN`. It never emits `FAVORABLE`.
   - `UNKNOWN` is preserved in the trace and does not trigger dominance over other actions.
4. **Future Window Quality (`future_window_quality == UNKNOWN`)**:
   - Ordinal rank is `-1`. An action with `UNKNOWN` future window cannot dominate and is eliminated if another selectable action has known ordinal quality (`STRONG`, `MODERATE`, `WEAK`).

---

### 4. Energy Explanation Semantics Correction

All energy explanation text and docstrings were corrected:
- **No Power vs. Energy Confusion:** Removed any claim that "battery storage cannot deliver 350kW MGU-K demand" (350 kW is a power rate, not an energy quantity in MJ).
- **No Measured Battery SOC Claims:** Corrected all wording to state:
  > *"The selected counterfactual deployment is infeasible under the current SIMULATED ENERGY STATE and active regulation-constrained deployment limits."*
- Telemetry provenance is explicitly tagged as `SIMULATED_ENERGY` from 2026 regulation-constrained models.

---

### 5. Explanation Token Evidence & Trigger Audit

Each of the 9 supported "WHY NOT OVERTAKE NOW?" tokens has been audited for strict runtime evidence grounding:

| Token | Exact Trigger Source | Required Availability | Provenance |
|---|---|---|---|
| **`RULE_RESTRICTION`** | `overtake_outcome.rule_check.result == "BLOCKED"` | `rule_check.available == True` | `ActionRuleCheckSnapshot` from verified FIA rule engine |
| **`ENERGY_INFEASIBILITY`** | `overtake_outcome.energy.before_mj < cfg.min_initial_energy_mj` or deployment infeasible | `energy.available == True` | 2026 regulation-constrained energy simulation |
| **`POST_PASS_INSTABILITY`** | `overtake_outcome.stability.verdict == "HIGH_RISK"` | `stability.available == True` | Post-Pass Stability V1 consensus manifest |
| **`FUTURE_WINDOW_DOMINANCE`** | Selected alternative (`BUILD` or `DEPLOY`) has superior future window quality | `forecast.future_window_quality` | Short-horizon counterfactual rollout |
| **`REAR_THREAT`** | `battle_data.get("rear_threat") == "HIGH"` | Genuine runtime observable in `battle_data` | `BattleState` runtime observable |
| **`KINEMATIC_OPPORTUNITY_DEFICIT`** | `p2 < cfg.kinematic_min_p2` OR (`gap > cfg.kinematic_gap_threshold_s` and `closing_rate <= 0`) | `pass_context.current_p2` or battle kinematics | Frozen P1/P2/P3 context & runtime kinematics |
| **`ENERGY_SENSITIVITY`** | `robustness == "ENERGY_SENSITIVE"` | Completed multi-scenario evaluation | Multi-scenario robustness evaluator |
| **`INSUFFICIENT_INFORMATION`** | Critical input unavailable or `UNKNOWN` rule check | Missing/indeterminate upstream data | Fail-closed uncertainty preservation |
| **`STRATEGY_TIE`** | Deadlock across all 6 tiers (`NO_DOMINANT_ACTION`) | Ranking trace completed | Terminal equivalence detection |

#### Rear Threat Observable Enforcement
`REAR_THREAT` is strictly gated to `battle_data.get("rear_threat") == "HIGH"`. If `rear_threat` is missing, `None`, or unobserved, `REAR_THREAT` cannot fire.

---

### 6. Regulation Source of Truth Audit

- Confirmed that the strategy ranker does not independently parse or interpret FIA sporting regulations.
- The ranker solely consumes `ActionRuleCheckSnapshot` produced by the canonical rule engine in `src/kyntra/regulations/`.
- Removed all independent claims to specific FIA article numbers from ranking documentation and internal ranking comments.
- **One regulation engine. One source of truth.**

---

### 7. Performance & Latency Documentation Cleanup

Removed all unsupported claims regarding an external "100 ms live pit-wall telemetry dispatch envelope". All latency claims are strictly scoped to verified local benchmarks:

- **Benchmark Environment:** Measured locally on the current development environment across 100 consecutive iterations.
- **Median Latency:** 22.20 ms
- **95th Percentile (p95):** 38.41 ms
- **99th Percentile (p99):** 51.47 ms
- **Mean Latency:** 23.81 ms

---

### 8. Full Provenance Exposure

[`StrategyRankingSnapshot`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/src/kyntra/strategy/models.py) now exposes all 7 required provenance attributes:
```python
ranking_config_version: str = "1.0.0"
ranking_config_sha256: str = "..."
strategy_config_version: str = "1.0.0"
strategy_config_sha256: str = "..."
model_sha256: str = "a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5"
stability_manifest_sha256: str = "..."
rule_bundle_version: str = "2026_FIA_ISSUE_20"
```

---

### 9. Test Suite Verification

- **New Test Suite:** [`tests/test_strategy_ranking_truth_hardening.py`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/tests/test_strategy_ranking_truth_hardening.py) — **17 passed**
- **Full Backend Pytest Suite:** **205 passed** in 20.69s (100% green, 0 failures)
- **Frontend Production Build:** Vite build successful in 588ms.
- **Model Invariant:** LightGBM bundle SHA-256 unchanged.

---

### 10. Known Limitations

1. **Simulated Energy States:** Energy values remain derived from 2026 regulation models and counterfactual policies; they do not represent measured physical telemetry from a running 2026 power unit.
2. **Kinematic Thresholds:** Gap and P2 thresholds in `configs/strategy_ranking_v1.yaml` are tactical heuristic assumptions (`CONFIG_ASSUMPTION`), not universal physical barriers to overtaking.
3. **Publication Gating:** Candidate recommendations remain in `publication_status = "PENDING_FINAL_GATE"` until the final Phase 09 Freshness & Coherence Gate is deployed.

---

**VERDICT: PASS — KYNTRA STRATEGY BRAIN TRUTH HARDENED FOR FINAL GATE**
