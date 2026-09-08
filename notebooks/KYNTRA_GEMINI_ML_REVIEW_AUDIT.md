# KYNTRA — Gemini ML Review Audit

## Verdict
Gemini's review is directionally strong, but several recommendations are modified before implementation.

## Accepted
- Event-level LOEO CV across the 7 TRAIN races.
- Pooled OOF plus per-event/macro reporting.
- Battle-sequence correlation is real and should be tested.
- Inverse-square-root sequence weighting is an ablation worth testing.
- PR-AUC and Brier are primary; ROC-AUC is secondary.
- Global + tactical-slice reporting is necessary.
- Do not train a standalone retention ML classifier with 4/11/18 re-pass examples.
- Demo holdouts remain untouched.
- Never relabel censored rows as negative.
- Audit multi-horizon monotonicity before using 1/2/3-lap outputs together.

## Modified
### Censoring
Complete-case classification is acceptable for the MVP baseline, but censoring is potentially informative. Do NOT describe the current filtering as MCAR.

### Tactical slice
Do not hard-code 1.0 or 1.2 seconds as the only battle definition. Report multiple TRAIN-derived slices: <=1.0s, <=1.5s, <=3.0s. These are evaluation slices, not training filters.

### Missing values
Do not assume missing rolling gap variance means zero variance, or missing rear gap means exactly 1000m / tail of pack. Use fold-fitted median imputation plus missingness indicators for Logistic Regression until semantics are proven.

### Monotonic constraints
Do not automatically constrain every proposed feature. Gap and distance are strong candidates later; closing rate, pace delta, tyre age, and speed-trap delta require exact sign/context verification. Treat monotonic constraints as an ablation.

### Class weighting
Keep the primary probabilistic baseline on the empirical distribution. Weighted discrimination can be tested later only with calibration.

### Calibration
Do not fit a calibrator in the baseline notebook. First compare raw event-held-out OOF behavior. Later calibration must be based on OOF predictions and evaluated without reusing the same predictions for both calibration-method selection and performance claims.

## Baseline question
Does dynamics/context materially outperform gap-only inside close tactical battle slices?

If not, KYNTRA has not yet demonstrated enough intelligence beyond proximity.
