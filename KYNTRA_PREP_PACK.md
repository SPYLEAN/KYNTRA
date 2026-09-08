# KYNTRA Prep Pack

## Locked Product Identity

**KYNTRA — Energy & Overtake Decision Intelligence**

**Tagline:** Predict the pass. Price the energy. Protect the position.

Core questions:
1. Can I pass?
2. Can I afford it?
3. Can I keep it?
4. Am I allowed?
5. What should I do now?

Canonical backend actions:
- CONSERVE
- BUILD
- DEPLOY
- OVERTAKE

Human-facing UI mapping:
- CONSERVE → SAVE ENERGY
- BUILD → PREPARE
- DEPLOY → APPLY PRESSURE
- OVERTAKE → OVERTAKE NOW

---

# Stitch UI Master Specification

## Design direction

Build a desktop-first motorsport pit-wall decision application. Use an original KYNTRA identity, not Formula 1 broadcast graphics or team branding. The interface should feel engineered, serious, fast to read, and trustworthy rather than like a generic AI SaaS product.

Visual system:
- near-black / graphite base
- crisp white and gray typography
- tabular numerals
- thin separators and restrained borders
- minimal gradients and almost no glow
- state colors only for warning/compliance/status
- subtle purposeful motion
- dense but clean telemetry layout
- primary target sizes: 1440×900 and 1920×1080

## Main screen — Race Intelligence

Top bar:
- KYNTRA wordmark
- event selector
- historical replay badge
- lap number
- play / pause / step / scrub controls
- telemetry source
- energy source
- regulation status
- model status

Battle strip:
- attacker code / position / tyre / tyre age
- defender code / position / tyre / tyre age
- gap seconds
- distance gap
- closing rate
- recent pace delta
- speed delta
- consecutive following laps
- rear threat

Central anchor:

**KYNTRA CALL**

Possible UI states:
- SAVE ENERGY
- PREPARE
- APPLY PRESSURE
- OVERTAKE NOW

Under it, show one evidence-based structured explanation. Never fabricate probabilities or free-form tactical evidence.

Four decision pillars:

### CAN I PASS?
- P(pass +1 lap)
- P(pass +2 laps)
- P(pass +3 laps)
- trend
- calibration status

### CAN I AFFORD IT?
- energy source
- current energy state
- projected action cost
- projected post-action reserve
- scenario sensitivity

Always display when appropriate:
**SIMULATED — 2026 REGULATION CONSTRAINED**

### CAN I KEEP IT?
- P(retain | pass)
- re-pass vulnerability
- rear threat
- post-pass reserve / pace context

### AM I ALLOWED?
- LEGAL / BLOCKED / UNKNOWN
- deterministic compliance reason codes
- event configuration provenance

Compliance must override ML. If an action is blocked, the UI cannot recommend OVERTAKE NOW.

## Signature panel — WHY NOT ATTACK NOW?

Show whenever the recommendation is not OVERTAKE NOW.

Rows:
- overtake feasibility
- energy expenditure
- post-pass reserve
- retention vulnerability
- rear/re-pass threat
- better future window
- compliance

Every explanation must come from structured engine/model outputs.

## Counterfactual strip

Compare four actions horizontally:
- CONSERVE
- BUILD
- DEPLOY
- OVERTAKE

For each show:
- feasible / blocked
- pass outcome
- retention outcome
- ending energy
- future opportunity impact
- compliance
- rank

Highlight one recommended action only after the strategy engine computes it.

## Replay timeline

Bottom timeline:
- lap ticks
- current observation
- pit events
- SC / VSC / red flag markers
- verified pass/re-pass events
- jump-to-battle controls

## Secondary views

### Battle Intelligence
Telemetry trends, battle sequence, pass/re-pass events, model evidence, missing-data flags, provenance.

### Counterfactuals
3–5 lap comparison of CONSERVE / BUILD / DEPLOY / OVERTAKE with projected energy and durable-position outcomes.

### System / Provenance
Clearly separate:
- real public telemetry
- simulated energy
- deterministic FIA rules
- ML models
- dataset split and demo holdout status
- validation/test status

## Empty/error states
- TELEMETRY UNAVAILABLE
- MODEL NOT LOADED
- ENERGY STATE UNKNOWN
- EVENT CONFIG INCOMPLETE
- NO ACTIVE BATTLE
- ACTION BLOCKED BY COMPLIANCE

Never replace missing values with fake zeros or percentages.

## Stitch master prompt

Design a desktop-first web application called KYNTRA, an original premium motorsport pit-wall decision intelligence system. It helps race engineers decide whether to conserve energy, build an opportunity, deploy pressure, or overtake now.

