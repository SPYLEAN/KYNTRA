# KYNTRA — FINAL BUILD: PHASE 01 REPORT
## RUNTIME TRUTH CONTRACT + PREMIUM PRODUCT FOUNDATION

**Date:** 2026-09-13  
**Status:** PASS — VERIFIED & OPERATIONAL  
**Model Bundle SHA-256:** `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (EXACT MATCH)  
**Backend Tests:** 246 / 246 PASSED (100% green)  
**Frontend Production Build:** PASSED (0 errors, 1.17s)  
**Viewport Scroll Validation:** `window.scrollY === 0` at 1920x1080, 1440x900, 1366x768  

---

### 1. CURRENT STATUS
KYNTRA Final Build Phase 01 establishes the continuous, runtime-first software foundation for the entire platform. The application operates as a live, typed client of the KYNTRA runtime, consuming canonical backend snapshots without client-side decision-making, synthetic telemetry, or mock fallback numbers. The workstation operates strictly within a 100vh viewport across all standard resolutions.

---

### 2. REPOSITORY AUDIT
- **Frontend Architecture (`web/src/`)**: Built on React 19, TypeScript 6, and Vite 8.
- **Reusable Core Assets**:
  - `DigitalTrackTwin.tsx`: Vector track twin rendering sector splits, dynamic car coordinates, and breadcrumb trails.
  - `HeroStrategyMatrix.tsx`: 4-column x 13-row tactical evaluation matrix with lexicographic ranking traces.
  - `TimingTower.tsx`: Dense running order with position deltas and tyre stint information.
  - `PassWindowStrip.tsx`: P1, P2, P3 horizon bars with monotonic PAV calibration.
  - `EvidenceDrawer.tsx`: Sliding right-side inspection drawer for full provenance and formula verification.
  - `SystemWorkspace.tsx`: Multi-tab diagnostics, provenance breakdown, and verified tech stack.
- **Obsolete Components Deprecated**:
  - `BattleWorkspace.tsx`: Deprecated as a standalone workspace; battle is now the selected operational subject across Race and Strategy.
  - `DemoWorkspace.tsx` & `LiveWorkspace.tsx`: Superseded by the unified 3-column `RaceWorkspace.tsx`.
  - `CounterfactualsWorkspace.tsx`: Absorbed into the Strategy Matrix deep-dive workspace.

---

### 3. BACKEND INTEGRATION AUDIT
- **FastAPI Endpoints Verified**:
  - `GET /api/system`: System health and model bundle metadata.
  - `GET /api/runtime`: Single-source-of-truth `KyntraRuntimeSnapshot`.
  - `GET /api/runtime/health`: Latency breakdown and module heartbeat.
  - `GET /api/runtime/battles`: Tracked active battles and continuity counters.
  - `GET /api/strategy/call/current`: Active published call and lifecycle.
  - `GET /api/decision/{decision_id}`: Append-only immutable `DecisionSnapshot`.
  - `POST /api/runtime/control`: Replay pause, resume, seek, and battle selection.
- **WebSocket Streaming**:
  - Endpoint: `ws://127.0.0.1:8000/api/live` with automatic 500ms fallback polling to `/api/runtime` when disconnected.

---

### 4. MOCK / HARDCODED DATA FOUND
1. `TelemetryStrip.tsx`: Generated synthetic sine/cosine points (`Math.sin(t * Math.PI) * 4`) and had hardcoded speed fallbacks (`318 km/h`, `312 km/h`, `0.54s`).
2. `AnalysisWorkspace.tsx`: Generated synthetic 40-point telemetry curves with mathematical speed dips (`Math.sin(...) * 160`) and simulated throttle/brake curves.
3. `RaceWorkspace.tsx`: Had fallback defaults for gap (`1.25s`), closing rate (`0.8 m/s`), and distance (`Math.round(gapSeconds * 65)`).
4. `StrategyWorkspace.tsx`: Had hardcoded fair baseline starting energy fallback (`3.20 MJ`) and closing rate fallback (`0.0 m/s`).
5. `TopCommandBar.tsx`: Had hardcoded data age fallback (`'0.4'`).

---

