# KYNTRA — OPEN-SOURCE ACCELERATION PASS
## PHASE 01.6: REFERENCE INGESTION & REUSE MAP

**Date**: 2026-09-13  
**Status**: COMPLETE & VERIFIED  
**Phase**: Phase 01.6 (Architecture Reference & Ingestion Analysis)  
**Report Location**: `reports/open-source-acceleration-map.md`  
**Reference Directory**: `_reference/` (configured in `.gitignore`, non-committed)

---

## 1. EXECUTIVE SUMMARY

Phase 01.6 conducts an exhaustive architectural reference pass over 7 premier open-source motorsport intelligence, telemetry, and simulation repositories. 

**Strict Non-Regression Contract**:
- **Zero Production Modifications**: No changes were made to the KYNTRA decision engine, ranking logic, publication gate, frozen LightGBM model, or running workstation UI.
- **Zero Dilution of Core IP**: KYNTRA's unique differentiators (P1/P2/P3 overtake horizons, PAV calibration, regulation-constrained Energy Horizon, Stability V1, 4-action counterfactuals, lexicographic ranking, 7-point atomic publication gate, and DecisionSnapshot/Ledger provenance) remain strictly proprietary.
- **Strategic Acceleration**: Extracted 15 high-value patterns across streaming, replay, circuit representation, logging, health, and configuration that save an estimated **160–210 engineering hours** across future phases without rebuilding solved infrastructure.

---

## 2. COMPREHENSIVE LICENSE AUDIT MATRIX

| Repository | Primary Author / Org | Declared License | Classification | Notice / Attribution Requirement | Trademark / Asset Restrictions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F1-StratLab** | Víctor Vega Sobral | **Apache-2.0** | `SAFE_TO_ADAPT` / `SAFE_TO_REUSE_WITH_NOTICE` | Include Apache 2.0 copy; state modification notices; retain author copyright. | DO NOT copy team logos, F1 branding, or radio audio clips. |
| **apex-iq** | Anubhab Pradhan | **MIT** | `SAFE_TO_ADAPT` / `SAFE_TO_REUSE_WITH_NOTICE` | Include original MIT copyright notice in adapted files. | DO NOT copy team livery assets or F1 marks. |
| **pitwall_intel** | Phantom074 | **MIT** | `SAFE_TO_ADAPT` / `SAFE_TO_REUSE_WITH_NOTICE` | Include original MIT copyright notice in adapted files. | **CRITICAL**: Contains copyrighted `assets/f1_logo.png`. DO NOT COPY ANY ASSETS. |
| **race-simulation** | TUMFTM (TU Munich) | **GNU LGPL v3** | `SAFE_TO_REFERENCE` | Algorithmic/architectural reference only. DO NOT copy source into KYNTRA. | Academic attribution if algorithms cited. |
| **racetrack-database** | TUMFTM (TU Munich) | **GNU LGPL v3** | `SAFE_TO_REFERENCE` | Track coordinate schemas & geometry concepts only. DO NOT copy code or raw datasets directly. | Academic attribution if datasets cited. |
| **f1-telemetry-dashboard** | geeksam33r | **MIT** (declared in README) | `SAFE_TO_ADAPT` | Retain MIT attribution if WebSocket reconnection utilities adapted. | DO NOT copy SVG telemetry badges. |
| **F1-Dashboard** | capccode | **None (Default Copyright)** | `SAFE_TO_REFERENCE` / `DO_NOT_COPY` | Reference interactive scrubber interaction patterns only. DO NOT copy source. | None. |

### Legal & Compliance Directives:
1. **LGPL v3 Isolation**: Both `race-simulation` and `racetrack-database` are licensed under GNU LGPL v3. To prevent any risk of copyleft contagion to KYNTRA's proprietary core, no source files from these repositories will be copied or embedded. Only data schemas, coordinate mathematics, and parameter topologies are studied and re-implemented natively.
2. **Unlicensed Code Quarantine**: `F1-Dashboard` lacks an explicit license file, making it proprietary to the author under GitHub terms. It is strictly designated `SAFE_TO_REFERENCE / DO_NOT_COPY`.
3. **Trademark Quarantine**: All 7 repositories contain references or assets relating to Formula 1®, FIA®, and constructor teams. KYNTRA strictly generates its own clean, neutral tactical tokens, circuits, and UI styling.

