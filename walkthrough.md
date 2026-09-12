# KYNTRA — PHASE 07: DYNAMIC STRATEGIST MATRIX & COUNTERFACTUAL SCENARIO ENGINE

## Executive Summary
KYNTRA Phase 07 implements the canonical backend **Strategist Matrix** (`StrategyMatrixSnapshot`), evaluating four counterfactual decision alternatives (`CONSERVE`, `BUILD`, `DEPLOY`, `OVERTAKE`) from the same coherent battle state without fabricating ML probabilities or prematurely enabling strategy ranking.

- **Fair Baseline Invariant**: All four action rollouts begin from the exact same cloned source state, proving 100% action-order independence.
- **ML Truth Gating**: Preserves frozen LightGBM baseline $P_1, P_2, P_3$. Strictly enforces `action_effect_available = False` without fabricated action-conditioned probabilities.
- **2026 Regulation Energy Scenarios**: Computes `CONSERVATIVE`, `NOMINAL`, and `FAVORABLE` scenarios per action under FIA 2026 MGU-K power tapering and 4.0 MJ usable window constraints.
- **Independent Regulation Eligibility**: Evaluates sporting legality per action; under SC/VSC, `OVERTAKE` is blocked while `DEPLOY`, `CONSERVE`, and `BUILD` remain allowed.
- **Stability V1 Integration**: Reuses locked Stability V1 consensus; maps durability to `OVERTAKE` while marking `CONSERVE` and `BUILD` as `NOT_APPLICABLE`.
- **Ranking & Recommendation Gating**: Confirmed `ranking.available = False` and `recommendation.available = False` pending Phase 08.

---

## 1. Verified Architecture & Components

### 1.1 Strategy Domain Subsystem (`src/kyntra/strategy/`)
- [`models.py`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/src/kyntra/strategy/models.py): Canonical schemas for `StrategistAction`, `ActionOutcomeSnapshot`, `StrategyMatrixSnapshot`, and discrete energy/pass/stability/forecast sub-snapshots.
- [`counterfactuals.py`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/src/kyntra/strategy/counterfactuals.py): Deterministic action simulators for sporting regulation checks, 3-scenario energy rollouts, post-pass durability mapping, and short-horizon forecasts.
- [`matrix.py`](file:///c:/Users/tanvi/OneDrive/Documents/TRACKSHIFT%202026/KYNTRA/src/kyntra/strategy/matrix.py): Core generator `generate_strategy_matrix()` combining pass window inference, stability consensus, and isolated action rollouts.

### 1.2 REST API Integration (`src/kyntra/api/routes.py`)
- `GET /api/strategy/matrix/current`: Convenience alias for current/active battle matrix.
- `GET /api/strategy/matrix/{event_id}/{lap}`: Replay matrix for a given lap.
- `GET /api/strategy/matrix/{event_id}/{lap}/{attacker}/{defender}`: Matrix for an explicit battle pair.
- `POST /api/strategy/matrix`: On-demand matrix generation from custom payload.

---

## 2. Automated Verification & Performance

- **Full Backend Pytest Suite**: **144 passed** in 26.58s (`pytest tests/`)
- **Strategy Matrix Suite**: **21 passed** (`tests/test_strategy_matrix.py`)
  - Order-independence regression test: **PASSED**
  - ML truth invariant (`action_effect_available is False`): **PASSED**
  - Regulation SC/VSC blocking: **PASSED**
  - Energy scenario invariants: **PASSED**
  - Degradation and provenance checks: **PASSED**
- **Performance Benchmark (100 runs)**:
  - **Median Latency**: **18.11 ms**
  - **P95 Latency**: **23.03 ms**
- **Frozen Model Bundle SHA**: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` (**VERIFIED UNTOUCHED**)
- **Web Frontend Build**: `npm run build` in `web/` $\rightarrow$ built in 1.04s (0 errors).