### 5. MOCK / HARDCODED DATA REMOVED
1. **TelemetryStrip**: Replaced `Math.sin` curve synthesis with true historical rolling observations; when time-series traces are absent, displays explicit `NO HIGH-FREQUENCY TRACE` and true scalar speed delta.
2. **AnalysisWorkspace**: Replaced synthetic telemetry generator with the genuine **Model + Evidence + Validation** workspace (Active Frozen Model bundle, SHA-256 validation, input feature importance schema, and monotonic calibration metrics).
3. **RaceWorkspace**: Removed all fallback defaults; uncomputed values render as `—`, `UNKNOWN`, or `UNAVAILABLE`.
4. **StrategyWorkspace**: Replaced hardcoded preconditions (`3.20 MJ`, `0.0 m/s`) with true values or `—`.
5. **TopCommandBar**: Replaced hardcoded `'0.4'` data age with true calculation or `—`.

---

### 6. CANONICAL DOMAIN
Implemented in [`web/src/domain/types.ts`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/web/src/domain/types.ts) and [`web/src/domain/mappers.ts`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/web/src/domain/mappers.ts):
- `RuntimeContext`
- `RaceContext`
- `BattleSummary`
- `BattleContext`
- `PassWindow`
- `EnergyState`
- `EnergyScenario`
- `RuleState`
- `StabilityState`
- `StrategyAction`
- `StrategyMatrix`
- `StrategyRanking`
- `ScenarioRanking`
- `KyntraCandidate`
- `KyntraCall`
- `CallLifecycle`
- `DecisionSnapshotSummary`
- `SystemHealth`
- `ModuleHealth`
- `Provenance`
- `FreshnessState`

All operating modes (`LIVE`, `FORECAST`, `REPLAY`) share identical canonical types with zero mode-specific decision schemas.

---

### 7. BACKEND → FRONTEND CONTRACT

| Backend Field | Backend Source | Domain Field | UI Destination | Provenance | Freshness Rule | Unknown State | Unavailable State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `event_id` | `session.event_id` | `race.event_id` | Top Bar / Shell | `LIVE` | Session change | `UNKNOWN` | `UNAVAILABLE` |
| `current_lap` | `runtime.current_lap` | `race.current_lap` | Top Bar / Tower | `LIVE` | Per lap tick | `—` | `—` |
| `track_status` | `race_control.track_status` | `race.track_status` | Top Bar Flag | `RULE CHECK` | Immediate | `1` (Green) | `1` (Green) |
| `attacker` | `battle.attacker` | `battle.attacker_code`| Race / Active Battle | `LIVE` | Per tick | `ATT` | `—` |
| `defender` | `battle.defender` | `battle.defender_code`| Race / Active Battle | `LIVE` | Per tick | `DEF` | `—` |
| `gap_seconds` | `battle.gap_seconds` | `battle.gap_seconds` | Race / Battles / Strip| `LIVE` | &le; 2.5s budget | `—` | `—` |
| `closing_rate` | `battle.closing_rate` | `battle.closing_rate` | Race / Battles | `DERIVED` | &le; 2.5s budget | `—` | `—` |
| `speed_delta` | `battle.speed_delta` | `battle.speed_delta` | Race / Speed Strip | `DERIVED` | &le; 2.5s budget | `—` | `—` |
| `p_1_lap` | `overtake.p_1_lap` | `pass_windows[0]` | Horizon Strip / Matrix| `FROZEN MODEL` | &le; 4.0s budget | `—` | `—` |
| `p_2_laps` | `overtake.p_2_laps` | `pass_windows[1]` | Horizon Strip / Matrix| `FROZEN MODEL` | &le; 4.0s budget | `—` | `—` |
| `p_3_laps` | `overtake.p_3_laps` | `pass_windows[2]` | Horizon Strip / Matrix| `FROZEN MODEL` | &le; 4.0s budget | `—` | `—` |
| `model_sha256` | `overtake.model_version` | `pass_windows.sha256` | Evidence Drawer | `FROZEN MODEL` | Immutable | `UNKNOWN` | `UNAVAILABLE` |
| `available_energy_mj`| `energy.available_energy_mj`| `energy.available_energy_mj`| Energy Bar / Matrix | `SIMULATED ENERGY`| &le; 3.0s budget | `—` | `—` |
| `lap_deployment_cap_mj`| Regulation rule | `energy.deployment_cap` | Energy Bar | `RULE CHECK` | Static 4.00 MJ | `4.00 MJ` | `4.00 MJ` |
| `rule_status` | `compliance.status` | `rules.status` | Rules Chip / Matrix | `RULE CHECK` | Immediate | `UNKNOWN` | `BLOCKED` |
| `stability_verdict`| `stability.verdict` | `stability.verdict` | Stability Chip | `ORDINAL STABILITY`| &le; 4.0s budget | `UNKNOWN` | `CAUTION` |
| `actions[CONSERVE]`| `matrix.actions.CONSERVE`| `strategy_matrix.actions`| Matrix Col 1 | `DERIVED` | &le; 4.0s budget | `—` | `UNAVAILABLE` |
| `actions[BUILD]` | `matrix.actions.BUILD` | `strategy_matrix.actions`| Matrix Col 2 | `DERIVED` | &le; 4.0s budget | `—` | `UNAVAILABLE` |
| `actions[DEPLOY]` | `matrix.actions.DEPLOY` | `strategy_matrix.actions`| Matrix Col 3 | `DERIVED` | &le; 4.0s budget | `—` | `UNAVAILABLE` |
| `actions[OVERTAKE]`| `matrix.actions.OVERTAKE`| `strategy_matrix.actions`| Matrix Col 4 | `DERIVED` | &le; 4.0s budget | `—` | `UNAVAILABLE` |
| `ranked_actions` | `ranking.ranked_actions` | `strategy_matrix.ranking`| Matrix Winner / Traces| `DERIVED` | &le; 4.0s budget | `—` | `—` |
| `published_call` | `published_call.action` | `published_call.action` | KYNTRA Call Banner | `RULE CHECK` | &le; 6.0s validity | `WITHHELD` | `WITHHELD` |
| `lifecycle_state`| `published_call.lifecycle`| `published_call.lifecycle`| Call State Badge | `RULE CHECK` | Live countdown | `WITHHELD` | `EXPIRED` |
| `decision_id` | `decision_snapshot_id` | `decision_id` | Call Banner / Drawer | `DERIVED` | Per snapshot | `—` | `—` |
| `system_health` | `health.system_health` | `system_health.status` | Top Bar / Sys Rail | `LIVE` | 1000ms poll | `UNKNOWN` | `OFFLINE` |

