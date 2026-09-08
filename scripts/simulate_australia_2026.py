#!/usr/bin/env python3
"""Run regulation-constrained Energy Simulator V1 over 2026 Australian GP telemetry.

Usage:
    python scripts/simulate_australia_2026.py
    python scripts/simulate_australia_2026.py --driver 63 --initial-energy 0.50
"""

import argparse
import logging
from pathlib import Path
import sys
import duckdb
import pandas as pd

# Add src to sys.path to allow execution without explicit editable install
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from kyntra.energy.actions import TacticalAction  # noqa: E402
from kyntra.energy.simulator import EnergySimulator  # noqa: E402
from kyntra.ingestion.cache import configure_cache  # noqa: E402
from kyntra.ingestion.loader import load_session  # noqa: E402
from kyntra.ingestion.telemetry import extract_driver_telemetry  # noqa: E402
from kyntra.regulations.loader import load_event_config, load_fia_2026_config  # noqa: E402


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Simulate FIA 2026 Energy Store dynamics over real 2026 Australian GP telemetry."
    )
    parser.add_argument(
        "--driver",
        type=str,
        default="63",
        help="Driver code or number (default: '63' - George Russell)",
    )
    parser.add_argument(
        "--laps",
        type=int,
        nargs="+",
        default=[2, 3, 4, 5, 6],
        help="List of representative racing laps to simulate (default: laps 2 through 6)",
    )
    parser.add_argument(
        "--initial-energy",
        type=float,
        default=0.50,
        help="Starting scenario energy fraction [0.0 - 1.0] (default: 0.50 = 2.0 MJ)",
    )
    parser.add_argument(
        "--action",
        type=str,
        default="DEPLOY",
        choices=["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"],
        help="Default tactical deployment policy (default: 'DEPLOY')",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Custom output parquet path (default: data/processed/2026_australia_energy_trace.parquet)",
    )
    return parser.parse_args()