The product must answer five questions at a glance: Can I pass? Can I afford it? Can I keep it? Am I allowed? What should I do?

Use a near-black graphite foundation, crisp white/gray typography, tabular numerals, thin separators, restrained status colors, minimal gradients, almost no glow, and subtle purposeful motion. Avoid copying Formula 1 broadcast graphics, team branding, or official logos. The result should feel like engineering software used on a pit wall, not a generic AI SaaS dashboard or gaming HUD.

The main screen is a historical race replay workspace. At the top show KYNTRA branding, event selector, lap replay controls, telemetry provenance, energy-source status, regulation status, and model status.

Create a prominent attacker-versus-defender battle strip showing positions, tyres, temporal gap, spatial gap, closing trend, pace delta, speed delta, laps followed, and rear threat.

The visual anchor is a large “KYNTRA CALL” module with one of four human-facing states: SAVE ENERGY, PREPARE, APPLY PRESSURE, OVERTAKE NOW.

Below it create four decision pillars: CAN I PASS? with 1/2/3-lap pass probabilities; CAN I AFFORD IT? with energy state, projected cost and post-action reserve; CAN I KEEP IT? with conditional position-retention probability and re-pass vulnerability; AM I ALLOWED? with deterministic FIA compliance status and reason codes.

Whenever energy is simulated, clearly display “SIMULATED — 2026 REGULATION CONSTRAINED”. Never imply that public telemetry contains real battery SOC.

Add a signature panel titled “WHY NOT ATTACK NOW?” explaining overtake feasibility, energy expenditure, post-pass reserve, retention risk, rear threat, future window, and compliance whenever KYNTRA does not recommend an immediate overtake.

Add a counterfactual strip comparing CONSERVE, BUILD, DEPLOY, and OVERTAKE. Each action should show feasibility, projected energy, pass/retention outcome, future opportunity effect, compliance, and rank. Highlight exactly one recommended action only when computed.

At the bottom create a replay timeline with lap ticks, verified pass/re-pass events, pit events, neutralizations, and a movable observation marker.

Create secondary views for BATTLE INTELLIGENCE, COUNTERFACTUALS, and SYSTEM/PROVENANCE. The SYSTEM view must clearly distinguish real public telemetry, simulated energy, deterministic FIA rules, and ML predictions.

Do not invent values. Numerical outputs that do not exist yet must show “—”, “Awaiting model”, or “Unavailable”, never fake percentages. Optimize for 1440×900 and 1920×1080.

---

# Decision Logic Specification

KYNTRA must not maximize raw overtake probability.

## V1 policy

1. Hard-filter illegal or physically infeasible actions.
2. Roll out each remaining action over a short 3–5 lap future.
3. Evaluate pass outcome, retention outcome, ending energy, future opportunity, and rear/re-pass vulnerability.
4. Prefer greater expected durable-position outcome.
5. Tie-break using future opportunity and post-action energy reserve.
6. If the recommendation changes materially across plausible simulated starting-energy states, label it ENERGY-SENSITIVE rather than pretending the recommendation is robust.

Avoid an arbitrary weighted sum in V1.

Interpretable strategic component:

`Durable Position Opportunity(H) = P(pass by H) × P(retain | pass, H)`

Do not present that quantity as a separately calibrated probability unless the underlying models and conditional interpretation support it.

## Explanation logic

Only explain with structured evidence:
- pass feasibility
- retention risk
- energy reserve/cost
- future opportunity
- rear threat
- compliance

A generative model must never invent tactical evidence.

## Shared frontend decision snapshot

Suggested shape:

```json
{
  "race": {"event_id": null, "lap": null, "attacker": null, "defender": null},
  "provenance": {
    "telemetry_source": "REAL_PUBLIC_TELEMETRY",
    "energy_source": "SIMULATED",
    "regulation_config": null,
    "model_versions": {"overtake": null, "retention": null}
  },
  "overtake": {"p_1": null, "p_2": null, "p_3": null, "calibrated": false},
  "retention": {"p_1_given_pass": null, "p_2_given_pass": null, "p_3_given_pass": null, "calibrated": false},
  "energy": {"available": null, "fraction": null, "simulated": true, "scenario": null},
  "compliance": {"allowed_actions": [], "blocked_actions": [], "reason_codes": []},
  "counterfactuals": [],
  "recommendation": {"canonical_action": null, "ui_label": null, "robust": null, "why": []}
}
```

Use null until a field is truly computed.

---

# README V2 Structure

Use this after the targeted same-lap audit is complete. Do not overwrite the repo README while Antigravity is still changing the local branch.

## Header

# KYNTRA
## Energy & Overtake Decision Intelligence
**Predict the pass. Price the energy. Protect the position.**

