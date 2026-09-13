# KYNTRA ASTRA — implementation and verification

Date: 13 September 2026. Recovery point: d91c5bb. Scope: frontend presentation, binding, and controls; sole editor.

## 1. Redesign summary
A graphite race-operations interface with a clear hierarchy: source state, published call, supporting evidence. The five workspaces now have distinct purposes and share typography, controls, surfaces, and inspection patterns.

## 2. Major experience changes
Compact persistent command bar; intentional workspace navigation; bounded race layout; explicit empty, unknown, disconnected, and degraded states. Decision panels resolve the immutable decision ID returned by the canonical runtime rather than treating the legacy timing-stream decision as publication authority.

## 3. Digital twin
Uses available provider car progress and source circuit geometry. Numbered car tokens, heading marks, attacker/defender emphasis, focus camera, collision-aware labels, and separate layer controls. Only available cars render. Approximate sector thirds are labelled as approximate. Track gap is sourced from the timing watchlist; the decision rail identifies its recorded snapshot lap. No invented field, geographic map, or private telemetry.

## 4. Adaptive intelligence
Compares captured snapshots of the same event and driver pair: actual feature values, P1/P2/P3, and published calls. Equal model hashes are shown only when verified. Missing features remain UNKNOWN. History resets on event/pair change or backward lap seek. This is changing inference with frozen weights, not online training.

## 5. Judge mode
Ten steps navigate and spotlight real components with dimming and controlled scrolling. All ten spotlight targets were verified. Evidence inspection and Copilot remain operational application controls.

## 6. Workspace changes
- Race: spatial view, timing field, published call, three horizons, simulated energy, rules, stability, rationale.
- Strategy: four futures, real eligibility and elimination traces, ranking candidate separate from publication, detailed matrix on demand.
- Events: observed decision timeline and diff, store-record count separate from session captures, unknown outcomes explicitly identified.
- Analysis: model/data story, adaptive comparison, decision architecture, development/validation/demo distinctions, explicit roadmap.
- System: canonical health first, then real subsystem errors, latency, freshness, persistence, and provenance.

## 7. Files modified
Frontend changes cover App; API client; runtime-stream hook; shared types and presentation helpers; DigitalTrackTwin; AdaptiveIntelligencePanel; JudgeModeTour; ReplayControlBar; StructuredCopilot; DecisionDiffPanel; EvidenceDrawer; KyntraCallPanel; RaceWorkspace; TimingTower; AppShell; TopCommandBar; SessionSwitcher; StrategyWorkspace; EventsWorkspace; AnalysisWorkspace; SystemWorkspace; main stylesheet import; new styles/astra.css.

.gitignore excludes temporary verification dependencies. scratch/astra_* contains local verification scripts, results, and screenshots. The pre-existing scratch/test_replay_demo.py and scratch/verify_final_runtime.py were preserved. No backend, model artifact, energy engine, ranking engine, rule bundle, publication gate, or training code was edited.

## 8. Build and tests
Production TypeScript/Vite build verified during implementation; final build result is reported in the handoff. Existing Python test suite: 247 tests passed. Frontend lint had no errors, with React warnings remaining. The repository virtual environment pointed to a missing Python installation, so verification used a temporary runtime and dependencies under scratch. The temporary scikit-learn version emits a model-version warning; frozen model artifacts were not modified.

## 9. Runtime verification
Browser automation exercised all five workspaces, P1/P2/P3, saved KYNTRA call, all ten tour steps, Copilot comparison, and evidence inspection with no browser page errors. Playback rates 0.5, 1, 2, and 4 were confirmed from runtime state. Pause held source time stable and resume cleared the paused state. Battle selection and all four event selections reached the runtime. Monza and Miami rendered provider cars; Japan rendered its limited single-car coverage.

Runtime and spatial replay have separate providers. Frontend playback commands update each once. Event changes are dispatched only to the canonical endpoint because that route already changes both providers. Provider updates remain asynchronous; initial session frames can be empty while geometry and timing arrive.

FORECAST reports REANALYSIS and labels the retained observed-state context. LIVE requires genuine live provenance from the timing and decision sources: retained replay cannot appear as live even when the backend mode flag changes. The final check confirmed three cars for both Miami and Monza and zero race cars in the LIVE disconnected view (scratch/astra-final-check.json).

## 10. Responsive verification
All five workspaces were captured at 1920×1080, 1440×900, and 1366×768. Document dimensions matched each viewport. Race fits one viewport; other dense workspaces use internal scrolling. Header position was checked at y=0 after fixing scroll propagation during resizing. Screenshots and machine-readable results are in scratch/astra-* and scratch/astra-browser-results.json. These checks are desktop coverage, not a mobile/accessibility certification.

## 11. Truth and semantic checks
No frontend-created strategy recommendation. Published calls come from immutable backend records. Simulated energy is labelled. UNKNOWN rules remain UNKNOWN even when another backend subsystem reports ALLOWED. Stability is ordinal, not a fabricated probability. No invented previous snapshot, outcome ledger, model performance, integrity hash, or live data. PAV is described as horizon ordering rather than probability calibration. Dataset counts cite the repository QA reports; four demo sessions are not presented as the training dataset.

## 12. Remaining risks / release blockers
- Canonical runtime reports degraded event persistence: duplicate attempts to save an already immutable DecisionSnapshot. The UI exposes the actual error. Fixing the backend is outside the authorized redesign scope.
- Backend compliance can report UNKNOWN for unconfigured circuit rules while its matrix/publication rationale reports regulatory clearance. Both records remain inspectable; the UI does not silently reinterpret them. This needs backend reconciliation before operational trust can be claimed.
- Spatial and decision providers have separate clocks. Mirrored playback controls do not prove atomic synchronization. Snapshot context is labelled; a backend unified state stream remains the proper solution.
- No connected live feed or verified historical outcome ledger was available. Full live operation and retrospective success are not certified.
- Some model input fields are not exposed in the decision payload and correctly remain UNKNOWN. High-rate motion, long-duration stability, projector readability, and exhaustive keyboard/focus behavior need further validation.

Status: frontend redesign implemented and substantially verified. Full operational PASS is blocked by the backend persistence and rule/publication inconsistencies above.
