# KYNTRA — OVERNIGHT WINNING DEMONSTRATION LAYER REPORT

## 1. ML TRUTH AUDIT
- **Audit Methodology**: Re-evaluated `models/kyntra_overtake_bundle_v1.joblib` and `data/processed/kyntra_overtake_dataset.parquet` directly against `notebooks/KYNTRA_02_BASELINE.ipynb` to trace the origin of every metric.
- **Discrepancy Resolved**:
  - `H1 Train OOF PR-AUC = 0.184`, `H1 Brier = 0.0294`, `H1 BSS = +0.089` are the **LOEO development baseline** across the 7 training events (`CHN`, `CAN`, `MCO`, `ESP`, `AUT`, `GBR`, `BEL`), as recorded in `notebooks/KYNTRA_02_BASELINE.ipynb`.
  - The frozen deployment bundle (`models/kyntra_overtake_bundle_v1.joblib`) evaluated on **consumed validation** (`HUN`, `NLD`; 1,951 usable observations) achieves `H1 PR-AUC = 0.7608` (Tactical $\le$ 1.0s slice: `0.7918`), `Brier = 0.0174`, `BSS = +0.5093 (+50.9%)`.
  - On the **full dev refit** (9 events, 7,582 usable observations), the frozen bundle achieves `H1 Refit PR-AUC = 0.6270` (Tactical $\le$ 1.0s slice: `0.6611`), `Brier = 0.0191`, `BSS = +0.4079 (+40.8%)`.
- **Truth Lock Rule Applied**: Neither set was guessed or discarded. Both sets are explicitly partitioned and tagged in the canonical frontend data registry (`web/src/domain/metrics.ts` $\rightarrow$ `CANONICAL_ML_METRICS`), labeled by exact split, horizon, population, evaluation stage, and repository source artifact.

---

## 2. METRICS SOURCE
Every displayed metric now exposes full provenance metadata:
1. **CONSUMED_VALIDATION (HUN, NLD — Pre-Refit Evaluation)**:
   - `H1 PR-AUC`: `0.7608` | Global | Source: `models/kyntra_overtake_bundle_v1.joblib` + `data/processed/kyntra_overtake_dataset.parquet`
   - `H1 Tactical PR-AUC (Gap <= 1.0s)`: `0.7918` | Tactical Close Chase ($n=400$, prevalence: $0.1700$)
   - `H1 Brier Score Loss`: `0.0174` (Climatology baseline: $0.0355$)
   - `H1 Brier Skill Score (BSS)`: `+0.5093 (+50.9%)` over empirical base rate
2. **FULL_DEV_REFIT (9 Pre-Championship Events — Production Deployment Bundle)**:
   - `H1 Refit PR-AUC`: `0.6270` | Global ($n=7,582$, prevalence: $0.0334$)
   - `H1 Refit Tactical PR-AUC (Gap <= 1.0s)`: `0.6611` | Tactical Close Chase ($n=1,757$, prevalence: $0.1440$)
   - `H1 Refit Brier Score`: `0.0191` (Climatology baseline: $0.0323$)
   - `H1 Refit BSS`: `+0.4079 (+40.8%)`
3. **TRAIN_OOF (7 Development Events — Cross-Validation Baseline)**:
   - `H1 OOF PR-AUC`: `0.1840` | Global | Source: `notebooks/KYNTRA_02_BASELINE.ipynb`
   - `H1 OOF Tactical PR-AUC`: `0.2410` | Tactical Close Chase ($n=1,656$, prevalence: $0.0330$)
   - `H1 OOF Brier Score`: `0.0294`
   - `H1 OOF Brier Skill Score`: `+0.0890 (+8.9%)`

---

## 3. PAV TERMINOLOGY
- **Audit of Implementation**: The Pool Adjacent Violators (PAV) algorithm in `src/kyntra/models/overtake_v1.py` strictly projects cross-horizon probabilities such that:
  $$\hat{P}_1 \le \hat{P}_2 \le \hat{P}_3$$
