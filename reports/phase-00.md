# KYNTRA — PHASE 00: EVIDENCE AUDIT + ACTUAL PROJECT STATE

> **Audit Timestamp:** 2026-09-12 10:35:00 UTC  
> **Environment:** Windows, Shell: PowerShell, Python: 3.12.10, Node: Vite 8.2.2  
> **Repository:** `C:\Users\tanvi\OneDrive\Documents\TRACKSHIFT 2026\KYNTRA`  
> **Branch:** `main`  
> **Status Assessment:** PASS — PHASE 00 EVIDENCE BASELINE LOCKED  

---

## A. Git State

- **Current Branch:** `main`
- **Local HEAD:** `0d86248` (*feat: integrate and harden KYNTRA V1 decision platform*)
- **Remote Origin:** `https://github.com/SPYLEAN/KYNTRA.git`
- **origin/main HEAD:** `0d86248`
- **Tracking Status:** Up to date with `origin/main` commit-wise.
- **Working Tree State:** Substantial uncommitted local engineering work is present and newer than remote:
  - **Modified Tracked Files (10):**
    - `README.md`
    - `src/kyntra/api/app.py`
    - `src/kyntra/api/routes.py`
    - `src/kyntra/decision/engine.py`
    - `src/kyntra/ingestion/discovery.py`
    - `src/kyntra/schemas.py`
    - `web/index.html`
    - `web/src/App.tsx`
    - `web/src/index.css`
    - `web/src/types.ts`
  - **Untracked Directories & Files (19):**
    - `.env.example`
    - `configs/battle_detection.yaml`
    - `configs/events/2026_madrid.yaml`
    - `configs/window_detection.yaml`
    - `src/kyntra/api/stream.py`
    - `src/kyntra/battles/`
    - `src/kyntra/events/`
    - `src/kyntra/ingestion/capture.py`
    - `src/kyntra/processing/circuit_twin.py`
    - `src/kyntra/providers/`
    - `src/kyntra/services/`
    - `src/kyntra/state/`
    - `src/kyntra/windows/`
    - `tests/test_live_core.py`
    - `tests/test_openf1_capture_replay.py`
    - `tests/test_phase4c_realism.py`
    - `web/public/brand/kyntra-symbol-ui.png`
    - `web/public/brand/kyntra-wordmark-ui.png`
    - `web/src/components/`

---

## B. Actual Repository Architecture