---

## 3. TOP 15 REUSABLE PATTERNS FOR KYNTRA

### Pattern 1: Unified Replay & Live Stream Contract (`lap_state` / `RuntimeSnapshot`)
- **Reference Repo**: `F1-StratLab` (`src/simulation/replay_engine.py`, `src/simulation/race_state_manager.py`)
- **License**: Apache-2.0 (`SAFE_TO_ADAPT`)
- **Problem Solved**: Eliminates divergence between live and historical replay modes. Downstream decision modules should not know whether state originates from a live WebSocket or a parquet replay file.
- **Pattern**: `RaceReplayEngine` yields a strictly validated canonical dictionary contract (`lap_state`) identically formatted to the live telemetry stream.
- **KYNTRA Target**: `kyntra.orchestration.runtime_orchestrator`, `web/src/domain/mappers.ts`, `RuntimeProvider`.
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 18–24 hours
- **Risks**: None. Enforces KYNTRA's Phase 01 truth contract.

### Pattern 2: API Timing & Structured Logging Middleware
- **Reference Repo**: `apex-iq` (`backend/middleware/__init__.py`)
- **License**: MIT (`SAFE_TO_ADAPT`)
- **Problem Solved**: Standardizes request ID tracking, microsecond execution benchmarking, slow-query warnings, and response headers (`X-Request-ID`, `X-Response-Time`).
- **Pattern**: `APITimingMiddleware` intercepts requests, records `time.perf_counter()`, attaches correlation IDs, and logs structured JSON with `duration_ms` thresholds (>1000ms warning).
- **KYNTRA Target**: `kyntra.api.app` (FastAPI middleware pipeline).
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 8–12 hours
- **Risks**: Low. Must ensure timing overhead is negligible (<0.05ms).

### Pattern 3: Dual-Timer Connection Health & Stale-State Protection
- **Reference Repo**: `F1-StratLab` (`src/pitwall/ui/src/lib/useConnection.ts`, `trackStatus.ts`)
- **License**: Apache-2.0 (`SAFE_TO_ADAPT`)
- **Problem Solved**: High-frequency tick loops freeze when an upstream producer dies, leaving operators looking at stale telemetry thinking it is live.
- **Pattern**: Decouples the live data tick (100ms) from a dedicated connection heartbeat poll (1000ms). When connection freezes, the UI immediately strips the visual "weight" (fills/glows) from status chips, preventing a frozen state from reading as an active green or active safety car.
- **KYNTRA Target**: `web/src/components/shell/TopCommandBar.tsx`, `web/src/domain/types.ts` (`FreshnessState`).
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 12–16 hours
- **Risks**: Low. Prevents false positive status reporting during session disconnects.

### Pattern 4: Parameter-Hierarchy Config Philosophy (Deterministic vs Stochastic)
- **Reference Repo**: `race-simulation` (`racesim/src/import_pars.py`, `check_pars.py`)
- **License**: GNU LGPL v3 (`SAFE_TO_REFERENCE`)
- **Problem Solved**: Ad-hoc simulation parameters scatter constants across code.
- **Pattern**: Strict hierarchical separation into typed config blocks: `RACE_PARS`, `TRACK_PARS`, `CAR_PARS`, `TIRESET_PARS`, `MONTE_CARLO_PARS`. Rigid validation validates parameter existence and type compatibility before starting simulation batches.
- **KYNTRA Target**: `configs/fia_2026_energy.yaml`, `kyntra.simulation.scenario_runner`.
- **Reuse Mode**: `REFERENCE` (Re-implement in Pydantic / YAML)
- **Effort Saved**: 14–18 hours
- **Risks**: Zero LGPL risk by building fresh Pydantic schemas.