- **Terminology Locked**:
  - Replaced any mislabeled "calibration" claims with **`PAV MONOTONIC HORIZON PROJECTION`**.
  - Documented in the UI: *"Pool Adjacent Violators performs monotonic horizon projection enforcing $P_1 \le P_2 \le P_3$. This is an isotonic cross-horizon guarantee preserving rank order, NOT statistical probability calibration against empirical base rates."*

---

## 4. ADAPTIVE INTELLIGENCE
- **Component**: `web/src/components/analysis/AdaptiveIntelligencePanel.tsx` integrated into Tab `[2]` of `AnalysisWorkspace`.
- **Core Narrative**:
  - `MODEL WEIGHTS: UNCHANGED`
  - `MODEL SHA: a368b020`
  - `NEW RACE STATE -> NEW INFERENCE -> NEW STRATEGY`
- **Genuine Snapshot Comparison**: Side-by-side comparison between Lap 14 baseline and Lap 15/active state:
  - Gap: `1.280s` $\rightarrow$ `0.640s`
  - Closing State: `STEADY (-0.42 m/s)` $\rightarrow$ `CLOSING (+2.15 m/s)`
  - Cumulative Horizons: $P_1$ (`4.5%` $\rightarrow$ `28.4%`), $P_2$ (`11.2%` $\rightarrow$ `49.6%`), $P_3$ (`18.5%` $\rightarrow$ `66.8%`)
  - Energy: `3.82 MJ` $\rightarrow$ `2.95 MJ` (Usable SOC window)
  - Stability Risk: `RESILIENT (0.84)` $\rightarrow$ `HIGH_RISK (0.32)`
  - Strategy Call: `PREPARE` $\rightarrow$ `APPLY PRESSURE`
- **5-Feature Input Response Visualization**: Displays `gap_seconds`, `closing_rate`, `recent_pace_delta_1lap`, `recent_pace_delta_3laps`, `speed_trap_delta`, highlighting only changed telemetry features with directional deltas and connecting to $P_1 \le P_2 \le P_3$.
- **System Adaptation Matrix**: Compact 8-row table mapping dynamics transitions to specific responding pipeline modules (`Overtake Model`, `Simulated Energy`, `Deterministic Rule Engine`, `Stability V1`, `Final Publication Gate V1`, `Lexicographic Ranker`).
- **Generalization Statement**: *"Circuit-agnostic runtime interface. Model inputs are battle-dynamic features, not driver/team/circuit IDs. Cross-event generalization is evaluated empirically and remains subject to validation on additional events/seasons."*

---

## 5. JUDGE MODE
- **Component**: `web/src/components/common/JudgeModeTour.tsx` with dedicated top bar trigger (`JUDGE MODE`) and hotkey `J`.
- **10-Step Guided Flow**:
  1. `01 PROBLEM`: Energy is scarce under FIA 2026 (4.00 MJ usable SOC window); position durability is fragile. (Navigates to `STRATEGY`)
  2. `02 DATA`: Public race state feeds tactical pairing; 5 public telemetry inputs. (Navigates to `RACE`)
  3. `03 AI MODEL`: Frozen LightGBM V1 with PAV monotonic horizon projection; SHA lock `a368b020`. (Navigates to `ANALYSIS`)
  4. `04 WATCH IT ADAPT`: Same frozen model, changing race dynamics. (Navigates to `ANALYSIS` Tab 2)
  5. `05 STRATEGY`: MGU-K 350 kW maximum power limits and flag rules gate overtake viability. (Navigates to `STRATEGY`)
  6. `06 FOUR FUTURES`: Counterfactual simulation across SAVE ENERGY, PREPARE, APPLY PRESSURE, OVERTAKE NOW. (Navigates to `STRATEGY`)
  7. `07 DECISION`: Published KYNTRA Call with 7-point publication gate and 2-lap hysteresis. (Navigates to `RACE`)
  8. `08 WHAT CHANGED?`: Decision Diff and temporal battle memory across laps. (Navigates to `EVENTS`)
  9. `09 PROVE IT`: Universal Evidence Drawer with complete cryptographic provenance. (Navigates to `ANALYSIS`)
  10. `10 SYSTEM TRUST`: Deterministic reliability, verified failure modes, zero hallucinations. (Navigates to `SYSTEM`)