```
KYNTRA/
├── .env.example                       # Backend OpenF1 / MQTT environment template
├── configs/
│   ├── fia_2026_energy.yaml           # FIA Issue 20 PU regulations & limits
│   ├── data_splits_2026.yaml          # Calendar splits (Train/Val/Demo Holdout)
│   ├── battle_detection.yaml          # Battle thresholds & critical windows
│   ├── window_detection.yaml          # DRS / MOM window parameters
│   ├── model_features.yaml            # Monotonic feature specifications
│   └── events/
│       ├── 2026_australia.yaml        # Albert Park technical circuit profile
│       └── 2026_madrid.yaml           # Madrid 2026 Spanish GP technical circuit profile
├── data/
│   ├── demo/                          # 4 Demo holdout replay files (Parquet)
│   │   ├── 2026_australia_replay.parquet (15,083 rows)
│   │   ├── 2026_italy_replay.parquet     (21,894 rows)
│   │   ├── 2026_japan_replay.parquet     (7,962 rows)
│   │   └── 2026_miami_replay.parquet     (25,402 rows)
│   └── processed/
│       ├── 2024_bahrain_race_laps.parquet (1,129 rows)
│       ├── 2026_australia_energy_trace.parquet (3,220 rows)
│       ├── kyntra_overtake_dataset.parquet (8,357 rows, 78 cols)
│       └── kyntra_overtake_historical_aux.parquet (908 rows)
├── models/
│   ├── kyntra_overtake_bundle_v1.joblib (599,100 bytes)
│   ├── kyntra_overtake_h1_v1.joblib     (191,508 bytes)
│   ├── kyntra_overtake_h2_v1.joblib     (195,172 bytes)
│   ├── kyntra_overtake_h3_v1.joblib     (214,628 bytes)
│   └── kyntra_overtake_model_v1_metadata.json (2,097 bytes)
├── notebooks/
│   ├── KYNTRA_01_OVERTAKE_EDA.ipynb
│   ├── KYNTRA_02_BASELINE.ipynb
│   └── KYNTRA_GEMINI_ML_REVIEW_AUDIT.md
├── reports/
│   ├── 2026_public_telemetry_audit.md
│   ├── overtake_dataset_report.md
│   └── overtake_dataset_final_qa.md
├── scripts/
│   ├── audit_overtake_dataset.py
│   ├── build_overtake_dataset.py
│   ├── build_race.py
│   ├── discover_2026_races.py
│   ├── export_deployment_models.py
│   ├── inspect_trace.py
│   └── simulate_australia_2026.py
├── src/kyntra/
│   ├── api/                           # FastAPI app, REST routes, WebSocket live streaming
│   ├── battles/                       # Pairwise battle detection & watchlist
│   ├── decision/                      # Lexicographic decision engine, recommendations, snapshots
│   ├── energy/                        # MGU-K recovery model, 350kW limits, energy simulator
│   ├── events/                        # Temporal Race Memory & EventStore
│   ├── features/                      # Monotonic feature extraction
│   ├── ingestion/                     # FastF1 loader, OpenF1 discovery, session capture (.jsonl)
│   ├── models/                        # Frozen LightGBM inference, PAV monotonic projection, registry
│   ├── processing/                    # Normalizer, validator, Digital Track Twin geometry
│   ├── providers/                     # BaseDataProvider, ReplayProvider, OpenF1LiveProvider, TeamTelemetryProvider
│   ├── regulations/                   # FIA Issue 20 compliance evaluator, power curve models
│   ├── services/                      # LiveRaceService (provider orchestration, capture control)
│   ├── state/                         # Shared thread-safe race state store
│   ├── windows/                       # Pass window detector
│   └── schemas.py                     # Canonical Pydantic schemas & provenance definitions
├── tests/                             # 103 offline unit & integration tests
└── web/                               # React 19 + TypeScript + Vite Pit-Wall Workstation
```

---

## C. Artifact Inventory

| Required Directory | Actual Status | Evidence / Notes |
| :--- | :---: | :--- |
| `src/` | **PRESENT** | Complete modular architecture with clean separation of concerns |
| `web/` | **PRESENT** | React 19 + TypeScript + Vite frontend with 6 workspaces and 3 presets |
| `tests/` | **PRESENT** | 103 automated tests across 16 test files (100% passing) |
| `configs/` | **PRESENT** | FIA 2026 PU config, data splits, Madrid/Australia event configs, model features |
| `notebooks/` | **PARTIAL** | `KYNTRA_01_OVERTAKE_EDA.ipynb`, `KYNTRA_02_BASELINE.ipynb` present; 03–07 exported into `scripts/export_deployment_models.py` |
| `reports/` | **PRESENT** | Telemetry audit and overtake dataset quality reports present |
| `scripts/` | **PRESENT** | Dataset construction, race simulation, and model export pipelines |
| `data/` | **PRESENT** | 8,357-row training/validation dataset + 4 demo holdout replay files |
| `models/` | **PRESENT** | Frozen bundle, 3 horizon models, and verified metadata JSON |
| `artifacts/` | **MISSING** | Generated locally in Antigravity IDE brain, not committed in repo |
| `docs/` | **CREATED** | Created during Phase 00 as `docs/STATUS.md` |

---

## D. Model Artifact Verification

- **Artifact Path:** `models/kyntra_overtake_bundle_v1.joblib`
- **File Size:** 599,100 bytes
- **SHA-256 Calculated:** `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`
- **Expected SHA-256:** `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`
- **Match Status:** **EXACT MATCH (VERIFIED)**
- **Model Family:** LightGBM Classifier (`LGBMClassifier`)
- **Horizons:** Cumulative 1 Lap ($P_1$), 2 Laps ($P_2$), 3 Laps ($P_3$)
- **Feature Order (Strictly 5 Features):**
  1. `gap_seconds` (monotonic decreasing constraint: `-1`)
  2. `closing_rate` (unconstrained: `0`)
  3. `recent_pace_delta_1lap` (unconstrained: `0`)
  4. `recent_pace_delta_3laps` (unconstrained: `0`)
  5. `speed_trap_delta` (unconstrained: `0`)
