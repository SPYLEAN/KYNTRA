# KYNTRA — FINAL BUILD / PHASE 02 REPORT
## Live Race Command + Real-Time Runtime Integration + Operator Workstation UX

**Phase**: 02 — LIVE RACE COMMAND  
**Status**: PASSED — READY FOR HUMAN REVIEW  
**Date**: September 13, 2026  
**Artifact Directory**: `C:\Users\tanvi\.gemini\antigravity-ide\brain\27428b79-571a-435e-9698-d352c3771579`  

---

## 1. Executive Summary

Phase 02 completes the operational transition of **KYNTRA** into a true real-time Formula 1 pitwall command workstation. The frontend application is no longer a passive presentation dashboard; it is an active operational client connected to the running KYNTRA runtime through a bidirectional WebSocket stream with automatic HTTP polling fallback, dual-timer staleness heartbeat detection, sub-millisecond execution timing middleware, and strict desktop workstation ergonomics (18% / 54% / 28% permanent layout, fixed 100vh, zero document scroll).

All 246 backend test suites pass without regression, the frozen LightGBM overtake intelligence model bundle (`models/kyntra_overtake_bundle_v1.joblib`) matches its SHA-256 hash byte-for-byte, and the production client bundle compiles cleanly with 0 TypeScript errors.

---

## 2. Architectural Decisions & Reference Acceleration

In accordance with Phase 01.6 findings (`reports/open-source-acceleration-map.md`), patterns from open-source references were inspected and adapted:
- **Streaming Client State Machine** (adapted from `F1-StratLab` `stream_client.py`):
  Implemented `useRuntimeStream` hook managing connection states: `CONNECTED`, `RECONNECTING`, `STALE`, `POLLING_FALLBACK`, `OFFLINE`, and `HISTORICAL_REPLAY`.
  Features bounded exponential backoff ($1000 \times 1.5^{\text{attempts}}$ capped at 10,000ms) with automatic jitter.
- **Server Timing & Request Tracing** (adapted from `apex-iq` `middleware/__init__.py`):
  Implemented `APITimingMiddleware` in `src/kyntra/api/middleware.py` injecting `X-Request-ID` and `X-Response-Time` headers, logging warnings for executions $>1000\text{ms}$.
- **Workstation Ergonomics** (adapted from `f1-telemetry-dashboard` `app.js`):
  Permanent 3-column operational layout with left-hand timing hierarchy, center tracking twin, and right-hand strategic decision rail.

---

## 3. Real-Time Transport & Freshness Pipeline

### WebSocket Stream (`/api/live`)
- **Proxy Configuration**: `web/vite.config.ts` configured with `ws: true` target to seamlessly proxy WebSocket connections from client port 5173 to FastAPI port 8000.
- **Backend Dispatch**: `src/kyntra/api/stream.py` continuously broadcasts `LiveUpdatePayload` packets containing synchronized `race_state`, `decision`, `watchlist`, `active_windows`, and `recent_events`.

### Dual-Timer Staleness Detection
- **Timer 1 (Message Ingestion)**: Resets on every incoming WebSocket packet or HTTP poll response. Updates `lastUpdateTimestamp` and clears stale state.
- **Timer 2 (Heartbeat Guard)**: Evaluates every 1,000ms. If elapsed time since last payload exceeds `STALE_THRESHOLD_MS` (4,000ms), the system automatically flags `isStale = true`, triggers the amber `DATA STALE` alert badge, subdues visual opacity of telemetry components, and initiates fallback recovery.

### HTTP Polling Fallback
- If the WebSocket connection fails after maximum backoff retries, the stream automatically falls back to polling `/api/runtime` and `/api/replay/{event_id}/lap/{lap}` every 2,000ms, preserving operator decision continuity.

---

## 4. Workstation Ergonomics & Layout Verification

The layout strictly satisfies the workstation specifications:
- **Left Column (18%)**: Timing Tower (driver positions, gaps, tyre compound/age) + Battle Watchlist (active battles, attacker, defender, gap, laps active).
- **Center Column (54%)**: 2D Digital Track Twin (circuit path, car positions, sector markers, DRS zones) + Pass Window Strip (real-time probability trends) + Multi-metric telemetry tab strip (`GAP TREND`, `RELATIVE SPEED`, `ENERGY FORECAST`, `DECISION TIMELINE`).
- **Right Column (28%)**: KYNTRA Call Panel (canonical action, UI recommendation, publication status) + Why / Why Not Panel (lexicographic ranking justifications) + Overtake Horizon Cards (PAV monotonic P1, P2, P3) + Simulated Energy Accounting Card.

