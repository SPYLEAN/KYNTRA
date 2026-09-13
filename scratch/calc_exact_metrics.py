import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import average_precision_score, brier_score_loss

# Load frozen bundle
bundle = joblib.load('models/kyntra_overtake_bundle_v1.joblib')
models = bundle['models']
features = bundle['features']

# Load dataset
df = pd.read_parquet('data/processed/kyntra_overtake_dataset.parquet')
train_df = df[df['split'] == 'TRAIN'].copy()
val_df = df[df['split'] == 'VALIDATION'].copy()
dev_df = df[df['split'].isin(['TRAIN', 'VALIDATION'])].copy()

print("--- EVALUATING FROZEN LIGHTGBM BUNDLE ON VALIDATION SPLIT (HUN, NLD) ---")
for h in [1, 2, 3]:
    target = f'overtake_next_{h}_lap' if h == 1 else f'overtake_next_{h}_laps'
    censor = f'censored_{h}_lap' if h == 1 else f'censored_{h}_laps'
    
    # Validation split
    v_usable = val_df[val_df[censor] != 1].copy()
    X_val = v_usable[features]
    y_val = v_usable[target].astype(int)
    
    p_val = models[h].predict_proba(X_val)[:, 1]
    val_pr_auc = average_precision_score(y_val, p_val)
    val_brier = brier_score_loss(y_val, p_val)
    val_clim_brier = brier_score_loss(y_val, np.full_like(y_val, y_val.mean(), dtype=float))
    val_bss = 1.0 - (val_brier / val_clim_brier)
    
    # Close battle slice (gap <= 1.0s) on validation
    v_close = v_usable[v_usable['gap_seconds'] <= 1.0]
    X_vclose = v_close[features]
    y_vclose = v_close[target].astype(int)
    p_vclose = models[h].predict_proba(X_vclose)[:, 1]
    vclose_pr_auc = average_precision_score(y_vclose, p_vclose) if len(y_vclose) > 0 else np.nan
    
    print(f"H{h} (VALIDATION - HUN/NLD):")
    print(f"  Rows: {len(v_usable)}, Positives: {y_val.sum()} ({y_val.mean()*100:.2f}%)")
    print(f"  PR-AUC: {val_pr_auc:.4f} (Base prevalence: {y_val.mean():.4f})")
    print(f"  Tactical <=1.0s PR-AUC: {vclose_pr_auc:.4f} (n={len(v_close)}, positives={y_vclose.sum()})")
    print(f"  Brier: {val_brier:.4f} (Climatology: {val_clim_brier:.4f})")
    print(f"  Brier Skill Score (BSS): {val_bss:+.4f}")

print("\n--- EVALUATING FROZEN LIGHTGBM BUNDLE ON FULL DEV REFIT (TRAIN + VALIDATION) ---")
for h in [1, 2, 3]:
    target = f'overtake_next_{h}_lap' if h == 1 else f'overtake_next_{h}_laps'
    censor = f'censored_{h}_lap' if h == 1 else f'censored_{h}_laps'
    
    d_usable = dev_df[dev_df[censor] != 1].copy()
    X_dev = d_usable[features]
    y_dev = d_usable[target].astype(int)
    
    p_dev = models[h].predict_proba(X_dev)[:, 1]
    dev_pr_auc = average_precision_score(y_dev, p_dev)
    dev_brier = brier_score_loss(y_dev, p_dev)
    dev_clim_brier = brier_score_loss(y_dev, np.full_like(y_dev, y_dev.mean(), dtype=float))
    dev_bss = 1.0 - (dev_brier / dev_clim_brier)
    
    d_close = d_usable[d_usable['gap_seconds'] <= 1.0]
    p_dclose = models[h].predict_proba(d_close[features])[:, 1]
    y_dclose = d_close[target].astype(int)
    dclose_pr_auc = average_precision_score(y_dclose, p_dclose)
    
    print(f"H{h} (DEV REFIT - 9 Events):")
    print(f"  Rows: {len(d_usable)}, Positives: {y_dev.sum()} ({y_dev.mean()*100:.2f}%)")
    print(f"  PR-AUC: {dev_pr_auc:.4f} (Prevalence: {y_dev.mean():.4f})")
    print(f"  Tactical <=1.0s PR-AUC: {dclose_pr_auc:.4f} (n={len(d_close)}, pos={y_dclose.sum()})")
    print(f"  Brier: {dev_brier:.4f} (Climatology: {dev_clim_brier:.4f})")
    print(f"  BSS: {dev_bss:+.4f}")
