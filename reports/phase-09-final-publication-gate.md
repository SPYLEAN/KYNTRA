# KYNTRA — PHASE 09 REPORT
## FINAL DECISION PUBLICATION GATE + CALL LIFECYCLE + FORENSIC AUDIT

**Timestamp:** 2026-09-12T21:25:00+05:30  
**Phase Status:** PASSED  
**Frozen Model Bundle SHA-256:** `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (VERIFIED EXACT MATCH)  
**Backend Test Suite:** 237 / 237 PASSED (205 baseline + 32 new Phase 09 final gate tests, 100% green)  
**Frontend Production Build:** PASSED (Vite production bundle built clean in 714ms)  
**End-to-End Decision Cycle Latency:** Median: 33.01 ms | p95: 44.72 ms | p99: 61.33 ms (100-iteration benchmark)

---

### 1. Executive Summary & Core Invariants

Phase 09 establishes the final safety and coherence gate between **Candidate Recommendations** (`PENDING_FINAL_GATE`) and **Published KYNTRA Calls** (`VALID`). 

Prior to Phase 09, ranking produced a candidate recommendation, but it remained strictly pending final publication. In Phase 09, a candidate recommendation can **never** automatically appear on the strategist's pit wall without passing the full 7-point pre-publication safety and coherence gate against the newest coherent race state.

#### Core Architectural Guarantees:
1. **Candidate Never Automatically Visible:** Ranking output is merely a proposal; publication requires atomic multi-point verification.
2. **Explicit Recommendation Lifecycle:** Calls transition through strictly defined states: `PENDING_FINAL_GATE`, `VALID`, `AGING`, `EXPIRED`, `INVALIDATED`, `BLOCKED`, `WITHHELD`.
3. **Immutable DecisionSnapshots:** Every published, blocked, or withheld decision is recorded as an immutable, append-only forensic audit record (`DecisionSnapshot`) with all 28+ required fields.
4. **Historical Replay vs Reanalysis Separation:** Historical replay displays the stored immutable historical belief; running reanalysis is explicitly tagged `is_reanalysis = True`.
5. **Zero Mutation to Frozen Inference:** The frozen 3-horizon LightGBM bundle SHA-256 remains bit-for-bit identical to baseline.

---

### 2. The 7-Point Final Publication Gate

Immediately before publication, KYNTRA evaluates the candidate recommendation against the latest arriving telemetry, race control, and energy state:

| Check # | Name | Verification Logic | Failsafe Outcome |
|---|---|---|---|
| **1** | **Battle Identity Check** | Validates attacker (`NOR`), defender (`VER`), session key, and lap number continuity. | If driver pair or session changes, call is `INVALIDATED` (`BATTLE_STATE_CHANGED`). |
| **2** | **Temporal Coherence Check** | Computes cross-stream timestamp skew between telemetry, race control, and decision time against budget (`max_cross_stream_skew_s: 1.50s`). | If skew exceeds budget or timestamps corrupt, call is `WITHHELD` (`TEMPORAL_COHERENCE_UNRESOLVED`). |
| **3** | **Freshness Budget Check** | Evaluates age of battle state, race control, energy state, and matrix snapshot against YAML budgets. | If battle state age exceeds `battle_state_budget_s: 2.50s`, call is `EXPIRED` (`STALE_DATA_TIMEOUT`). |
| **4** | **Immediate Race-Control Recheck** | Re-evaluates sporting/technical legality. Neutralization (VSC, SC, Yellow, Red) prohibits `OVERTAKE`. Rule `UNKNOWN` prohibits `OVERTAKE`. | VSC/SC immediately transitions call to `BLOCKED` (`RULE_STATE_CHANGED`). Rule uncertainty transitions to `WITHHELD`. |
| **5** | **Immediate Energy Feasibility Recheck** | Checks energy telemetry availability and verifies that active deployment demand (`OVERTAKE` / `DEPLOY`) has sufficient reserve (> 0.05 MJ). | If telemetry unavailable or reserve depleted, call is `WITHHELD` (`ENERGY_FEASIBILITY_LOST`). |
| **6** | **Critical Input Availability Check** | Verifies required kinematic features (e.g., `gap_seconds`) are present and not missing/corrupted. | If critical inputs disappear, call is `WITHHELD` (`CRITICAL_INPUT_UNAVAILABLE`). |
| **7** | **Model & Config Integrity Check** | Verifies that the model bundle SHA-256 matches the frozen SHA-256 (`a368b02...`). | If hash mismatch, publication is immediately `BLOCKED` (`MODEL_HASH_MISMATCH`). |

---

### 3. Versioned Publication Configuration

Created [`configs/decision_publication_v1.yaml`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/configs/decision_publication_v1.yaml) (Version `1.0.0`):

```yaml
version: "1.0.0"
freshness_budgets:
  battle_state_seconds: 2.50
  race_control_seconds: 1.50
  energy_state_seconds: 3.00
  model_features_seconds: 3.00
  matrix_snapshot_seconds: 4.00