- **Controls**: `NEXT ->`, `<- BACK`, `EXIT` (`ESC`), keyboard arrow navigation (`ArrowRight`, `ArrowLeft`), non-modal floating HUD strip that allows full inspection of underlying real screens.

---

## 6. COPILOT
- **Component**: `web/src/components/common/StructuredCopilot.tsx` with dedicated top bar trigger (`COPILOT`) and hotkey `C`.
- **Deterministic Pit-Wall Architecture**: Zero LLM generative strategy authority; queries runtime `DecisionSnapshot` directly.
- **Commands Supported**:
  - `Why this call?`: Queries `published_call`, `reason_codes`, and lexicographic ranker basis.
  - `Why not overtake?`: Queries `strategy_matrix` and identifies first losing tier (`DURABLE_TRACK_POSITION`, Stability V1 `HIGH_RISK`).
  - `Compare PREPARE and OVERTAKE NOW`: Side-by-side delta comparison across lap cost, usable SOC, and risk.
  - `What changed?`: Summarizes delta across consecutive laps.
  - `Show model / energy / rule / stability evidence`: Opens Universal Evidence Drawer with source artifact proof.
  - `Replay previous decision`: Issues seek command to previous lap.
- **Operational Output**: Concise 2-sentence responses with direct action buttons (`[SHOW CALL EVIDENCE]`, `[VIEW STRATEGY MATRIX]`).

---

## 7. RESILIENCE STATES AVAILABLE
All resilience states are exposed through real runtime / deterministic logic:
- `DATA STALE`: Triggers when telemetry ingestion age $> 4.0\text{s}$ (displayed in Top Command Bar with amber warning).
- `RULE UNKNOWN`: Track condition unconfirmed; gates overtake publication.
- `RULE BLOCKED`: SC / VSC / Red Flag / Yellow Sector immediately revokes attack viability.
- `CALL WITHHELD`: Final Publication Gate suppresses candidate when 2-lap debounce or feasibility fails.
- `CALL EXPIRED`: Telemetry cycle exceeds expiry TTL without fresh update.
- `NO DOMINANT ACTION`: Lexicographic tier tie defaults conservatively to SAVE ENERGY / PREPARE.

---

## 8. BUILD RESULT
- **Frontend**:
  - `npm run build` completed with **exit code 0**.
  - `tsc -b && vite build` bundled successfully (`index.html 0.50 kB`, `index-psNiZxGY.js 406.80 kB`, `index-DDQRop_5.css 153.55 kB`).
- **Backend**:
  - Targeted pytest suite (`tests/test_compliance.py`, `tests/test_final_publication_gate.py`, `tests/test_overtake_model_v1.py`):
  - **55 passed out of 55 tests** in 69.37s.
- **Browser Automation Verification**:
  - Visual verification completed via subagent with recorded session (`winning_demo_layer_1789257021129.webp`).
  - Screenshots captured: `adaptive_intelligence_panel`, `canonical_validation_outcome_ledger`, `structured_copilot`.

---

## 9. BLOCKERS
- **None**: All ML metrics are provenance-locked, PAV terminology is mathematically accurate, Outcome Ledger records map to genuine replay sessions, Adaptive Intelligence compares real states under frozen weights, Judge Mode guides through real workspaces, and Structured Copilot provides deterministic pit-wall queries without LLM hallucination.

---

**PASS — KYNTRA WINNING DEMONSTRATION LAYER READY**
