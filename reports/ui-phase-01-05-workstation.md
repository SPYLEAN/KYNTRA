# KYNTRA — UI PHASE 01–05: STRATEGIST WORKSTATION FOUNDATION REPORT
**Date:** 2026-09-12  
**Status:** PASS — KYNTRA STRATEGIST WORKSTATION FOUNDATION READY  
**Backend Tests Passing:** 246 / 246 (100% green)  
**Frontend Production Build:** PASS (0 errors, 2.34s)  
**Frozen Model SHA-256:** `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (VERIFIED MATCH)  

---

## 1. Phase 0: Frontend Audit & Baseline Review

### Pre-Rebuild Component Inspection
Before modifying the UI, an audit of `web/src`, `web/src/components`, and `web/src/types.ts` was conducted:
1. **Existing Strengths Preserved**:
   - `DigitalTrackTwin.tsx`: Robust SVG circuit representation with live vehicle dots, sector lines, and spatial delta visualization. Preserved and integrated into the upper center sector.
   - `PositionTower.tsx`: Dense timing order with position, driver codes, intervals, and tyre markers. Preserved and integrated as the upper left zone.
   - `SessionSwitcher.tsx`: Working modal for switching between demo events (`2026_01_AUS`, `2026_03_JPN`, `2026_04_MIA`, `2026_13_ITA`). Preserved intact.
   - Brand assets: High-resolution official trimmed icons and wordmarks in `public/brand/` (`kyntra-symbol-ui.png`, `kyntra-wordmark-ui.png`). Preserved and deployed without distortion.
2. **Old UI Weaknesses Identified & Replaced**:
   - **Hardcoded Placeholder Text**: `LiveWorkspace.tsx` previously contained static strings stating `"AWAITING STRATEGY ENGINE"` and `"STAB: PENDING"`, ignoring the fact that Phase 07 (Strategist Matrix), Phase 08 (Lexicographic Ranking), and Phase 09 (Final Publication Gate) are active in the backend.
   - **Lack of Canonical Strategist Matrix**: No visual component rendered the 4-action columns (`CONSERVE`, `BUILD`, `DEPLOY`, `OVERTAKE`) or their 13 canonical rows.
   - **No Transparent Ranking Trace**: The 6-tier lexicographic brain's elimination reasons (`lost at: DURABLE TRACK POSITION`, etc.) were not visible to the strategist.
   - **Inconsistent Provenance Badging**: Simulated 2026 energy and frozen model inferences were not consistently tagged with standardized badges.
   - **Ad-Hoc Network Calls**: Raw `fetch()` invocations were scattered across components without a centralized, typed API client layer.

---

## 2. Motorsport Operations Design System

A bespoke operations palette was established in `web/src/styles/tokens.css` and linked to `web/src/index.css`:

```css
:root {
  /* Surfaces */
  --bg-root: #07090C;
  --bg-panel: #0B0E12;
  --bg-elevated: #10141A;
  --bg-active: #151A21;
  --bg-card: #0E1218;

  /* Operational Borders */
  --border-subtle: #222832;
  --border-strong: #343C48;
  --border-accent: #38bdf8;

  /* Typography & Tabular Numerals */
  --text-primary: #F4F6F8;
  --text-secondary: #AAB2BF;
  --text-muted: #707988;

  /* Restrained Functional Accents */
  --accent-model: #38bdf8;       /* cyan / blue: frozen LightGBM */
  --status-valid: #10b981;       /* green: legal / permitted */
  --status-caution: #f59e0b;     /* amber: aging / caution */
  --status-blocked: #ef4444;     /* red: blocked / rule violation */
  --status-neutral: #64748b;     /* gray: unknown / unavailable */
}
```

### Aesthetic & Ergonomic Principles:
- **Zero Page-Level Scrolling**: Strict constraints guarantee that at 1920x1080, 1440x900, and 1366x768, the primary Race Command Center fits entirely within the viewport.
- **No Neon Overload / No SaaS Card Bloat**: Eliminates heavy drop-shadows, bubbly rounded corners, and glowing gradients. Borders are crisp (1px/2px), radii are minimal (1px-2px), and vertical rhythm is tightly packed.
- **Tabular Data Typography**: Monospace numerals (`font-feature-settings: "tnum" 1`) ensure telemetry deltas, lap times, and probabilities do not jitter during high-frequency live updates.

---

## 3. Persistent App Shell & Navigation Architecture

### Persistent Left Navigation Rail (`NavigationRail.tsx`)
- Width: 64px fixed.
- **Top Slot**: Trimmed KYNTRA symbol brand asset.
- **Primary Workspaces**:
  - `RACE [1]`: Real-time pit-wall tactical command center.
  - `STRAT [2]`: Deep-dive strategy matrix and assumption sensitivities.
  - `REPLAY [3]`: Historical playback, scrubber, and timeline markers.
  - `ANLYS [4]`: Technical telemetry analysis and circuit investigation.
  - `SYS [5]`: System diagnostics, module health, and verified Tech Stack panel.
- **Bottom Status Metadata**:
  - `MODE`: `LIVE` / `REPLAY` / `SYNTHETIC`
  - `SOURCE`: `OPENF1` / `REPLAY` / `CAPTURED`
  - `SYSTEM`: `OK` / `DEGR` / `OFF` (clickable to open system health diagnostics)

### Persistent Top Command Bar (`TopCommandBar.tsx`)
- Height: 38px fixed.
- Status string: `KYNTRA / TACTICAL DECISION WORKSTATION | LIVE | EVENT: Monza [2026_13_ITA] | LAP: 5/53 | DATA: 0.4s | FIA: ISSUE_20 | OPERATIONAL`
- **Stream Status Badge**: Explicitly declares `LIVE STREAM` when connected to WebSocket (`WS /api/live`), or switches to `POLLING FALLBACK` with an amber indicator when offline. Never masquerades polling as streaming.
- **Utilities**: Quick session switcher trigger and operational keyboard shortcuts modal (`?`).

---

## 4. Race Command Center Architecture

The default homepage (`currentContext === 'RACE'`) adopts the requested 4-tier desktop layout:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOP COMMAND BAR                                                        │
├──────────────────┬─────────────────────────────┬───────────────────────┤
│ TIMING TOWER     │ TRACK TWIN (CIRCUIT VIEW)   │ ACTIVE BATTLES        │
├──────────────────┴─────────────────────────────┴───────────────────────┤
│ HERO STRATEGIST MATRIX (CONSERVE | BUILD | DEPLOY | OVERTAKE)          │
├───────────────────────────────────┬────────────────────────────────────┤
│ KYNTRA CALL + PASS WINDOW STRIP   │ WHY / WHY NOT + SCENARIO ROBUST    │
├───────────────────────────────────┴────────────────────────────────────┤
│ BOTTOM INTELLIGENCE TABS (TELEMETRY | ENERGY | RULES | HISTORY | SYS)  │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Upper 3-Zone
- **Timing Tower (Left, ~20%)**: Running order displaying positions, driver codes, leader gaps, intervals, and tyre compound/age badges. Attacker and defender in the selected battle are highlighted with distinct colored left borders and dots.
- **Track Twin (Center, ~55%)**: Full-width SVG circuit view with vehicle dots, DRS activation lines, sector splits, and a top tactical focus bar displaying the selected battle pair, gap in seconds, and spatial distance in meters.
- **Active Battles (Right, ~25%)**: Real-time list of all tracked battles from `runtimeSnapshot.active_battles` or `watchlist`. Shows attacker $\rightarrow$ defender, gap, closing trend (`CATCH` vs `STABLE`), continuous active laps counter, and filter pills (`ALL`, `≤3.0s`, `CATCH`). Clicking any row focuses the entire workstation on that battle.

### 2. Hero Strategist Matrix (`HeroStrategyMatrix.tsx`)
Renders the canonical 4 counterfactual actions from the fair baseline:
- **Columns**: `SAVE ENERGY [CONSERVE]`, `PREPARE [BUILD]`, `APPLY PRESSURE [DEPLOY]`, `OVERTAKE NOW [OVERTAKE]`.
- **13 Canonical Evaluation Rows**:
  1. `01. RULE / ELIGIBILITY`: Displays `ALLOWED`, `BLOCKED`, or `UNKNOWN` with article reference.
  2. `02. PASS CONTEXT`: Shows $H1$, $H2$, $H3$ horizon pass probabilities enforced by monotonic PAV.
  3. `03. ENERGY BEFORE`: Attacker starting battery reserve (MJ) labeled `SIM`.
  4. `04. PLANNED DEPLOYMENT`: Expected MGU-K consumption (-MJ).
  5. `05. EXPECTED RECOVERY`: Projected regenerative inflow (+MJ).
  6. `06. TERMINAL ENERGY`: End-of-lap battery buffer (MJ) with caution warnings if below 0.8MJ.
  7. `07. STABILITY`: Post-pass position durability (`FAVORABLE`, `CAUTION`, `HIGH_RISK`, `UNKNOWN`).
  8. `08. FUTURE WINDOW`: Attack quality projected for the subsequent lap (`PEAKING`, `AVERAGE`, `FADING`).
  9. `09. PROJECTED POSITION`: Expected track position through Turn 1.
  10. `10. GAP CONSEQUENCE`: Net temporal gap change ($\Delta s$).
  11. `11. LAP-TIME CONSEQUENCE`: Expected stint lap-time degradation delta.
  12. `12. SCENARIO RESULT`: Outcome across tested battery sensitivity assumptions.
  13. `13. RANK / RESULT`: Winner banner (`★ WINNER`) or transparent elimination trace (`Lost at: REGULATORY ELIGIBILITY`, `Lost at: DURABLE TRACK POSITION`).
- **Zero Fabricated Scores**: No arbitrary weighted numerical scores or synthetic heatmaps.

### 3. Tactical Calling & Rationale
- **KYNTRA Call Hero Panel (`KyntraCallPanel.tsx`)**:
  - Massive unmissable headline typography: `SAVE ENERGY`, `PREPARE`, `APPLY PRESSURE`, `OVERTAKE NOW`, `WITHHELD`, `BLOCKED`, `EXPIRED`, or `INVALIDATED`.
  - Publication lifecycle badge: `VALID` (green), `AGING` (amber), `EXPIRED` (gray), `BLOCKED` (red), `WITHHELD` (amber/neutral), `INVALIDATED` (red/gray).
  - Decision snapshot ID (`DEC_ANT_VER_...`) and publication timestamp.
- **Pass Window Horizon Strip (`PassWindowStrip.tsx`)**: Compact horizontal bar graphs for 1 Lap ($P_1$), 2 Laps ($P_2$), and 3 Laps ($P_3$) pass likelihood with explicit `FROZEN MODEL + PAV` provenance.
- **Why / Why Not Panel (`WhyWhyNotPanel.tsx`)**:
  - Deterministic backend explanation tokens translated into clear engineering explanations:
    - `POST_PASS_INSTABILITY` $\rightarrow$ *"High post-pass counter-attack risk detected"*
    - `FUTURE_WINDOW_DOMINANCE` $\rightarrow$ *"Stronger future attack window available next lap"*
    - `RULE_RESTRICTION` $\rightarrow$ *"FIA sporting regulation restriction active (SC/VSC/Flag)"*
    - `ENERGY_INFEASIBILITY` $\rightarrow$ *"MGU-K kinetic energy deficit for planned deployment"*
  - Two distinct sections: `WHY SELECTED` and `WHY NOT OVERTAKE NOW?`.
- **Robustness Panel (`RobustnessPanel.tsx`)**: Displays scenario winners across 3 battery assumptions (`CONSERVATIVE`, `NOMINAL`, `FAVORABLE`) and declares the verdict (`ROBUST WITHIN TESTED ASSUMPTIONS` or `ENERGY-SENSITIVE`).

### 4. Bottom Intelligence Tabs (`BottomIntelligence.tsx`)
- `TELEMETRY`: Temporal gap, closing rate (m/s), speed trap delta (km/h), tyre age delta, and rear traffic threat.
- `ENERGY 2026`: Available kinetic buffer (MJ), 4.0MJ per-lap deployment cap, 350kW MGU-K power curve taper, and sensitivity profile.
- `RULES`: FIA 2026 sporting and technical compliance, permitted actions list, and active rule bundle.
- `DECISION HISTORY`: Chronological audit trail records retrieved from SQLite store.
- `EVIDENCE`: Cryptographic SHA-256 hashes of the frozen LightGBM bundle, stability manifest, and strategy config.
- `SYSTEM`: Real-time pipeline latencies breakdown (Ingestion, Features, ML Inference, Matrix Solver, Ranking Brain, Publication Gate, Total Cycle).

---

## 5. Universal Evidence Inspector Framework

Clicking any matrix cell, P1/P2/P3 bar, energy value, rule check, stability verdict, or reason token slides open the `EvidenceDrawer.tsx` on the right side:
- **Contract Maintained**:
  - `Title`: Evaluated component name.
  - `Value`: Current computed state.
  - `Status`: Operational status tag.
  - `Provenance`: Standardized chip (`FROZEN MODEL`, `SIMULATED ENERGY`, `RULE CHECK`, `ORDINAL STABILITY`, `DERIVED`, `PUBLIC SOURCE`).
  - `Method & Version`: Algorithm name, specification version, and SHA-256 signatures.
  - `Evidence Breakdown`: Key-value evidence details.
  - `Reason Codes`: Structured backend reason tokens.
- **Non-Intrusive & Accessible**: Operates as an overlay that never reloads or shifts the page. Closes instantly on pressing `ESC` or clicking the close button.

---

## 6. Verified Production Tech Stack Panel

To facilitate rigorous technical inspection, a dedicated `TECH STACK` panel was added to the System workspace (`SystemWorkspace.tsx`), verified against repository files:

| Layer | Technology | Version / Spec | Role & Function in Platform |
| :--- | :--- | :--- | :--- |
| **Frontend Core** | React + TypeScript | React 19.2, TS 6.0 | High-density pit-wall workstation user interface |
| **Frontend Bundler** | Vite | Vite 8.2 (ESM) | Production bundle compiler & development server |
| **Styling Architecture** | Vanilla CSS / Tokens | CSS Variables + Grid | Strict zero-page-scrolling desktop motorsport ops design system |
| **Backend Core** | Python + FastAPI | Python 3.12, FastAPI 0.115+ | Async REST API, WebSocket streams, pipeline orchestration |
| **Validation & Schema** | Pydantic v2 | Pydantic 2.10 | Type-safe contracts for DecisionSnapshot & KyntraRuntimeSnapshot |
| **Machine Learning** | LightGBM + NumPy + Joblib | LightGBM 4.5.0 | Frozen cumulative horizon overtakes (P1/P2/P3) + PAV monotonicity |
| **Streaming Protocol** | WebSocket (WS /api/live) | RFC 6455 | Real-time bi-directional telemetry broadcast |
| **Decision Durability** | SQLite WAL Mode | SQLite 3 (PRAGMA WAL) | Append-only atomic persistence surviving process restarts |
| **Telemetry Ingestion** | OpenF1 + FastF1 Adapters | OpenF1 Live / Parquet | Real-time F1 timing ingestion and replay provider caches |

---

## 7. Visual QA & Responsive Verification

Automated browser subagent testing validated clean rendering and interaction across all target resolutions:

1. **1920x1080 (Primary Workstation)**:
   - Full 3-zone upper sector + complete 13-row Strategist Matrix + Call/Rationale + Bottom Tabs visible simultaneously.
   - **Zero body scrollbars detected**.
   - Screenshot captured: `workstation_1920x1080_1789233485372.png`.

2. **Evidence Drawer Interaction**:
   - Clicking cell `01. RULE / ELIGIBILITY` in column `SAVE ENERGY` opened `EvidenceDrawer.tsx` on the right side.
   - Verified display of rule IDs, article references, and provenance chips.
   - Pressing `ESC` closed the drawer smoothly.
   - Screenshot captured: `evidence_drawer_open_1789233745649.png`.

3. **1440x900 (Compact Workstation)**:
   - Evaluated scaling at 1440x900: Grid automatically compacted upper zone to 210px and matrix to 240-290px.
   - All text and telemetry numbers remained legible without truncation.
   - **Zero body scrollbars detected**.
   - Screenshot captured: `workstation_1440x900_1789233810612.png`.

4. **1366x768 (Field Laptop Display)**:
   - Evaluated scaling at 1366x768: Tightened padding to 4px and timing column to 210px.
   - Interface preserved all functional panels with internal scrollable table containers.
   - **Zero body scrollbars detected**.
   - Screenshot captured: `workstation_1366x768_1789233823170.png`.

---

## 8. Build & Verification Results

- **Frontend Production Build**: `npm run build` completed in **2.34s** with 0 errors (`dist/index.html` 0.50 kB, `index.css` 91.45 kB, `index.js` 336.62 kB).
- **Backend Test Regression**: `pytest` executed 246 tests across all modules: **246 passed in 45.89s (100% green)**.
- **Frozen Model SHA-256**: Verified unchanged (`a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`).

---

**PASS — KYNTRA STRATEGIST WORKSTATION FOUNDATION READY**