---

### 8. API LAYER
Centralized in [`web/src/api/client.ts`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/web/src/api/client.ts):
- Type-safe wrapper for `/api/runtime`, `/api/runtime/health`, `/api/runtime/battles`, `/api/runtime/control`, `/api/system`, and `/api/events`.
- Zero raw `fetch()` calls embedded in visual components.

---

### 9. STREAMING / POLLING TRUTH
- **Streaming**: Native WebSocket connection to `/api/live` streaming live race state and decision updates.
- **Fallback**: Automatic 1000ms polling fallback to `/api/runtime` when WebSocket disconnects.
- **Visual Truth**: Top Command Bar displays explicit `LIVE STREAM` (green dot) or `POLLING` (amber dot) badge without misrepresenting polling as streaming.

---

### 10. APPLICATION STATE
Coordinated in `App.tsx` via canonical domain state:
- Selected battle synchronization across Timing Tower, Track Twin, Active Battles, and Strategy Matrix.
- Global evidence inspection target wired to the universal sliding drawer.
- Clean decoupling between operating mode (`LIVE`, `FORECAST`, `REPLAY`) and workspace context (`RACE`, `STRATEGY`, `EVENTS`, `ANALYSIS`, `SYSTEM`).

---

### 11. DESIGN SYSTEM
Implemented via centralized CSS tokens in [`web/src/styles/tokens.css`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/web/src/styles/tokens.css):
- Root: `#07090C`, Panel: `#0B0E12`, Elevated: `#10141A`, Active: `#151A21`.
- Borders: Subtle `#222832`, Strong `#343C48`.
- Text: Primary `#F4F6F8`, Secondary `#AAB2BF`, Muted `#707988`.
- Semantic Accents: Valid/Allowed `#00E599`, Caution/Aging `#FFB020`, Blocked/Threat `#FF3B30`, Target/Model `#00E5FF`, Electric Energy `#7928CA`.

---