### Pattern 5: Generic Track Representation (Centerline + Width Boundaries)
- **Reference Repo**: `racetrack-database` (`tracks/*.csv`, `racelines/*.csv`)
- **License**: GNU LGPL v3 (`SAFE_TO_REFERENCE`)
- **Problem Solved**: Hardcoded circuit SVG paths prevent scaling KYNTRA to other Grands Prix.
- **Pattern**: 4-tuple coordinate structure: `(x_m, y_m, w_tr_right_m, w_tr_left_m)` representing metric track centerline and left/right physical track limits, plus independent raceline vectors `(x_m, y_m)`.
- **KYNTRA Target**: `web/src/components/DigitalTrackTwin.tsx`, future `CircuitPack` loader.
- **Reuse Mode**: `REFERENCE`
- **Effort Saved**: 16–22 hours
- **Risks**: Metric-to-SVG normalization required for responsive 2D canvas viewports.

### Pattern 6: Model Metadata Envelope & Serialization Architecture
- **Reference Repo**: `pitwall_intel` (`utils/model_trainer.py`, `models/model_meta.pkl`)
- **License**: MIT (`SAFE_TO_ADAPT`)
- **Problem Solved**: Model weights become detached from feature columns, training timestamp, evaluation metrics, and preprocessing encoders.
- **Pattern**: Encapsulates model weights alongside a structured `model_meta` envelope containing exact feature column names in order, baseline metrics (MAE, podium accuracy), and target specifications.
- **KYNTRA Target**: `src/kyntra/models/`, `models/overtake_p123_v1.lgb` metadata loader.
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 8–10 hours
- **Risks**: Low. Protects against feature misalignment during inference.

### Pattern 7: Graceful Telemetry Fallback with Synthetic Rate Limiting
- **Reference Repo**: `f1-telemetry-dashboard` (`README.md`, server design)
- **License**: MIT (`SAFE_TO_ADAPT`)
- **Problem Solved**: FastF1 or OpenF1 API rate limits (HTTP 429) during live polling crash ingestion pipelines.
- **Pattern**: Ingestion layer implements local file caching (`fastf1.Cache.enable_cache`), exponential backoff on HTTP 429, and seamless fallback to captured-live telemetry files without crashing consumers.
- **KYNTRA Target**: `src/kyntra/ingestion/cache.py`, `src/kyntra/ingestion/openf1_client.py`.
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 10–14 hours
- **Risks**: Low. Ensures server resilience during real race sessions.

### Pattern 8: Track Status State Machine (FIA Flags & Neutralization)
- **Reference Repo**: `F1-StratLab` (`src/pitwall/ui/src/lib/trackStatus.ts`, `neutralised.ts`)
- **License**: Apache-2.0 (`SAFE_TO_ADAPT`)
- **Problem Solved**: Inconsistent track condition representations across workspaces.
- **Pattern**: Dedicated pure function `trackStatusTreatment` mapping `(label, colour, frozen)` into explicit rendering types (`unknown`, `outline`, `filled`). `GREEN` is rendered as an outline chip to avoid visual competition; `SAFETY CAR`, `VSC`, or `RED FLAG` are rendered with solid fills.
- **KYNTRA Target**: `web/src/components/shell/TopCommandBar.tsx`, `web/src/components/race/TimingTower.tsx`.
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 8–10 hours
- **Risks**: None. Enhances mission-control clarity.

### Pattern 9: Time & Lap Scrubber Scrub-State Coordination
- **Reference Repo**: `F1-Dashboard` (`F1Dash.py`)
- **License**: Default Copyright (`SAFE_TO_REFERENCE`)
- **Problem Solved**: Interactive session replay scrubbing without desynchronizing timeline charts.
- **Pattern**: Slider component updates session lap index, dynamically constraining downstream graph time domains and invalidating cache keys outside the active window.
- **KYNTRA Target**: `web/src/components/race/DecisionTimelineStrip.tsx`, future Replay Scrubber.
- **Reuse Mode**: `REFERENCE` (Build fresh React slider using HTML5 Range / custom SVG scrubber)
- **Effort Saved**: 10–12 hours
- **Risks**: None. Clean implementation in React without Dash dependencies.