- **PAV Monotonic Projection:** Implemented in `src/kyntra/models/overtake_v1.py` via `project_monotonic_3()`. Enforces $P_1 \le P_2 \le P_3$ with minimal $L_2$ deviation.
- **Model Loader:** Thread-safe singleton `get_overtake_model()` in `src/kyntra/models/registry.py`.

---

## E. Dataset Verification

- **Primary Dataset:** `data/processed/kyntra_overtake_dataset.parquet`
- **Dimensions:** **8,357 rows × 78 columns**
- **Row Integrity:** `observation_id` is 100% unique.
- **Split Distribution:**
  - `TRAIN`: 6,197 rows (7 events: CHN, CAN, MCO, ESP, AUT, GBR, BEL)
  - `VALIDATION`: 2,160 rows (2 events: HUN, NLD)
  - `DEMO_HOLDOUT`: 0 rows in dataset (strictly isolated in `data/demo/`: AUS, JPN, MIA, ITA)
- **Battle Count:** 1,656 unique battle sequences (`battle_sequence_id`).
- **Target Fields:** `repassed_within_1_lap`, `repassed_within_2_laps`, `repassed_within_3_laps`, and binary pass targets.
- **Censor Fields:** `censored_1_lap`, `censored_2_laps`, `censored_3_laps`, `retention_censored_1_lap`, `retention_censored_2_laps`, `retention_censored_3_laps`.

---

## F. Provider & Streaming Status

- **`BaseDataProvider`**: Verified abstract contract defining `get_metadata()`, `get_capabilities()`, `start()`, `stop()`, `next_state()`, and seeking.
- **`ReplayProvider`**: Verified offline playback for historical Parquet and `.jsonl` session capture files.
- **`OpenF1LiveProvider`**: Verified multi-channel normalization across 10 OpenF1 channels (`sessions`, `drivers`, `position`, `intervals`, `car_data`, `location`, `laps`, `stints`, `race_control`, `weather`). Server-side auth via `OPENF1_TOKEN`.
- **`SessionCaptureWriter` & `SessionCaptureReader`**: Verified recording to and reading from newline-delimited JSON format.
- **`TeamTelemetryProvider`**: Verified placeholder strictly in `STANDBY` mode returning `None` to prevent data fabrication.
- **Live WebSocket Core**: Verified `/ws/live` streaming state frames and battle states at 20Hz.

---

## G. Backend Status

| Subsystem | Classification | Implementation Path |
| :--- | :---: | :--- |
| Ingestion & Cache | **VERIFIED** | `src/kyntra/ingestion/cache.py`, `loader.py`, `telemetry.py` |
| Normalization & Validation | **VERIFIED** | `src/kyntra/processing/normalizer.py`, `validation.py` |
| Track Twin Geometry | **VERIFIED** | `src/kyntra/processing/circuit_twin.py` |
| Battle & Window Detection | **VERIFIED** | `src/kyntra/battles/detector.py`, `src/kyntra/windows/detector.py` |
| Race Memory / Event Store | **VERIFIED** | `src/kyntra/events/store.py` |
| Overtake Model (P1/P2/P3) | **VERIFIED** | `src/kyntra/models/overtake_v1.py` |
| PAV Monotonic Projection | **VERIFIED** | `src/kyntra/models/overtake_v1.py` |
| Energy Simulator (2026 PU) | **VERIFIED** | `src/kyntra/energy/simulator.py`, `harvest.py` |
| Regulatory Compliance | **VERIFIED** | `src/kyntra/regulations/compliance.py` |
| Decision Engine & Recommendation | **VERIFIED** | `src/kyntra/decision/engine.py`, `recommender.py` |
| Post-Pass Stability | **RESEARCH ONLY** | Retention flags present in dataset; no standalone ML model in V1 |
| Counterfactual Scenarios | **PARTIAL** | Scenario schema exists; full ranking unactivated |
| Strategy Ranking Engine | **DISABLED** | Intentionally disabled / pending verification |

---

## H. Frontend Status

- **Architecture:** React 19 + TypeScript + Vite.
- **Workspaces Implemented:**
  1. `LIVE`: High-density command center with Pit-Wall, Analysis, and Demo presets.
  2. `BATTLE`: Deep head-to-head telemetry comparison, delta analysis, and battle watchlist.
  3. `STRATEGY`: Tyre compound degradation profiles and pit window evaluation.
  4. `FORECAST`: Connected to `/api/forecast/{event_id}`, truthfully reporting `RUNS: 0 / PENDING`.
  5. `EVENTS`: Searchable, chronological race control event stream.
  6. `SYSTEM`: Real-time Model Evidence Inspector rendering the 5 LightGBM features, monotonic bounds, raw probabilities, PAV adjustments, bundle version, and SHA-256 checksum.