call_lifecycle:
  call_validity_budget_seconds: 6.00
  aging_threshold_fraction: 0.70

temporal_coherence:
  max_cross_stream_skew_seconds: 1.50
```

Every budget item is explicitly labeled as `CONFIG_ASSUMPTION` with complete operational rationale. On boot, `load_publication_config()` computes the SHA-256 hash of the configuration for runtime provenance stamping.

---

### 4. Canonical Call Lifecycle State Machine

```
                  ┌──────────────────────┐
                  │ PENDING_FINAL_GATE   │ (Candidate recommendation from Ranking)
                  └──────────┬───────────┘
                             │
               Evaluate Final Publication Gate
                             │
     ┌───────────────┬───────┴────────┬───────────────┐
     │ Fail Rules    │ Fail Checks    │ Stale         │ All 7 Checks Pass
     ▼               ▼                ▼               ▼
┌─────────┐    ┌───────────┐    ┌─────────┐    ┌─────────────┐
│ BLOCKED │    │ WITHHELD  │    │ EXPIRED │    │    VALID    │ (Call published to pit wall)
└─────────┘    └───────────┘    └─────────┘    └──────┬──────┘
                                                      │ Time > 70% validity budget
                                                      ▼
                                               ┌─────────────┐
                                               │    AGING    │ (Visual amber indicator)
                                               └──────┬──────┘
                                                      │ Time > 100% validity budget
                                                      ▼
                                               ┌─────────────┐
                                               │   EXPIRED   │ (Visual gray indicator)
                                               └─────────────┘
                                                      │ (Or track neutralization occurs)
                                                      ▼
                                               ┌─────────────┐
                                               │ INVALIDATED │ (Immediate cancel on VSC/SC)
                                               └─────────────┘
