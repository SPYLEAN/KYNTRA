#!/usr/bin/env python3
"""Build and export normalized race lap dataset for KYNTRA.

Usage:
    python scripts/build_race.py
    python scripts/build_race.py --year 2024 --grand-prix Bahrain --session R
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

from kyntra.ingestion.cache import configure_cache  # noqa: E402
from kyntra.ingestion.loader import load_session  # noqa: E402
from kyntra.processing.normalizer import normalize_laps  # noqa: E402
from kyntra.processing.validation import generate_validation_report  # noqa: E402


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def setup_logging():
    """Configure console logging format."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Ingest and normalize real Formula 1 session data using FastF1 for KYNTRA."
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2024,
        help="Championship season year (default: 2024)",
    )
    parser.add_argument(
        "--grand-prix",
        type=str,
        default="Bahrain",
        help="Grand Prix name or round number (default: 'Bahrain')",
    )
    parser.add_argument(
        "--session",
        type=str,
        default="R",
        help="Session type code (default: 'R' for Race)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Custom output parquet path (default: data/processed/{year}_{gp_slug}_race_laps.parquet)",
    )
    return parser.parse_args()


def build_race_dataset(year: int, grand_prix: str, session_type: str, output_path: Path) -> pd.DataFrame:
    """Run full ingestion, normalization, validation, and parquet export pipeline."""
    cache_dir = PROJECT_ROOT / "data" / "cache"
    configure_cache(cache_dir)

    print("\n" + "=" * 70)
    print(f">> STARTING KYNTRA INGESTION: {year} {grand_prix} (Session '{session_type}')")
    print("=" * 70)

    # 1. Ingestion
    session = load_session(
        year=year,
        grand_prix=grand_prix,
        session_type=session_type,
        cache_dir=cache_dir,
    )

    # 2. Normalization
    print("\n[Processing] Normalizing lap-level data...")
    normalized_df = normalize_laps(session)

    # 3. Validation
    print("\n[Validation] Running dataset validation checks...")
    report = generate_validation_report(normalized_df)
    print("\n" + report.summary_text())

    # 4. Parquet Export
    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"\n[Export] Exporting normalized dataset to: {output_path.resolve()}")
    normalized_df.to_parquet(output_path, engine="pyarrow", index=False)
    print("[Export] Parquet export complete.")

    # 5. Zero-loss verification with DuckDB
    print("\n[Verification] Querying Parquet via DuckDB engine...")
    con = duckdb.connect()
    duck_count = con.execute(f"SELECT COUNT(*) FROM '{output_path.as_posix()}'").fetchone()[0]
    duck_drivers = con.execute(
        f"SELECT COUNT(DISTINCT Driver) FROM '{output_path.as_posix()}'"
    ).fetchone()[0]
    print(f"[Verification] DuckDB verified: {duck_count} rows, {duck_drivers} distinct drivers successfully read.")

    return normalized_df


def main():
    setup_logging()
    args = parse_args()

    # Determine output path
    if args.output:
        out_path = Path(args.output).resolve()
    else:
        slug = args.grand_prix.lower().replace(" ", "_")
        out_path = PROJECT_ROOT / "data" / "processed" / f"{args.year}_{slug}_race_laps.parquet"

    try:
        df = build_race_dataset(
            year=args.year,
            grand_prix=args.grand_prix,
            session_type=args.session,
            output_path=out_path,
        )
    except Exception as exc:
        print("\n" + "!" * 70)
        print(f"PIPELINE INGESTION ERROR: {exc}")
        print("!" * 70)
        print(f"[Notice] Data for {args.year} {args.grand_prix} ({args.session}) could not be ingested.")
        print("[Notice] Existing datasets in data/processed/ remain untouched.")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("DATASET SUMMARY & PREVIEW")
    print("=" * 70)
    print(f"Exact Parquet Path : {out_path.resolve()}")
    print(f"Dataset Shape      : {df.shape[0]} rows x {df.shape[1]} columns")
    print(f"Column Names ({len(df.columns)}):")
    for i, col in enumerate(df.columns, 1):
        dtype = str(df[col].dtype)
        print(f"  {i:>2}. {col:<18} ({dtype})")

    print("\nFirst 10 Rows:")
    # Set pandas display options for clean terminal output
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 120)
    preview_cols = [
        "Driver",
        "LapNumber",
        "Position",
        "LapTime",
        "Sector1Time",
        "Sector2Time",
        "Sector3Time",
        "Compound",
        "TyreLife",
        "Stint",
        "TrackStatus",
    ]
    print(df[preview_cols].head(10).to_string(index=False))

    print("\n" + "=" * 70)
    print("KYNTRA Phase 1 pipeline completed successfully.")
    print("=" * 70)


if __name__ == "__main__":
    main()