def main():
    setup_logging()
    args = parse_args()

    cache_dir = PROJECT_ROOT / "data" / "cache"
    configure_cache(cache_dir)

    print("\n" + "=" * 75)
    print(">> KYNTRA PHASE 1.2A: 2026 ENERGY SIMULATION OVER REAL TELEMETRY")
    print("=" * 75)
    print(f"Python Runtime      : {sys.version.split()[0]} ({sys.executable})")
    print(f"Target Event        : 2026 Australian Grand Prix (Round 1) — Race Session")
    print(f"Target Driver       : #{args.driver}")
    print(f"Simulated Laps      : {args.laps}")
    print(f"Initial Scenario SOC: {args.initial_energy * 100:.1f}% ({args.initial_energy * 4.0:.2f} MJ / 4.0 MJ)")
    print(f"Tactical Policy     : {args.action}")

    # 1. Load Session with telemetry
    print("\n[Ingestion] Loading 2026 Australian GP session with telemetry enabled...")
    session = load_session(
        year=2026,
        grand_prix=1,
        session_type="R",
        cache_dir=cache_dir,
        load_telemetry=True,
    )

    # 2. Extract driver telemetry
    print(f"[Ingestion] Extracting raw telemetry channels for driver {args.driver} across laps {args.laps}...")
    telemetry_df = extract_driver_telemetry(
        session=session,
        driver=args.driver,
        lap_numbers=args.laps,
    )
    print(f"[Ingestion] Successfully extracted {len(telemetry_df)} telemetry timepoints.")

    # 3. Load FIA 2026 Regulations and Official Event Config
    reg_config = load_fia_2026_config()
    event_config = load_event_config("2026_australia")
    print(f"\n[Regulations] Loaded {reg_config.name}")
    print(f"              Technical: {reg_config.provenance.document} ({reg_config.provenance.issue}, {reg_config.provenance.publication_date})")
    print(f"              Sporting : {reg_config.provenance.sporting_document} ({reg_config.provenance.sporting_issue})")
    print(f"[Event Config] Loaded {event_config.name} (Source: {event_config.provenance.document if event_config.provenance else 'Verified'})")
    print(f"               Recharge Limits: Overtake Inactive = {event_config.race_recharge_limit_mj.overtake_inactive} MJ, Active = {event_config.race_recharge_limit_mj.overtake_active} MJ")
    print(f"               Detection Line : {event_config.detection_line.loop} ({event_config.detection_line.distance_m:.0f}m, Status: {event_config.detection_line.source_status})")

    # 4. Run Simulator with Event Configuration
    simulator = EnergySimulator(regulation_config=reg_config, event_config=event_config)
    action_enum = TacticalAction(args.action)

    print(f"\n[Simulation] Advancing EnergySimulator V1 across {len(telemetry_df)} timepoints...")
    trace_df = simulator.simulate_telemetry_trace(
        telemetry_df=telemetry_df,
        driver=args.driver,
        initial_energy_fraction=args.initial_energy,
        default_action=action_enum,
    )

    # 5. Export to Parquet
    out_path = Path(args.output) if args.output else (PROJECT_ROOT / "data" / "processed" / "2026_australia_energy_trace.parquet")
    old_path = out_path.with_name("2026_australia_energy_trace_old.parquet")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"\n[Export] Exporting corrected energy trace dataset to: {out_path.resolve()}")
    trace_df.to_parquet(out_path, engine="pyarrow", index=False)
    print("[Export] Parquet export complete.")

    # 6. Verify with DuckDB
    con = duckdb.connect()
    duck_count = con.execute(f"SELECT COUNT(*) FROM '{out_path.as_posix()}'").fetchone()[0]
    print(f"[Verification] DuckDB verified: {duck_count} simulation rows successfully read from parquet.")

    # 7. Summary Metrics
    min_energy = trace_df["simulated_energy_available_mj"].min()
    max_energy = trace_df["simulated_energy_available_mj"].max()
    total_harvested = trace_df["simulated_harvest_mj"].sum()
    total_deployed = trace_df["simulated_deployment_mj"].sum()
    violations_prevented = (trace_df["compliance_result"] != "ALLOWED").sum()

    print("\n" + "=" * 75)
    print("CORRECTED ENERGY SIMULATION TRACE SUMMARY")
    print("=" * 75)
    print(f"Parquet Path              : {out_path.resolve()}")
    print(f"Dataset Shape             : {trace_df.shape[0]} rows x {trace_df.shape[1]} columns")
    print(f"Min Simulated Energy      : {min_energy:.4f} MJ ({min_energy/4.0*100:.1f}% usable window)")
    print(f"Max Simulated Energy      : {max_energy:.4f} MJ ({max_energy/4.0*100:.1f}% usable window)")
    print(f"Total Harvested (MGU-K)   : {total_harvested:.4f} MJ across {len(args.laps)} laps (Avg {total_harvested/len(args.laps):.2f} MJ/lap)")
    print(f"Total Deployed (MGU-K)    : {total_deployed:.4f} MJ across {len(args.laps)} laps (Avg {total_deployed/len(args.laps):.2f} MJ/lap)")
    print(f"Compliance Interventions  : {violations_prevented} illegal actions prevented by compliance engine")

    # 8. Comparison with OLD TRACE if available
    if old_path.exists():
        old_df = pd.read_parquet(old_path)
        old_min_e = old_df["simulated_energy_available_mj"].min()
        old_max_e = old_df["simulated_energy_available_mj"].max()
        old_harvest = old_df["simulated_harvest_mj"].sum()
        old_deploy = old_df["simulated_deployment_mj"].sum()
        old_violations = (old_df["compliance_result"] != "ALLOWED").sum()

        energy_diff = trace_df["simulated_energy_available_mj"] - old_df["simulated_energy_available_mj"]
        mean_abs_diff = energy_diff.abs().mean()
        max_abs_diff = energy_diff.abs().max()
        rmse_diff = (energy_diff ** 2).mean() ** 0.5

        print("\n" + "=" * 75)
        print("OLD TRACE vs CORRECTED TRACE COMPARISON")
        print("=" * 75)
        print(f"{'Metric':<30} | {'Old Trace':<18} | {'Corrected Trace':<18} | {'Delta':<12}")
        print("-" * 85)
        print(f"{'Total Harvested (MJ)':<30} | {old_harvest:<18.4f} | {total_harvested:<18.4f} | {total_harvested - old_harvest:+<12.4f}")
        print(f"{'Total Deployed (MJ)':<30} | {old_deploy:<18.4f} | {total_deployed:<18.4f} | {total_deployed - old_deploy:+<12.4f}")
        print(f"{'Min Energy (MJ)':<30} | {old_min_e:<18.4f} | {min_energy:<18.4f} | {min_energy - old_min_e:+<12.4f}")
        print(f"{'Max Energy (MJ)':<30} | {old_max_e:<18.4f} | {max_energy:<18.4f} | {max_energy - old_max_e:+<12.4f}")
        print(f"{'Compliance Interventions':<30} | {old_violations:<18} | {violations_prevented:<18} | {violations_prevented - old_violations:+<12}")
        print("-" * 85)
        print(f"Energy Trajectory Mean Absolute Delta : {mean_abs_diff:.4f} MJ")
        print(f"Energy Trajectory Max Absolute Delta  : {max_abs_diff:.4f} MJ")
        print(f"Energy Trajectory RMSE Delta          : {rmse_diff:.4f} MJ")

    print("\nFirst 20 Simulation Rows:")
    display_cols = [
        "lap",
        "speed",
        "throttle",
        "brake",
        "action",
        "simulated_energy_available_mj",
        "simulated_energy_fraction",
        "simulated_harvest_mj",
        "simulated_deployment_mj",
        "compliance_result",
    ]
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 120)
    print(trace_df[display_cols].head(20).to_string(index=False))

    print("\n" + "=" * 75)
    print("KYNTRA Phase 1.2A-R hotfix simulation completed successfully.")
    print("=" * 75)



if __name__ == "__main__":
    main()
