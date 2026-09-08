#!/usr/bin/env python3
"""Export the frozen KYNTRA V1 overtake models and deployment bundle.

Refits the validated LightGBM specification on the 9 development events
(7 TRAIN + 2 VALIDATION), keeping demo holdouts (AUS, JPN, MIA, ITA) untouched.
Follows the exact code from KYNTRA_06_EXPORT_DEPLOYMENT_MODELS.ipynb.
"""

import hashlib
import json
from pathlib import Path
import joblib
from lightgbm import LGBMClassifier
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "kyntra_overtake_dataset.parquet"
MODELS_DIR = PROJECT_ROOT / "models"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def export_models():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    assert DATA_PATH.exists(), f"Dataset file not found: {DATA_PATH}"

    df = pd.read_parquet(DATA_PATH)
    assert len(df) == 8357, f"Unexpected row count: {len(df)}"
    assert df["observation_id"].is_unique, "Duplicate observation IDs found!"

    # Only the 9 development events in TRAIN and VALIDATION
    dev = df[df["split"].isin(["TRAIN", "VALIDATION"])].copy()
    dev_events = sorted(dev["event_id"].unique().tolist())
    expected_dev_events = [
        "2026_02_CHN",
        "2026_05_CAN",
        "2026_06_MCO",
        "2026_07_ESP",
        "2026_08_AUT",
        "2026_09_GBR",
        "2026_10_BEL",
        "2026_11_HUN",
        "2026_12_NLD",
    ]
    assert dev_events == expected_dev_events, f"Dev events mismatch: {dev_events}"
    print(f"Development rows: {len(dev)} across {len(dev_events)} events")

    # Features and specification
    features = [
        "gap_seconds",
        "closing_rate",
        "recent_pace_delta_1lap",
        "recent_pace_delta_3laps",
        "speed_trap_delta",
    ]

    horizons = {
        1: {"target": "overtake_next_1_lap", "censor": "censored_1_lap"},
        2: {"target": "overtake_next_2_laps", "censor": "censored_2_laps"},
        3: {"target": "overtake_next_3_laps", "censor": "censored_3_laps"},
    }

    model_spec = {
        "objective": "binary",
        "n_estimators": 250,
        "learning_rate": 0.03,
        "num_leaves": 7,
        "max_depth": 3,
        "min_child_samples": 50,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "reg_alpha": 0.5,
        "reg_lambda": 2.0,
        "random_state": 42,
        "verbosity": -1,
        "monotone_constraints": [-1, 0, 0, 0, 0],
    }

    models = {}
    training_stats = {}

    for h, cfg in horizons.items():
        usable = dev[dev[cfg["censor"]] != 1].copy()
        X = usable[features]
        y = usable[cfg["target"]].astype(int)

        model = LGBMClassifier(**model_spec)
        model.fit(X, y)

        models[h] = model
        training_stats[h] = {
            "usable_rows": int(len(usable)),
            "positives": int(y.sum()),
            "prevalence": float(y.mean()),
            "events": int(usable["event_id"].nunique()),
        }

        print(
            f"H{h}: rows={len(usable)} positives={int(y.sum())} "
            f"prevalence={y.mean():.6f}"
        )

        # Export individual horizon model
        h_path = MODELS_DIR / f"kyntra_overtake_h{h}_v1.joblib"
        joblib.dump(model, h_path)
        print(f"Saved: {h_path.name}")

    # Export bundle
    bundle = {
        "models": models,
        "features": features,
        "model_spec": model_spec,
        "probability_method": "raw LightGBM probabilities + deterministic per-observation monotonic horizon projection",
        "training_stats": training_stats,
    }
    bundle_path = MODELS_DIR / "kyntra_overtake_bundle_v1.joblib"
    joblib.dump(bundle, bundle_path)
    print(f"Saved: {bundle_path.name}")

    # Export metadata
    metadata = {
        "model_name": "KYNTRA Overtake Intelligence V1",
        "model_family": "LightGBM",
        "horizons_laps": [1, 2, 3],
        "features": features,
        "model_spec": model_spec,
        "probability_method": "raw LightGBM probabilities + deterministic per-observation monotonic horizon projection",
        "deployment_refit_events": dev_events,
        "training_stats": training_stats,
        "final_validation_events_used_before_refit": [
            "2026_11_HUN",
            "2026_12_NLD",
        ],
        "demo_holdouts_untouched": [
            "2026_01_AUS",
            "2026_03_JPN",
            "2026_04_MIA",
            "2026_13_ITA",
        ],
        "limitations": [
            "Historical public telemetry only.",
            "No private Formula 1 battery SOC or team ERS telemetry.",
            "Censored race states are excluded horizon-by-horizon in the classifier.",
            "No standalone retention ML model in V1.",
            "Monaco-like low-overtake processions remain a known hard regime.",
        ],
        "bundle_sha256": sha256_file(bundle_path),
    }

    meta_path = MODELS_DIR / "kyntra_overtake_model_v1_metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved: {meta_path.name}")
    print("Deployment model export completed successfully.")


if __name__ == "__main__":
    export_models()