### Pattern 10: Multi-Scenario Monte Carlo Convergence & Robustness
- **Reference Repo**: `race-simulation` (`racesim/src/mcs_analysis.py`)
- **License**: GNU LGPL v3 (`SAFE_TO_REFERENCE`)
- **Problem Solved**: Evaluating how sensitive a strategic decision is to lap-time perturbations and safety car timing.
- **Pattern**: Vectorized Monte Carlo batch analysis that aggregates variance across seed runs and outputs empirical confidence intervals.
- **KYNTRA Target**: `kyntra.simulation.scenario_robustness`, `web/src/components/race/WhyWhyNotPanel.tsx`.
- **Reuse Mode**: `REFERENCE`
- **Effort Saved**: 16–20 hours
- **Risks**: Must remain bounded to <200ms latency for live operator workstation usage.

### Pattern 11: Modular Service / FastAPI Sub-Router Architecture
- **Reference Repo**: `apex-iq` (`backend/main.py`, `backend/app/api/v2/`)
- **License**: MIT (`SAFE_TO_ADAPT`)
- **Problem Solved**: Bloated monolithic FastAPI route files.
- **Pattern**: Modular division into discrete routers (`dashboard`, `simulations`, `intelligence`, `system`) with centralized dependency injection (`deps.py`) and CORS origin resolution.
- **KYNTRA Target**: `kyntra.api.routes` (modularizing `app.py`).
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 6–8 hours
- **Risks**: None. Standard FastAPI practice.

### Pattern 12: Micro-Timeline Decision Event Representation
- **Reference Repo**: `F1-StratLab` (`src/pitwall/agents_view/timeline.py`)
- **License**: Apache-2.0 (`SAFE_TO_ADAPT`)
- **Problem Solved**: Displaying historical recommendations and their outcomes chronologically in tight UI spaces.
- **Pattern**: Compact horizontal bar with glyph markers for decisions, lap events, and status shifts, with hover inspection for forensic parameters.
- **KYNTRA Target**: `web/src/components/race/DecisionTimelineStrip.tsx`.
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 10–14 hours
- **Risks**: Low. Clean 100vh fit.

### Pattern 13: Tire Compound & Degradation Curve Parameterization
- **Reference Repo**: `race-simulation` (`helper_funcs/src/calc_tire_degradation.py`)
- **License**: GNU LGPL v3 (`SAFE_TO_REFERENCE`)
- **Problem Solved**: Empirical modeling of compound drop-off across laps.
- **Pattern**: Non-linear degradation curve parameterized by base grip, linear wear slope, and thermal cliff inflection points.
- **KYNTRA Target**: `kyntra.simulation.tire_model`, future Energy & Tire joint horizon.
- **Reuse Mode**: `REFERENCE`
- **Effort Saved**: 12–16 hours
- **Risks**: Model must respect 2026 technical regulations.

### Pattern 14: Operator Desk Density & Multi-Window Synchronization
- **Reference Repo**: `F1-StratLab` (`src/pitwall/ui/src/styles/tokens.css`, `qt-base.css`)
- **License**: Apache-2.0 (`SAFE_TO_ADAPT`)
- **Problem Solved**: Strategy workstations operating on multi-monitor setups without CSS theme drift.
- **Pattern**: Strict design tokens defining high-density tabular typography, shared base colors (`palette.py`), and CSS variable scoping across sub-windows.
- **KYNTRA Target**: `web/src/styles/tokens.css`, `web/src/index.css`.
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 8–10 hours
- **Risks**: None. Validated in Phase 01.5.