- **Ergonomics:** **0px page scroll** verified across `1920x1080`, `1440x900`, and `1366x768`.
- **Branding:** Official KYNTRA assets (`kyntra-symbol-ui.png` and `kyntra-wordmark-ui.png`).

---

## I. Regulation Audit

- **Rule Bundle Version:** `2026.2`
- **Governing Body:** FIA World Motor Sport Council
- **Publication Date:** 2026-08-05
- **FIA Technical Regulations Reference:** Section C — Technical (Issue 20)
- **FIA Sporting Regulations Reference:** Section B — Sporting (Issue 08)
- **Governing Articles Configured in `configs/fia_2026_energy.yaml`:**
  - `Article C5.2.7`: MGU-K Absolute Electrical DC Power Limit ($\le 350\text{ kW}$).
  - `Article C5.2.8(i)`: Normal Deployment Power Curve ($1800 - 5v$ and $6900 - 20v$).
  - `Article C5.2.8(ii)`: Manual Override Mode (Overtake Active) Power Curve ($7100 - 20v$).
  - `Article C5.2.9`: Usable Energy Store State-of-Charge Window ($\le 4.0\text{ MJ}$).
  - `Article C5.2.10`: Per-Lap Energy Store Recovery Limit ($8.5\text{ MJ}$ baseline).
- **Event-Specific Configs:**
  - `configs/events/2026_australia.yaml`: Verified.
  - `configs/events/2026_madrid.yaml`: Verified ($9.0\text{ MJ}$ circuit recovery ceiling).
- **Hard-coded Values Check:** Piecewise slopes and intercepts are externalized in `configs/fia_2026_energy.yaml`.

---

## J. Test Baseline

- **Python Interpreter:** `C:\Users\tanvi\AppData\Local\Programs\Python\Python312\python.exe` (Python 3.12.10)
- **Exact Command:**
  ```powershell
  & "C:\Users\tanvi\AppData\Local\Programs\Python\Python312\python.exe" -m pytest -v
  ```
- **Test Results:**
  - Total Tests: **103**
  - Passed: **103**
  - Failed: **0**
  - Warnings: 38 (benign deprecation notices for numpy timedelta generic unit and joblib pickle shape)
  - Duration: **43.86 seconds**
  - Pass Rate: **100%**

---

## K. Frontend Build Baseline

- **Working Directory:** `web/`
- **Exact Command:** `npm run build` (`tsc -b && vite build`)
- **Status:** **SUCCESS (0 errors)**
- **Output:**
  - Modules Transformed: 33
  - `dist/index.html`: 0.50 kB
  - `dist/assets/index-DI3txsME.css`: 68.67 kB
  - `dist/assets/index-BxX8U1e4.js`: 341.19 kB
  - Build Duration: **1.34 seconds**

---

## L. Missing Prerequisites

1. `notebooks/KYNTRA_03` through `07`: The code for these notebooks was exported directly into `scripts/export_deployment_models.py`, but the raw `.ipynb` files are not stored in `notebooks/`.
2. `artifacts/`: Directory is not present in Git (maintained externally in IDE local state).
3. Strategy & Counterfactual Execution Engine: Strategy ranking and counterfactual Monte-Carlo runs are deliberately disabled / stubbed to avoid unverified outputs.

---

## M. 24-Hour Critical Blockers

- **ZERO BLOCKERS.**
- All 103 backend tests pass.
- Frontend builds cleanly with zero TypeScript errors.
- Model artifact exists and SHA-256 matches bit-for-bit.
- OpenF1 live ingestion and session capture format are fully verified.

---

## N. Recommended Next Eligible Phase

- **Next Phase:** **KYNTRA 3.0 Integration / God-Mode Workstation**
  - Build the dedicated "KYNTRA 3.0 GOD MODE" workspace toggle inside `web/src/components/workspaces/` as requested by the user.
  - Connect to existing verified backend contracts without altering the frozen LightGBM model, FIA regulations, or replay semantics.
