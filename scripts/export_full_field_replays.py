import os
import shutil
import time
from pathlib import Path
import numpy as np
import pandas as pd
import fastf1

fastf1_cache = Path("data/cache")
fastf1.Cache.enable_cache(str(fastf1_cache))

demo_dir = Path("data/demo")
backup_dir = demo_dir / "backup_single_pair"
backup_dir.mkdir(parents=True, exist_ok=True)

events = [
    {
        "event_id": "2026_13_ITA",
        "round": 13,
        "name": "Italian Grand Prix",
        "filename": "2026_italy_replay.parquet",
    },
    {
        "event_id": "2026_01_AUS",
        "round": 1,
        "name": "Australian Grand Prix",
        "filename": "2026_australia_replay.parquet",
    },
    {
        "event_id": "2026_04_MIA",
        "round": 4,
        "name": "Miami Grand Prix",
        "filename": "2026_miami_replay.parquet",
    },
    {
        "event_id": "2026_03_JPN",
        "round": 3,
        "name": "Japanese Grand Prix",
        "filename": "2026_japan_replay.parquet",
    },
]

summary_report = {}

for ev in events:
    out_path = demo_dir / ev["filename"]
    if out_path.exists():
        backup_path = backup_dir / ev["filename"]
        if not backup_path.exists():
            shutil.copy2(out_path, backup_path)
            print(f"Backed up original {ev['filename']} to {backup_path}")

    print(f"\n==========================================")
    print(f"Processing {ev['event_id']} ({ev['name']}, Round {ev['round']})...")
    print(f"==========================================")

    t0 = time.time()
    session = fastf1.get_session(2026, ev["round"], "R")
    session.load(telemetry=True, laps=True, weather=False, messages=False)

    drivers_in_session = [str(d) for d in session.drivers]
    print(f"Session drivers ({len(drivers_in_session)}): {drivers_in_session}")

    driver_samples = []
    drivers_with_valid_xy = []

    for drv in drivers_in_session:
        try:
            drv_laps = session.laps.pick_drivers(drv) if hasattr(session.laps, "pick_drivers") else session.laps.pick_driver(drv)
            if drv_laps.empty:
                continue
            tel = drv_laps.get_telemetry()
            if tel.empty:
                continue

            # Sample every 8th sample (~1.5-2 Hz resolution)
            sampled = tel.iloc[::8].copy()
            sampled["driver"] = drv
            sampled["event_id"] = ev["event_id"]

            # Map to lap, compound, tyre_life by SessionTime
            if "Time" in drv_laps.columns and not drv_laps["Time"].empty:
                lap_ends = drv_laps["Time"].values
                lap_nums = drv_laps["LapNumber"].values
                compounds = drv_laps["Compound"].values if "Compound" in drv_laps.columns else np.array(["MEDIUM"] * len(lap_nums))
                tyre_lives = drv_laps["TyreLife"].values if "TyreLife" in drv_laps.columns else np.array([1] * len(lap_nums))

                tel_times = sampled["SessionTime"].values
                idx = np.searchsorted(lap_ends, tel_times, side="right")
                idx = np.clip(idx, 0, len(lap_nums) - 1)

                sampled["lap"] = lap_nums[idx]
                sampled["compound"] = compounds[idx]
                sampled["tyre_life"] = tyre_lives[idx]
            else:
                sampled["lap"] = 1
                sampled["compound"] = "MEDIUM"
                sampled["tyre_life"] = 1

            # Check valid X, Y
            if "X" in sampled.columns and "Y" in sampled.columns:
                valid_count = len(sampled[sampled["X"].notna() & sampled["Y"].notna()])
                if valid_count > 0:
                    drivers_with_valid_xy.append(drv)

            driver_samples.append(sampled)
        except Exception as exc:
            print(f"Driver {drv} extraction note: {exc}")
            continue

    if not driver_samples:
        print(f"WARNING: No driver samples extracted for {ev['event_id']}")
        continue

    combined = pd.concat(driver_samples, ignore_index=True)

    # Standard keep columns
    standard_cols = [
        "event_id", "lap", "driver", "Time", "SessionTime", "Distance",
        "Speed", "Throttle", "Brake", "nGear", "RPM",
        "X", "Y", "Z", "DriverAhead", "DistanceToDriverAhead", "compound", "tyre_life"
    ]
    keep_cols = [c for c in standard_cols if c in combined.columns]
    out_df = combined[keep_cols].copy()

    # Convert timedeltas to float seconds
    for col in ["Time", "SessionTime"]:
        if col in out_df.columns:
            out_df[col] = out_df[col].apply(
                lambda x: x.total_seconds() if pd.notna(x) and hasattr(x, "total_seconds") else (float(x) if pd.notna(x) else None)
            )

    out_df.to_parquet(out_path, engine="pyarrow", index=False)
    file_size_mb = out_path.stat().st_size / (1024 * 1024)

    summary_report[ev["event_id"]] = {
        "event_name": ev["name"],
        "file": ev["filename"],
        "rows": len(out_df),
        "drivers_exported": out_df["driver"].nunique(),
        "drivers_list": out_df["driver"].unique().tolist(),
        "laps": f"{out_df['lap'].min()} to {out_df['lap'].max()} ({out_df['lap'].nunique()} unique)",
        "file_size_mb": round(file_size_mb, 2),
        "elapsed_seconds": round(time.time() - t0, 2),
    }
    print(f"Exported {ev['event_id']}: {len(out_df)} rows, {out_df['driver'].nunique()} drivers, {file_size_mb:.2f} MB in {time.time() - t0:.2f}s")

print("\n\n=== REPLAY EXPORT SUMMARY ===")
import json
print(json.dumps(summary_report, indent=2))
