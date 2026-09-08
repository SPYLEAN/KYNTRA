# KYNTRA Demo Runbook

## Demo objective
Show one real historical race battle and prove that KYNTRA can decide:
- whether a pass is possible
- whether the energy cost is acceptable
- whether the position is likely to be retained
- whether the action is legal
- whether attacking now is better than waiting

## Demo flow

1. Open historical replay
2. Jump to selected battle window
3. Show attacker/defender telemetry state
4. Show overtake prediction
5. Show retention prediction
6. Show simulated energy state
7. Show FIA compliance
8. Open counterfactuals:
   - CONSERVE
   - BUILD
   - DEPLOY
   - OVERTAKE
9. Highlight KYNTRA recommendation
10. Open WHY NOT ATTACK NOW? if immediate overtake is not recommended
11. Show next-lap outcome in replay
12. End on system/provenance screen

## Demo rules
- Never use fake probabilities
- Never call simulated SOC real
- Never imply live team integration
- Never say KYNTRA autonomously controls the car
- Never claim regulation compliance beyond what the deterministic engine actually evaluates
- If a panel has no model result yet, show “MODEL NOT LOADED” or “—”

## Backup plan
Prepare:
- local dataset copy
- FastF1 cache
- local Python 3.12 environment
- local web build
- GitHub backup
- exported Stitch screenshots
- 2-minute screen-recording backup of the working demo

## Final demo sentence
“KYNTRA does not optimize one straight. It optimizes what happens after it.”