### Pattern 15: FastF1 Preprocessing & Data Extraction Pipeline
- **Reference Repo**: `pitwall_intel` (`utils/data_pipeline.py`, `utils/fastf1_pipeline.py`)
- **License**: MIT (`SAFE_TO_ADAPT`)
- **Problem Solved**: Efficiently loading, cleaning, and extracting session telemetry, sector times, and weather metrics from FastF1 with local parquet caching.
- **Pattern**: Staged pipeline with batch ingestion, missing value imputation, and clean parquet export.
- **KYNTRA Target**: `scripts/build_race.py`, `src/kyntra/ingestion/session_loader.py`.
- **Reuse Mode**: `ADAPT`
- **Effort Saved**: 10–12 hours
- **Risks**: None. Streamlines session ingestion.

---

## 4. WHAT NOT TO COPY (STRICT EXCLUSION LIST)

The following architectures, patterns, and assets found across the reference repositories are **STRICTLY REJECTED** and must never be introduced into KYNTRA:

1. **Multi-Agent LLM Strategy Debates (F1-StratLab)**:
   - *Why Rejected*: KYNTRA is an algorithmic, deterministic racecraft intelligence engine running on frozen LightGBM models, PAV monotonic projections, and strict FIA 2026 regulation constraints. Non-deterministic LLMs hallucinating strategy decisions violate safety and race-engineering integrity.
2. **Generic AI Engineer Confidence Scores (apex-iq)**:
   - *Why Rejected*: Generic confidence scores (`Attack: 84%`, `Pit: 62%`) lack mathematical grounding and regulatory clearance. KYNTRA relies strictly on calibrated P1/P2/P3 probability horizons and lexicographic counterfactual evaluation.
3. **Hardcoded Dash/Plotly Python UIs (F1-Dashboard, apex-iq)**:
   - *Why Rejected*: Monolithic Python GUI frameworks cannot achieve the sub-10ms response times, 100vh workstation constraints, and custom design language of KYNTRA's React/Vite front end.
4. **LGPL v3 Code Directly in Source Tree (race-simulation, racetrack-database)**:
   - *Why Rejected*: Copying LGPL v3 source code directly into KYNTRA creates intellectual property risks. Only data concepts, coordinate math, and schemas may be referenced.
5. **Trademarked / Copyrighted Assets**:
   - *Why Rejected*: All F1 logos, team logos, and proprietary fonts must be barred from the KYNTRA repository.

---

## 5. FILES & MODULES TO INSPECT DURING FUTURE PHASES

| Future Phase | Primary KYNTRA Goal | Reference Repository & Specific Files to Inspect | Expected Pattern to Adapt |
| :--- | :--- | :--- | :--- |
| **Phase 02** | Live Data Streaming & Reconnect | `F1-StratLab`: `src/pitwall/stream_client.py`<br>`apex-iq`: `backend/middleware/__init__.py`<br>`f1-telemetry-dashboard`: `client/app.js` | Dual-timer connection monitor, API request timing, reconnection backoff. |
| **Phase 03** | Digital Track Twin & Multi-Circuit | `racetrack-database`: `tracks/*.csv`, `racelines/*.csv`<br>`F1-StratLab`: `src/pitwall/ui/src/features/data/TrackMap.tsx` | Centerline + track width geometry schema, SVG coordinate normalization. |
| **Phase 04** | Simulation Scenarios & Monte Carlo | `race-simulation`: `racesim/src/import_pars.py`, `mcs_analysis.py`<br>`race-simulation`: `helper_funcs/src/calc_tire_degradation.py` | Typed parameter config blocks, stochastic perturbation matrices. |
| **Phase 05** | Replay Scrubber & Event History | `F1-StratLab`: `src/simulation/replay_engine.py`<br>`F1-Dashboard`: `F1Dash.py` (slider/lap scrubbing) | Deterministic lap replay iterator, scrub state dispatching. |
| **Phase 06** | Explainability & Model Metadata | `pitwall_intel`: `utils/model_trainer.py` (`model_meta.pkl`)<br>`F1-StratLab`: `src/pitwall/agents_view/decision.py` | Model envelope metadata, per-feature prediction breakdown. |
| **Phase 07** | Ingestion Cache & Offline Hardening | `pitwall_intel`: `utils/data_pipeline.py`<br>`f1-telemetry-dashboard`: rate-limiting & fallback logic | FastF1 parquet batching, API error resilience. |
| **Phase 08** | System Diagnostics & Operational Audit | `apex-iq`: `backend/api/mission_control.py`<br>`F1-StratLab`: `src/pitwall/ui/src/lib/useConnection.ts` | Detailed component health probes, latency jitter detection. |