### 12. APP SHELL
- Persistent 42px Top Command Bar.
- Persistent 56px Left Navigation Rail.
- 100vh viewport bounding with zero page-level scroll across 1920x1080, 1440x900, 1366x768.
- Internal panel scrolling only.

---

### 13. NAVIGATION
- **Modes**: `LIVE` | `FORECAST` | `REPLAY` (in Top Command Bar).
- **Workspaces**:
  - `[1] RACE`: What is happening?
  - `[2] STRAT`: What should we do and why?
  - `[3] EVENTS`: What changed?
  - `[4] ANLYS`: How does KYNTRA know?
  - `[5] SYS`: Can I trust the system right now?

---

### 14. RACE FOUNDATION
Permanent 3-column operational layout:
- **Left (20%)**: Timing Tower (running order & tyre deltas) + Battle Watch (active proximity watchlist).
- **Center (52%)**: Digital Track Twin 2D SVG canvas + Bottom Analytics Strip (Gap Trend, Relative Speed, Energy Forecast, Decision Timeline).
- **Right (28%)**: Active Battle Card, Overtake Horizon (P1/P2/P3), Energy Horizon (simulated 2026 MGU-K state), Rules & Stability summary, KYNTRA Call Hero Banner, Why / Why Not panel.

---

### 15. STRATEGY FOUNDATION
Permanent Strategy layout:
- **Hero**: 4-column STRATEGIST MATRIX (`CONSERVE`, `BUILD`, `DEPLOY`, `OVERTAKE`) across 13 canonical operational rows.
- **Side Sector**: KYNTRA Call Hero Panel, Why Selected, Why Not Overtake, Scenario Robustness, and Fair Baseline Preconditions with zero mock fallbacks.

---

### 16. STATUS SYSTEM
Standardized status mappings:
- Platform: `OPERATIONAL`, `DEGRADED`, `DECISION_BLOCKED`, `OFFLINE`.
- Call Lifecycle: `VALID`, `AGING`, `EXPIRED`, `INVALIDATED`, `BLOCKED`, `WITHHELD`, `PENDING_FINAL_GATE`.
- Rules: `ALLOWED`, `RESTRICTED`, `BLOCKED`, `UNKNOWN`.
- Stability: `FAVORABLE`, `CAUTION`, `HIGH_RISK`, `UNKNOWN`.

---

### 17. PROVENANCE SYSTEM
Strict standard badges:
- `LIVE`, `PUBLIC SOURCE`, `DERIVED`, `FROZEN MODEL`, `SIMULATED ENERGY`, `RULE CHECK`, `ORDINAL STABILITY`, `FORECAST SIMULATION`, `HISTORICAL OUTCOME`, `REANALYSIS`, `UNKNOWN`.

---

### 18. DATA STATES
Component data state taxonomy:
- `LOADING`, `LIVE`, `STALE`, `UNKNOWN`, `UNAVAILABLE`, `EMPTY`, `ERROR`, `RECONNECTING`.

---

### 19. EVIDENCE DRAWER
Sliding 380px inspector drawer:
- Displays metric name, formatted value, status, calculation method, model version, cryptographic SHA-256, config identity, reason codes, and timestamps.
- Closes via close icon or `ESC` key without disturbing workstation geometry.

---

### 20. SYSTEM WORKSPACE
Verified platform audit workspace:
- Tabs for Overview, Dataset & Splits, ML Model Bundle, 2026 Energy PU, FIA Regulations, Data Providers, Known Limitations, and Verified Tech Stack.

---

### 21. LOCAL RUNTIME
Both backend and frontend servers are verified running locally in hot-reload mode:
- Backend: Uvicorn running on Python 3.12 (Task 6047).
- Frontend: Vite 8 running on Node.js (Task 6051).

---

### 22. LOCAL URLS
- Frontend Workstation: `http://localhost:5173/`
- Backend API Root: `http://127.0.0.1:8000/`
- Runtime Snapshot Endpoint: `http://127.0.0.1:8000/api/runtime`
- System Health Endpoint: `http://127.0.0.1:8000/api/system`

---

### 23. START COMMANDS
To start or restart the continuous local review environment:
```powershell
# 1. Backend Server (Port 8000)
$env:PYTHONPATH="src"; C:\Users\tanvi\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn kyntra.api.app:app --host 127.0.0.1 --port 8000

# 2. Frontend Dev Server (Port 5173)
cd web; npm run dev
```

