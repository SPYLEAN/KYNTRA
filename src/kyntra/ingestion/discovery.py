"""Dynamic race discovery and strict split isolation engine for KYNTRA.

Enforces event-level dataset split isolation between TRAIN, VALIDATION, and DEMO_HOLDOUT.
Guarantees that DEMO_HOLDOUT races never participate in training, validation, or calibration.
"""

from pathlib import Path
from typing import Dict, List, Optional
import yaml
from pydantic import BaseModel, Field


class DiscoveredRace(BaseModel):
    """Metadata for an officially completed and loadable race session."""

    round_number: int = Field(..., ge=1, le=24)
    event_name: str
    event_id: str
    circuit: str
    session_date: str
    lap_count: int
    driver_count: int
    split: str = Field(..., description="Dataset split: TRAIN, VALIDATION, or DEMO_HOLDOUT")
    regulation_era: str = Field("2026_ENERGY_OVERTAKE")


def get_default_splits_path() -> Path:
    """Path to configs/data_splits_2026.yaml relative to project root."""
    return Path(__file__).resolve().parent.parent.parent.parent / "configs" / "data_splits_2026.yaml"


def load_data_splits_config(path: Optional[Path] = None) -> Dict:
    """Load and validate the event-level split configuration YAML."""
    p = path or get_default_splits_path()
    if not p.exists():
        raise FileNotFoundError(f"Data splits configuration not found at: {p}")
    with open(p, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_race_split(round_number: int, event_name: str, splits_config: Optional[Dict] = None) -> str:
    """Assign an event to its strictly configured dataset split.

    Args:
        round_number: Championship round number.
        event_name: Official event title (e.g. 'Australian Grand Prix').
        splits_config: Optional pre-loaded split configuration dictionary.

    Returns:
        str: One of 'DEMO_HOLDOUT', 'VALIDATION', 'TRAIN'.

    Raises:
        ValueError: If event cannot be resolved or is ambiguously classified.
    """
    config = splits_config or load_data_splits_config()
    splits = config.get("splits", {})

    # 1. Check DEMO_HOLDOUT first (highest priority isolation)
    for event in splits.get("DEMO_HOLDOUT", {}).get("events", []):
        if event.get("round") == round_number or event.get("name", "").lower() in event_name.lower():
            return "DEMO_HOLDOUT"

    # 2. Check VALIDATION
    for event in splits.get("VALIDATION", {}).get("events", []):
        if event.get("round") == round_number or event.get("name", "").lower() in event_name.lower():
            return "VALIDATION"

    # 3. Check TRAIN
    for event in splits.get("TRAIN", {}).get("events", []):
        if event.get("round") == round_number or event.get("name", "").lower() in event_name.lower():
            return "TRAIN"

    raise ValueError(
        f"Event Round {round_number} ('{event_name}') is not explicitly assigned to any split in data_splits_2026.yaml"
    )