---

## 6. COMPACT REUSE BACKLOG

```
+----------------------------------------------------------------------------------------------------+
|                                    KYNTRA REUSE BACKLOG                                            |
+-------------------+---------------------------------------------------------+----------------------+
| PRIORITY          | PATTERN & TARGET                                        | INTEGRATION RISK     |
+-------------------+---------------------------------------------------------+----------------------+
| NOW (Phases 02-04)| 1. API Timing & Request ID Middleware (apex-iq)         | VERY LOW (FastAPI)   |
|                   | 2. Dual-Timer Stale-State Protection (F1-StratLab)      | LOW (React hooks)    |
|                   | 3. FIA Track Status Chip State Machine (F1-StratLab)    | LOW (Pure TS helper) |
|                   | 4. Model Metadata Serialization Envelope (pitwall_intel)| LOW (Pickle/Joblib)  |
|                   | 5. Metric Centerline Track Representation (TUMFTM)      | MEDIUM (SVG math)    |
+-------------------+---------------------------------------------------------+----------------------+
| LATER (Phases 5-7)| 6. Deterministic Replay Engine Iterator (F1-StratLab)   | LOW (Python runner)  |
|                   | 7. Parameter-File Hierarchy Configuration (TUMFTM)      | LOW (Pydantic/YAML)  |
|                   | 8. Session Telemetry Parquet Extraction (pitwall_intel) | LOW (FastF1 wrapper) |
|                   | 9. Micro-Timeline Event Visualizer (F1-StratLab)        | MEDIUM (React UI)    |
|                   | 10. API Rate-Limit & Backoff Provider (f1-dashboard)    | LOW (HTTP client)    |
+-------------------+---------------------------------------------------------+----------------------+
| FUTURE (Phase 08+)| 11. Multi-Circuit Digital Twin Pack (TUMFTM)            | MEDIUM (Asset pack)  |
|                   | 12. Non-linear Tire Degradation Curve Model (TUMFTM)    | MEDIUM (Physics eng) |
|                   | 13. Monte Carlo Variance Decomposition (TUMFTM)         | MEDIUM (Compute load)|
|                   | 14. Service-Worker Offline Telemetry Cache (apex-iq)    | HIGH (Browser SW)    |
|                   | 15. Real-Time Telemetry Scrubber Stream (F1Dash)        | MEDIUM (React state) |
+-------------------+---------------------------------------------------------+----------------------+
```

---

## 7. ESTIMATED IMPLEMENTATION SAVINGS

- **Data Streaming & Connection Management**: ~35 hours
- **Track Geometry & Multi-Circuit Representation**: ~38 hours
- **Simulation Config & Parameter Architecture**: ~32 hours
- **Model Metadata & Preprocessing Extraction**: ~22 hours
- **Replay State Coordination & Scrubber**: ~24 hours
- **Structured Logging & Diagnostics Middleware**: ~16 hours
- **Track Status & Flag Visual State Machine**: ~14 hours
- **Total Estimated Engineering Hours Saved**: **181 hours** (~4–5 engineering sprints).

---

## 8. CONCLUSION & NEXT STEPS

Phase 01.6 has systematically cataloged verified open-source solutions across all 15 technical requirements without modifying KYNTRA's core decision engine or taking on legal/licensing liability.

- The reference directory `_reference/` is isolated and excluded via `.gitignore`.
- All future phases have a clear blueprint of specific files to inspect.
- Do NOT proceed to Phase 02 until instructed.