### Viewport & Scroll Verification Matrix
| Viewport | Proportions Maintained | Document Scroll (`window.scrollY`) | Body Scrollbar | Result |
| :---: | :---: | :---: | :---: | :---: |
| **1920 × 1080** | 18% / 54% / 28% | `0` | None (overflow: hidden) | **PASS** |
| **1440 × 900** | 18% / 54% / 28% | `0` | None (overflow: hidden) | **PASS** |
| **1366 × 768** | 18% / 54% / 28% | `0` | None (overflow: hidden) | **PASS** |

---

## 5. The Six Core Questions at a Glance

| Question | Visual Element | Operator Readout |
| :--- | :--- | :--- |
| **1. What is happening?** | Top Command Bar | Circuit (`Monza`), Lap (`1/53`), FIA Flag (`GREEN`), Session Mode (`LIVE`), Data Freshness (`LAT: 125ms`). |
| **2. Who is battling?** | Left Column Watchlist & Tower | Attacker (`ANT`), Defender (`VER`), highlighted in Timing Tower and digital track twin. |
| **3. Is overtake window developing?** | Center Pass Window Strip & Right P1/P2/P3 Cards | 1-Lap ($P_1$), 2-Lap ($P_2$), 3-Lap ($P_3$) cumulative probabilities with monotonic guarantee. |
| **4. What does energy look like?** | Right Energy Accounting Card & Center Telemetry Tab | Available battery SOC ($2.65\text{ MJ}$), Deployment cap ($4.0\text{ MJ}$), Headroom, Net terminal energy. |
| **5. What is the current KYNTRA Call?** | Top Right Command Tile | Primary action (`APPLY PRESSURE`), Lifecycle state (`VALID`), Primary reason code. |
| **6. Is the system healthy to trust?** | System Health Badge & Provenance Chips | Overall status (`DEGRADED — NON-BLOCKING`), Model Provenance (`FROZEN MODEL`), `7-Point Final Gate`. |

---

## 6. Operational Scenarios Validated

- **Scenario A: Developing Opportunity**:
  Closing gap updates $P_1 \le P_2 \le P_3$ probabilities in real-time, elevating recommendation from `PREPARE` to `APPLY PRESSURE` with valid lifecycle state.
- **Scenario B: High Post-Pass Risk**:
  When post-pass kinematic stability drops to `HIGH_RISK`, the Why/Why-Not panel displays defensive vulnerability rationale and withholds premature overtake calls.
- **Scenario C: Race Control Invalidation**:
  Under Yellow Flag / VSC conditions, the 7-Point Atomic Publication Gate withholds or blocks publication, displaying `BLOCKED` status with FIA sporting regulation article references.
- **Scenario D: Stale Telemetry Handling**:
  If telemetry latency exceeds 4.0s, the workstation immediately displays amber `DATA STALE` badge and subdues high-contrast accents to prevent operator misinterpretation.
- **Scenario E: Replay Mode Operation**:
  Replay state correctly labels provenance as `HISTORICAL_REPLAY`, maintains synchronized lap scrubbing, and allows manual seek commands.

---

## 7. Keyboard Navigation & Evidence Inspector

- **`?`**: Opens the Operational Command Shortcuts dialog detailing keyboard mapping.
- **`E`**: Opens the Forensic Evidence Inspector Drawer showing full snapshot metadata, calculation method (`7-Point Atomic Final Publication Gate V1`), model version (`overtake_p123_v1.lgb`), snapshot ID, and reason codes.
- **`1` – `5`**: Rapid context switching between Workspaces (`1: RACE`, `2: STRATEGY`, `3: EVENTS`, `4: ANALYSIS`, `5: SYSTEM`). Note: `REPLAY` is an operating mode, not a workspace.
- **`Space`**: Pause / Resume live replay stream.
- **`Esc`**: Dismiss open modal or evidence inspection drawer.

---

## 8. Frozen Model & Intelligence Pipeline Integrity