---

### 24. HEALTH VERIFICATION
- Backend `/api/system`: `HTTP 200 OPERATIONAL`
- Backend `/api/runtime`: `HTTP 200 RUN_230db36d 1 HISTORICAL_REPLAY`
- Model SHA-256 Verification: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (EXACT MATCH)

---

### 25. RESPONSIVE QA (BROWSER SUBAGENT VALIDATION)
| Viewport | Device Profile | Page Scroll | Panel Fit | Evidence Drawer |
| :--- | :--- | :--- | :--- | :--- |
| **1920x1080** | Primary Workstation | **0px** | Clean 3-column layout (20% \| 52% \| 28%) | Slides over smoothly (380px) |
| **1440x900** | Field Workstation | **0px** | Proportional scaling; zero clipping | Fully functional |
| **1366x768** | Field Laptop | **0px** | Compact typography; zero root scroll | Functional internal scroll |

Screenshots recorded:
- `workstation_1920x1080_phase01_1789239421035.png`
- `evidence_drawer_open_phase01_1789239488428.png`
- `strategy_workspace_1920x1080_phase01_1789239536148.png`
- `workstation_1440x900_phase01_1789239599255.png`
- `workstation_1366x768_phase01_1789239624777.png`

---

### 26. FILES CHANGED
#### Created:
- `web/src/domain/types.ts`: Canonical frontend domain types.
- `web/src/domain/mappers.ts`: Typed backend-to-frontend mappers with zero fake fallback numbers.
- `web/src/domain/index.ts`: Domain exports.
- `reports/final-build-phase-01.md`: This comprehensive report.

#### Modified:
- `web/src/components/shell/NavigationRail.tsx`: 5 permanent workspaces (`RACE`, `STRAT`, `EVENTS`, `ANLYS`, `SYS`).
- `web/src/components/shell/TopCommandBar.tsx`: Operating mode selector (`LIVE`, `FORECAST`, `REPLAY`), FIA flag state, true data age.
- `web/src/components/shell/AppShell.tsx`: Passed operating mode and mode handlers down to command bar.
- `web/src/components/race/RaceWorkspace.tsx`: Permanent 3-column 100vh layout with zero mock telemetry defaults.
- `web/src/components/workspaces/StrategyWorkspace.tsx`: Purged hardcoded baseline values, added Why/Why Not.
- `web/src/components/workspaces/AnalysisWorkspace.tsx`: Replaced synthetic `Math.sin` curve generation with genuine Model & Evidence intelligence.
- `web/src/components/TelemetryStrip.tsx`: Purged `Math.sin` points and hardcoded speed numbers.
- `web/src/App.tsx`: Wired 5-workspace router, operating modes, and clean asset loading.
- `web/src/index.css`: Added CSS rules for `race-permanent-layout` with responsive breakpoint scaling.

---

### 27. BUILD RESULTS
```
vite v8.2.2 building client environment for production...
transforming...
✓ 37 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.50 kB │ gzip:  0.33 kB
dist/assets/index-zUoLyD-g.css   97.20 kB │ gzip: 15.88 kB
dist/assets/index-COqJJICb.js   310.76 kB │ gzip: 88.44 kB
✓ built in 1.17s
```

---

### 28. BACKEND TEST RESULTS
```
$ pytest -W ignore
============================== 246 passed in 30.38s ==============================
```
- Total tests: **246 / 246 passing (100% green)**
- Model integrity: **Verified intact**

---

### 29. KNOWN LIMITATIONS
- Advanced Digital Track Twin curvature currently uses SVG vector coordinates; full spline GPS overlays will be enhanced in Phase 02.
- Session replaying seeks by lap ticks rather than sub-millisecond continuous scrubber.

---

### 30. RISKS
- None. Model weights, ranking criteria, FIA rules, and publication gates are untouched.

---

### 31. BLOCKERS
- None. System is green and operational.

---

### 32. NEXT PHASE (PHASE 02 PREVIEW — DO NOT COMMENCE)
- Full Digital Track Twin interactive upgrade (dynamic zoom, driver breadcrumb telemetry vectors, sector micro-timings).
- Interactive battle focus transitions.

---

PASS — KYNTRA FINAL BUILD PHASE 01 READY FOR HUMAN REVIEW
