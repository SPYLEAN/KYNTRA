# KYNTRA Pre-Build Completion Checklist

## While Phase 2A final audit runs

- [x] GitHub repository created and connected
- [x] Dataset/label architecture defined
- [x] Demo holdout races defined
- [x] Demo battle narrative selected
- [x] Final pitch structure prepared
- [x] Judge Q&A prepared
- [x] Stitch master UI prompt sent
- [x] Colab EDA notebook template prepared
- [x] README V2 draft prepared
- [x] Demo runbook prepared
- [x] Frontend/backend DecisionSnapshot contract prepared

## Manual setup still useful now

Create this Google Drive structure:

```text
KYNTRA/
├── datasets/
├── notebooks/
├── models/
├── experiments/
├── figures/
├── demo/
└── competition/
```

Then:
- upload `KYNTRA_01_OVERTAKE_EDA.ipynb` into `notebooks/`
- do NOT upload the dataset until the final same-lap audit is approved
- export Stitch screens / design link when ready

## After Antigravity final same-lap audit

If PASS:
1. review updated dataset counts
2. commit Phase 2A code/report changes
3. push GitHub
4. copy final `kyntra_overtake_dataset.parquet` to Drive `/KYNTRA/datasets/`
5. run Colab EDA
6. review EDA before baseline ML

If FAIL:
1. fix/regenerate dataset
2. rerun QA
3. do not train until PASS

## Next technical sequence

```text
Final dataset audit
→ Colab 01 EDA
→ Colab 02 Logistic Regression
→ Colab 03 XGBoost/LightGBM
→ Probability calibration
→ Retention model
→ Energy × Overtake fusion
→ Counterfactual strategy engine
→ Stitch UI implementation
→ Demo hardening
```