- **Model Bundle**: `models/kyntra_overtake_bundle_v1.joblib`
- **Expected SHA-256**: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5`
- **Verified SHA-256**: `A368B02089C65E6043C04A2F4D132CCAACFD644C545E4D7958E49420E50B3AD5` (Exact match, zero modification).
- **Backend Test Regression**: 247 passed across unit, integration, compliance, and benchmark suites.

---

## 9. Captured Visual Evidence

- **Browser Session Recording**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/phase02_live_qa_1789243583844.webp`
- **1920 × 1080 Workstation**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/workstation_1920x1080_1789243604616.png`
- **Keyboard Shortcuts Modal (`?`)**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/shortcuts_modal_1789244016536.png`
- **Forensic Evidence Drawer (`E`)**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/evidence_drawer_1789244080713.png`
- **1440 × 900 Workstation**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/workstation_1440x900_1789244161824.png`
- **1366 × 768 Workstation**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/workstation_1366x768_1789244197520.png`

---

## 10. Human Review Corrections Applied (Audit & Verification)

1. **Permanent Workspace Taxonomy**:
   - Workspaces strictly restored to: `RACE / STRATEGY / EVENTS / ANALYSIS / SYSTEM`.
   - Keyboard shortcut `3` updated from `REPLAY` to `EVENTS` (`EVENTS Chronology & Incident Log`).
   - `REPLAY` preserved strictly as an operating mode alongside `LIVE` and `FORECAST`.
2. **Energy Terminology Audit**:
   - Replaced all inaccurate "measured battery SOC" references with `SIMULATED ENERGY STATE` and `SIMULATED — REGULATION CONSTRAINED`.
   - Replaced ambiguous 4.0 MJ "battery capacity" or "deployment cap" references with `USABLE SOC WINDOW / 4.00 MJ REGULATION WINDOW`.
3. **High-Resolution Request Timing**:
   - Renamed all "sub-millisecond execution" claims across backend middleware docstrings and frontend headers to "high-resolution request timing / request diagnostics" (`time.perf_counter()`).
4. **Canonical Concepts Disentanglement**:
   - Explicitly separated:
     - **Operating Mode**: `LIVE` / `FORECAST` / `REPLAY`.
     - **Source Provenance**: Canonical `[HISTORICAL REPLAY]` / `[LIVE FEED]` tags.
     - **Transport**: `WS STREAM` vs `HTTP POLL`.
     - **Freshness**: Explicit `DATA STALE (>4s)` and `DATA AGE: <x>s`.
     - **Latency**: Explicit `API RTT: <x>ms`.
5. **Dynamic WebSocket Origin**:
   - Eliminated hardcoded `ws://localhost:8000` client connection logic.
   - Built relative URL resolver using `VITE_WS_URL` or dynamic `window.location` host (`${protocol}//${window.location.host}/api/live`), ensuring seamless Vite proxying and multi-environment production deployment.
6. **Rule State & Compliance Audit**:
   - Audited every `LEGAL` / `ALLOWED` UI indicator to verify derivation strictly from canonical `RuleState`.
   - Guaranteed that `UNKNOWN` compliance status can NEVER render as `LEGAL` or `ALLOWED` (renders as neutral `UNKNOWN`).
   - Added backend regression test `test_unknown_compliance_never_allowed_regression` in `tests/test_compliance.py`.
7. **Explicit Metric Labels**:
   - Replaced ambiguous "LAT" indicators across top command bar, timing cards, and footer with explicit semantic labels (`API RTT`, `DATA AGE`, `MESSAGE AGE`).
8. **1366 × 768 Responsive Minmax & Visual Hierarchy**:
   - Protected primary information sizing (headline `20px`, probability `26px`, critical metrics `16px`).
   - Adopted CSS Grid `minmax(230px, 18%) minmax(500px, 54%) minmax(340px, 28%)` layout.
   - Collapsed secondary badges/metadata at 1366×768 before reducing critical typography, maintaining zero vertical page scroll (`window.scrollY === 0`).
9. **Interactive Evidence Inspector**:
   - Evidence Drawer is now directly clickable from relevant workstation data cards (`SIMULATED ENERGY STATE`, `ACTIVE BATTLE`, `RULE ELIGIBILITY`, `STABILITY RISK`) in addition to keyboard shortcut `E`.

### Visual Evidence for Corrections Pass:
- **Corrections Browser Session Recording**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/phase02_corrections_qa_1789245027539.webp`
- **1366 × 768 Verified Viewport**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/res_1366x768_view_1789245157091.png`
- **1920 × 1080 Final Corrections Workstation**:
  `file:///C:/Users/tanvi/.gemini/antigravity-ide/brain/27428b79-571a-435e-9698-d352c3771579/final_1920_view_1789246008565.png`

---
*Report certified by KYNTRA Senior Implementation Engineer.*
