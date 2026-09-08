# KYNTRA — Energy & Overtake Decision Intelligence

**Predict the pass. Price the energy. Protect the position.**

KYNTRA is a motorsport decision-intelligence system for the 2026 Energy & Overtake Intelligence challenge.

It is designed to answer five questions:

1. Can I pass?
2. Can I afford it?
3. Can I keep it?
4. Am I allowed?
5. What should I do now?

> KYNTRA does not optimize one straight. It optimizes what happens after it.

## Why KYNTRA

A high-probability overtake is not automatically a good strategic decision.

An attack may consume valuable electrical energy, leave the car vulnerable to a re-pass, occur before a stronger future window, or be blocked by regulation/event constraints.

KYNTRA separates:
- ML prediction
- position-retention intelligence
- energy simulation
- deterministic FIA compliance
- short-horizon counterfactual strategy

instead of asking one opaque model to do everything.

## Architecture

```text
REAL PUBLIC RACE TELEMETRY
        |
        +--> Overtake Model -------> P(pass within H)
        |
        +--> Retention Model ------> P(retain | pass)
        |
        +--> Energy Provider ------> projected energy state
        |        `-- prototype: SIMULATED
        |
        +--> Race/Event Context
                    |
                    v
          FIA COMPLIANCE ENGINE
                    |
                    v
         COUNTERFACTUAL STRATEGY
   CONSERVE / BUILD / DEPLOY / OVERTAKE
                    |
                    v
               KYNTRA CALL
```

## Real vs Simulated

### Real
Historical Formula 1 timing and public telemetry are used for race-state reconstruction and overtake modeling.

### Simulated
Public telemetry does not expose the full private team battery/ERS state required for a real pit-wall deployment decision.

Therefore prototype energy values must remain labeled:

**SIMULATED — 2026 REGULATION CONSTRAINED**

KYNTRA never presents simulated energy as real team telemetry.

## Core Actions

- `CONSERVE`
- `BUILD`
- `DEPLOY`
- `OVERTAKE`

UI labels may map to:
- SAVE ENERGY
- PREPARE
- APPLY PRESSURE
- OVERTAKE NOW

## Overtake Intelligence

The overtake model will estimate:

- P(pass within 1 lap)
- P(pass within 2 laps)
- P(pass within 3 laps)

Initial modeling excludes driver/team identity from the core dynamics feature set.

## Position Retention Intelligence

KYNTRA separately estimates:

P(retain position for H valid racing laps | successful pass)

This allows the system to distinguish:

high P(pass) + high P(retain)

from:

high P(pass) + low P(retain)

The second case can make waiting strategically preferable.

## Counterfactual Strategy

KYNTRA compares short-horizon alternatives:

- CONSERVE
- BUILD
- DEPLOY
- OVERTAKE

V1 should avoid arbitrary weighted sums.

The intended policy:
1. remove illegal actions
2. remove physically/energy-infeasible actions
3. simulate feasible futures
4. compare durable position outcomes
5. use energy reserve/future opportunity as tie-breakers
6. surface uncertainty if the recommendation changes across plausible simulated energy scenarios

## Web Application

The final competition UI is a desktop-first pit-wall web application.

Primary modules:
- historical race replay
- battle intelligence
- overtake probability
- retention probability
- simulated energy state
- FIA compliance
- counterfactuals
- KYNTRA tactical call
- WHY NOT ATTACK NOW?
- provenance/system view

No UI component should contain invented probabilities.

## Engineering Principles

1. No telemetry fabrication
2. Explicit provenance
3. ML predicts; deterministic code enforces
4. Simulation assumptions are not regulation facts
5. No future leakage
6. No demo-race contamination
7. No identity leakage in the initial core dynamics model
8. Prefer calibrated probabilities
9. Surface uncertainty
10. Human engineer remains in control

## Roadmap

```text
Phase 1   Telemetry + energy + regulation foundation
Phase 2A  Verified overtake dataset
Phase 2B  Overtake EDA + baseline + calibrated model
Phase 2C  Position-retention model
Phase 3   Energy × overtake fusion
Phase 4   Counterfactual strategy engine
Phase 5   Pit-wall web application
Phase 6   Validation + demo hardening
```

## Status

KYNTRA is under active development for TrackShift 2026.

Final dataset statistics and model metrics should only be added after the corresponding audits/models are locked.