```

#### Exact UI Call Labels:
All published calls map deterministically from backend actions to concise tactical pit-wall calls:
- `CONSERVE` → **`SAVE ENERGY`**
- `BUILD` → **`PREPARE`**
- `DEPLOY` → **`APPLY PRESSURE`**
- `OVERTAKE` → **`OVERTAKE NOW`**

---

### 5. DecisionSnapshot Forensic Immutability

The system maintains an append-only `DecisionStore` (`src/kyntra/decision/store.py`). Every decision snapshot recorded is immutable:
- Attempting to overwrite an existing `decision_id` raises a `ValueError`.
- Each snapshot captures the full 28+ forensic audit parameters:
  - Unique IDs: `decision_id`, `snapshot_id`, `battle_id`, `call_id`.
  - Timestamps: `event_time`, `received_time`, `decision_time`, `published_at`, `valid_until`.
  - Frozen Model State: Model name, version, SHA-256, raw P1/P2/P3, PAV-projected P1/P2/P3.
  - Energy State: Observed/simulated available energy, scenario, consumption profile.
  - Stability V1 Evidence: Verdict (`HIGH_RISK` / `CAUTION` / `UNKNOWN`), rule IDs, metric consensus.
  - FIA Regulation State: Track status, rule results, rule bundle version.
  - Counterfactual Matrix: All 4 action outcomes evaluated from the same state.
  - 6-Tier Lexicographic Trace: Exclusion stages, selected action, tiebreaker logs.
  - Final Gate Audit: Comprehensive check results for all 7 gate stages.
  - Replay Provenance: `is_reanalysis` flag, `source_mode`.

---

### 6. Historical Replay vs Reanalysis

| Operational Mode | Provenance Semantics | Call Behavior |
|---|---|---|
| **HISTORICAL REPLAY** | Loads stored immutable `DecisionSnapshot` directly from history. Shows exactly what KYNTRA believed at that historical timestamp. | `is_reanalysis = False`. Preserves original call ID, timestamps, and recommendation. |
| **REANALYSIS** | Evaluates a historical state with new/current model or policy rules. | `is_reanalysis = True`. Recorded with new `decision_id` and explicitly labeled as counterfactual reanalysis. |

---

### 7. REST Endpoints & WebSocket Events

#### REST Endpoints:
1. `GET /api/strategy/call/current`: Returns the currently active `VALID` or `AGING` call. Returns `404` with detail if no active call.
2. `GET /api/strategy/call/status`: Returns current call lifecycle state, time remaining, and staleness metrics.
3. `GET /api/strategy/call/history/{battle_id}`: Returns complete chronological call lifecycle history.
4. `GET /api/decision/{decision_id}`: Returns the immutable `DecisionSnapshot` for deep forensic audit.
5. `POST /api/strategy/publish/evaluate`: Manually triggers gate evaluation for a candidate recommendation.

#### WebSocket Event Types (`src/kyntra/publication/events.py`):
1. `strategy.matrix.updated`
2. `strategy.candidate.updated`
3. `strategy.gate.evaluated`
4. `strategy.call.published`
5. `strategy.call.aging`
6. `strategy.call.expired`
7. `strategy.call.invalidated`
8. `strategy.call.blocked`
9. `strategy.call.withheld`
10. `decision.snapshot.created`

---

### 8. Adversarial Test Coverage Verification

All 6 required adversarial edge cases were rigorously implemented and verified in `tests/test_final_publication_gate.py`:

- **Case 1: OVERTAKE Candidate Arrives Exactly as VSC Deployed**  
  *Result:* Immediate `BLOCKED` with `OVERTAKE_PROHIBITED_UNDER_NEUTRALIZATION`. Never reaches strategist pit wall.
- **Case 2: Telemetry Delay Exceeds Freshness Budget**  
  *Result:* Immediate `EXPIRED` with `STALE_DATA_TIMEOUT`. Never published.
- **Case 3: APPLY PRESSURE Candidate But Energy Telemetry Unavailable**  
  *Result:* Immediate `WITHHELD` with `ENERGY_TELEMETRY_UNAVAILABLE`. Defensive fallback enforced.
- **Case 4: SAVE ENERGY Candidate When Track Status Clear**  
  *Result:* Correctly approved and published as `SAVE ENERGY` (`VALID`). Neutral actions publish safely.
- **Case 5: Call Stale; Subsequent State Restores Validity**  
  *Result:* Prior call transitions to `EXPIRED`; fresh subsequent evaluation passes gate and publishes a new `VALID` call with a new unique `call_id`.
- **Case 6: Historical Replay vs Reanalysis Tagging**  
  *Result:* Replay preserves historical snapshot; reanalysis creates distinct record with `is_reanalysis = True`.

---

### 9. Latency Benchmark Summary

100-iteration end-to-end benchmark of `compute_decision(..., enable_publication_gate=True)`:
- **Median Latency:** **33.01 ms**
- **95th Percentile (p95):** **44.72 ms**
- **99th Percentile (p99):** **61.33 ms**

The entire spine executes well within the 100ms real-time pit-wall SLA.

---

### 10. Verification Verdict

- **Frozen LightGBM SHA-256:** `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (CONFIRMED UNCHANGED)
- **Pytest Suite:** 237 / 237 PASSED (100% green)
- **Frontend Production Build:** Clean build in 714ms
- **Final Safety Gate:** Fully operational, fail-closed, and audit-logged

**PASS — KYNTRA FINAL PUBLICATION GATE LOCKED**