KYNTRA helps a race engineer decide not only whether an overtake is possible, but whether it is strategically worth spending electrical energy now and whether the gained position is likely to remain durable.

## Sections

1. Why KYNTRA
2. Five core questions
3. Architecture
4. Real vs simulated data provenance
5. Verified overtake dataset
6. Overtake model
7. Retention model
8. Energy simulator
9. FIA compliance
10. Counterfactual strategy
11. Human-in-the-loop
12. Demo story
13. Web application
14. Implemented vs planned stack
15. Engineering principles
16. Roadmap
17. Limitations
18. Status

## Dataset placeholders until final audit

```text
Primary observations: {{FINAL_PRIMARY_ROWS}}
Training observations: {{FINAL_TRAIN_ROWS}}
Validation observations: {{FINAL_VALIDATION_ROWS}}
Battle sequences: {{FINAL_BATTLE_SEQUENCES}}
Verified overtakes: {{FINAL_VERIFIED_OVERTAKES}}
Tests passing: {{FINAL_TEST_COUNT}}
Label version: {{FINAL_LABEL_VERSION}}
```

Do not publish provisional stats as final.

## Engineering principles to state explicitly

- no telemetry fabrication
- explicit provenance
- ML predicts; deterministic code enforces
- simulation assumptions are not regulation facts
- no future leakage
- no demo-race contamination
- no initial driver/team identity leakage
- calibrated probabilities over raw confidence
- uncertainty surfaced, not hidden
- human engineer remains in control

---

# Colab 01 — Overtake EDA Blueprint

Notebook name:
`KYNTRA_01_OVERTAKE_EDA.ipynb`

Do not run until the final same-lap detector audit returns ready for Colab.

Use TRAIN for exploratory analysis. Use VALIDATION only for high-level distribution comparison and integrity checks. Never use demo holdouts for feature/model decisions.

## Cell 1 — imports

```python
!pip -q install pyarrow duckdb

from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import duckdb

pd.set_option("display.max_columns", 120)
```

## Cell 2 — Drive

```python
from google.colab import drive
drive.mount("/content/drive")
```

## Cell 3 — paths

```python
ROOT = Path("/content/drive/MyDrive/KYNTRA")
DATA = ROOT / "datasets"
FIGURES = ROOT / "figures"
EXPERIMENTS = ROOT / "experiments"
FIGURES.mkdir(parents=True, exist_ok=True)
EXPERIMENTS.mkdir(parents=True, exist_ok=True)
PRIMARY = DATA / "kyntra_overtake_dataset.parquet"
assert PRIMARY.exists()
```

## Cell 4 — load

```python
df = pd.read_parquet(PRIMARY)
print(df.shape)
display(df.head())
```

## Cell 5 — hard integrity

```python
assert df["observation_id"].is_unique
assert set(df["split"].dropna().unique()).issubset({"TRAIN", "VALIDATION"})

train = df[df["split"] == "TRAIN"].copy()
val = df[df["split"] == "VALIDATION"].copy()

assert set(train["event_id"]).isdisjoint(set(val["event_id"]))
assert set(train["battle_sequence_id"]).isdisjoint(set(val["battle_sequence_id"]))
```

## EDA sequence

1. dataset shape and split counts
2. 1/2/3-lap target balance after censoring
3. retention/re-pass counts
4. model-feature missingness
5. event-level positive rates
6. battle-sequence length distribution
7. continuous feature sanity and outliers
8. categorical distributions
9. TRAIN-only PASS vs NO PASS comparison
10. TRAIN-only PASS+RETAIN vs PASS+REPASS comparison
11. gap vs closing-rate visualization
12. TRAIN vs VALIDATION distribution shift diagnostics
13. save EDA summary tables
14. STOP before model training

Questions to answer before baseline ML:
- How many usable observations remain at each horizon after censoring?
- How imbalanced are the targets?
- Does one event dominate positives?
- Which features have meaningful missingness?
- Are there suspicious values?
- How long are battle sequences?
- How many successful passes are retained vs re-passed?
- Does PASS_RETAIN differ from PASS_REPASS?
- Is validation materially shifted from training?
- Is there enough retention data for a separate V1 retention model?

Next notebook only after review:
`KYNTRA_02_BASELINE.ipynb`

---

# Documentation Files to Add Later

After Antigravity finishes and the local branch is stable:

```text
docs/
├── architecture.md
├── data_provenance.md
├── decision_logic.md
├── demo.md
├── limitations.md
├── model_card_overtake.md
├── model_card_retention.md
└── judge_faq.md
```

The pitch, demo story, and judge FAQ are already prepared; reuse them rather than rewriting them.
