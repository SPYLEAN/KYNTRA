"""Unit tests verifying Phase 2A Overtake Intelligence Dataset integrity and amendments.

Verifies:
1. Battle sequences cannot cross dataset splits.
2. Demo holdout races cannot enter TRAIN or VALIDATION.
3. One observation_id cannot appear twice (strictly unique).
4. Positive labels resolve to a verified overtake_event_id with traceability.
5. Same-lap pass/repass can be represented with full durability tracking.
6. Retention labels are conditional on a verified pass occurring.
7. Retention censoring works when interrupted by pit/retirement/neutralization.
8. No future/target columns enter the model-eligible feature list.
"""

from datetime import timedelta
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
import yaml

from kyntra.features.extractor import extract_race_features
from kyntra.features.pairs import BattleSequenceManager, extract_adjacent_pairs
from kyntra.ingestion.discovery import load_data_splits_config
from kyntra.labels.overtakes import (
    OvertakeEvent,
    compute_multi_horizon_labels_and_censoring,
    compute_position_retention_labels,
    detect_race_overtakes,
)


@pytest.fixture
def data_splits_config():
    """Load split configuration."""
    return load_data_splits_config()


@pytest.fixture
def model_features_config():
    """Load model feature schema."""
    config_path = Path("configs/model_features.yaml")
    assert config_path.exists()
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def test_battle_sequences_cannot_cross_dataset_splits(data_splits_config):
    """Test that battle sequences are bound strictly to their event and cannot cross dataset splits."""
    manager_train = BattleSequenceManager("2026_02_CHN")
    seq_train = manager_train.get_or_create_sequence_id("NOR", "RUS", 2)
    assert seq_train.startswith("2026_02_CHN_NOR_RUS_")

    manager_val = BattleSequenceManager("2026_11_HUN")
    seq_val = manager_val.get_or_create_sequence_id("NOR", "RUS", 2)
    assert seq_val.startswith("2026_11_HUN_NOR_RUS_")

    # The sequence IDs for different events (in different splits) are completely distinct
    assert seq_train != seq_val

    # If dataset exists, verify across the whole dataset
    dataset_path = Path("data/processed/kyntra_overtake_dataset.parquet")
    if dataset_path.exists():
        df = pd.read_parquet(dataset_path)
        split_counts = df.groupby("battle_sequence_id")["split"].nunique()
        assert (split_counts == 1).all(), "Found battle_sequence_id spanning multiple splits!"


def test_demo_races_cannot_enter_train_or_validation(data_splits_config):
    """Test that demo holdout races are strictly prohibited from TRAIN and VALIDATION."""
    demo_events = data_splits_config["splits"]["DEMO_HOLDOUT"]["events"]
    demo_ids = {e["event_id"] for e in demo_events}
    assert "2026_01_AUS" in demo_ids
    assert "2026_03_JPN" in demo_ids
    assert "2026_04_MIA" in demo_ids
    assert "2026_13_ITA" in demo_ids

    # Config eligibility flags
    assert data_splits_config["splits"]["DEMO_HOLDOUT"]["eligible_for_training"] is False
    assert data_splits_config["splits"]["DEMO_HOLDOUT"]["eligible_for_validation"] is False

    # Check that TRAIN and VALIDATION contain no demo events
    train_ids = {e["event_id"] for e in data_splits_config["splits"]["TRAIN"]["events"]}
    val_ids = {e["event_id"] for e in data_splits_config["splits"]["VALIDATION"]["events"]}
    assert len(demo_ids.intersection(train_ids)) == 0
    assert len(demo_ids.intersection(val_ids)) == 0

    # If dataset exists, verify 0 rows from demo events
    dataset_path = Path("data/processed/kyntra_overtake_dataset.parquet")
    if dataset_path.exists():
        df = pd.read_parquet(dataset_path)
        demo_in_dataset = df[df["event_id"].isin(demo_ids)]
        assert len(demo_in_dataset) == 0, "Demo holdout rows leaked into primary dataset!"


def test_one_observation_id_cannot_appear_twice():
    """Test that observation_id is strictly unique across all candidate pairs."""
    dataset_path = Path("data/processed/kyntra_overtake_dataset.parquet")
    if dataset_path.exists():
        df = pd.read_parquet(dataset_path)
        assert "observation_id" in df.columns
        assert df["observation_id"].is_unique, "Duplicate observation_id detected in dataset!"


def test_positive_labels_resolve_to_verified_overtake_event_id():
    """Test that positive overtake labels retain full traceability to verified overtake events."""
    # Synthetic verification
    laps_data = [
        {"Driver": "LEC", "LapNumber": 2, "Position": 1.0, "LapTime": pd.Timedelta(seconds=90), "TrackStatus": "1"},
        {"Driver": "SAI", "LapNumber": 2, "Position": 2.0, "LapTime": pd.Timedelta(seconds=90.5), "TrackStatus": "1"},
        {"Driver": "SAI", "LapNumber": 3, "Position": 1.0, "LapTime": pd.Timedelta(seconds=89.0), "TrackStatus": "1"},
        {"Driver": "LEC", "LapNumber": 3, "Position": 2.0, "LapTime": pd.Timedelta(seconds=91.0), "TrackStatus": "1"},
    ]
    laps_df = pd.DataFrame(laps_data)
    event_id = "2026_TEST"

    verified_ot, _, _ = detect_race_overtakes(laps_df, event_id)
    assert len(verified_ot) == 1
    assert verified_ot[0].overtake_event_id == "OT_2026_TEST_L003_SAI_LEC"

    pairs_df = pd.DataFrame([{
        "observation_id": "2026_TEST_002_SAI_LEC",
        "battle_sequence_id": "2026_TEST_SAI_LEC_001",
        "event_id": event_id,
        "lap": 2,
        "attacker": "SAI",
        "defender": "LEC",
        "attacker_position": 2,
        "defender_position": 1,
    }])

    labeled = compute_multi_horizon_labels_and_censoring(pairs_df, verified_ot, laps_df, max_laps_in_race=3)
    assert labeled["overtake_next_1_lap"].iloc[0] == 1
    assert labeled["overtake_event_id"].iloc[0] == "OT_2026_TEST_L003_SAI_LEC"
    assert labeled["overtake_event_lap"].iloc[0] == 3
    assert labeled["overtake_event_attacker"].iloc[0] == "SAI"
    assert labeled["overtake_event_defender"].iloc[0] == "LEC"
    assert labeled["overtake_confidence"].iloc[0] == 1.0


def test_same_lap_pass_repass_representation():
    """Test that same-lap pass/repass events are detected and represented without disappearing."""
    # Lap 2: VER is P1, NOR is P2 (NOR chasing VER)
    # Lap 3: NOR passes VER at Sector 1, but VER re-passes NOR before finish line (VER finishes P1, NOR P2)
    laps_data = [
        {
            "Driver": "VER", "LapNumber": 2, "Position": 1.0, "TrackStatus": "1",
            "LapTime": pd.Timedelta(seconds=90),
            "Sector1SessionTime": pd.Timedelta(seconds=1000), "Sector2SessionTime": pd.Timedelta(seconds=1030),
            "Time": pd.Timedelta(seconds=1060),
        },
        {
            "Driver": "NOR", "LapNumber": 2, "Position": 2.0, "TrackStatus": "1",
            "LapTime": pd.Timedelta(seconds=90.4),
            "Sector1SessionTime": pd.Timedelta(seconds=1000.4), "Sector2SessionTime": pd.Timedelta(seconds=1030.4),
            "Time": pd.Timedelta(seconds=1060.4),
        },
        {
            "Driver": "VER", "LapNumber": 3, "Position": 1.0, "TrackStatus": "1",
            "LapTime": pd.Timedelta(seconds=90),
            "Sector1SessionTime": pd.Timedelta(seconds=1090.5),  # Crossed S1 at 1090.5s
            "Sector2SessionTime": pd.Timedelta(seconds=1120.0),
            "Time": pd.Timedelta(seconds=1150.0),
        },
        {
            "Driver": "NOR", "LapNumber": 3, "Position": 2.0, "TrackStatus": "1",
            "LapTime": pd.Timedelta(seconds=90.2),
            "Sector1SessionTime": pd.Timedelta(seconds=1090.0),  # Crossed S1 at 1090.0s (AHEAD of VER!)
            "Sector2SessionTime": pd.Timedelta(seconds=1120.2),
            "Time": pd.Timedelta(seconds=1150.2),
        },
    ]
    laps_df = pd.DataFrame(laps_data)
    event_id = "2026_TEST"

    verified_ot, _, stats = detect_race_overtakes(laps_df, event_id)

    # Must detect both the pass and the re-pass
    assert stats["same_lap_candidates_discovered"] >= 1
    assert stats["same_lap_candidates_verified"] >= 1

    ot_pass = next((ot for ot in verified_ot if ot.attacker == "NOR" and ot.defender == "VER" and ot.is_same_lap), None)
    ot_repass = next((ot for ot in verified_ot if ot.attacker == "VER" and ot.defender == "NOR" and ot.is_same_lap), None)

    assert ot_pass is not None, "Same-lap pass was not detected!"
    assert ot_repass is not None, "Same-lap re-pass was not detected!"
    assert ot_pass.is_same_lap is True

    # Now verify multi-horizon labels at Lap 2: NOR was chasing VER
    pairs_df = pd.DataFrame([{
        "observation_id": "2026_TEST_002_NOR_VER",
        "battle_sequence_id": "2026_TEST_NOR_VER_001",
        "event_id": event_id,
        "lap": 2,
        "attacker": "NOR",
        "defender": "VER",
        "attacker_position": 2,
        "defender_position": 1,
    }])

    labeled = compute_multi_horizon_labels_and_censoring(pairs_df, verified_ot, laps_df, max_laps_in_race=3)
    # The pass must NOT disappear!
    assert labeled["overtake_next_1_lap"].iloc[0] == 1
    assert labeled["overtake_event_id"].iloc[0] == ot_pass.overtake_event_id

    # Now verify retention: Since VER re-passed NOR in the same lap, at Lap 3 finish VER is ahead
    ret = compute_position_retention_labels(labeled, verified_ot, laps_df, max_laps_in_race=3)
    assert ret["retained_position_1_lap"].iloc[0] == 0  # Position was NOT retained
    assert ret["repassed_within_1_lap"].iloc[0] == 1   # Re-passed by defender within 1 lap
    assert bool(ret["retention_censored_1_lap"].iloc[0]) is False


def test_retention_labels_are_conditional_on_verified_pass():
    """Test that retention targets are None (NaN) when no pass occurred."""
    laps_data = [
        {"Driver": "VER", "LapNumber": 2, "Position": 1.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=90)},
        {"Driver": "HAM", "LapNumber": 2, "Position": 2.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=91)},
        {"Driver": "VER", "LapNumber": 3, "Position": 1.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=90)},
        {"Driver": "HAM", "LapNumber": 3, "Position": 2.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=91)},
    ]
    laps_df = pd.DataFrame(laps_data)
    pairs_df = pd.DataFrame([{
        "observation_id": "2026_TEST_002_HAM_VER",
        "battle_sequence_id": "2026_TEST_HAM_VER_001",
        "event_id": "2026_TEST",
        "lap": 2,
        "attacker": "HAM",
        "defender": "VER",
        "overtake_next_1_lap": 0,
        "overtake_next_2_laps": 0,
        "overtake_next_3_laps": 0,
    }])

    ret = compute_position_retention_labels(pairs_df, [], laps_df, max_laps_in_race=3)
    # Must be None/NaN because no pass occurred
    assert pd.isna(ret["retained_position_1_lap"].iloc[0])
    assert pd.isna(ret["repassed_within_1_lap"].iloc[0])
    assert bool(ret["retention_censored_1_lap"].iloc[0]) is False


def test_retention_censoring_works():
    """Test that retention censoring marks True if evaluation is truncated by pit stop or race end."""
    # Attacker passes defender on lap 3, but defender pits on lap 4
    laps_data = [
        {"Driver": "VER", "LapNumber": 2, "Position": 1.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=90)},
        {"Driver": "NOR", "LapNumber": 2, "Position": 2.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=90.5)},
        {"Driver": "NOR", "LapNumber": 3, "Position": 1.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=89.5)},
        {"Driver": "VER", "LapNumber": 3, "Position": 2.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=91.0)},
        {"Driver": "NOR", "LapNumber": 4, "Position": 1.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=89.5)},
        {"Driver": "VER", "LapNumber": 4, "Position": 2.0, "TrackStatus": "1", "LapTime": pd.Timedelta(seconds=115.0), "PitInTime": pd.Timedelta(seconds=3000)},
    ]
    laps_df = pd.DataFrame(laps_data)
    verified_ot = [
        OvertakeEvent(
            overtake_event_id="OT_2026_TEST_L003_NOR_VER",
            event_id="2026_TEST",
            lap=3,
            attacker="NOR",
            defender="VER",
            attacker_new_pos=1,
            defender_new_pos=2,
        )
    ]

    pairs_df = pd.DataFrame([{
        "observation_id": "2026_TEST_002_NOR_VER",
        "battle_sequence_id": "2026_TEST_NOR_VER_001",
        "event_id": "2026_TEST",
        "lap": 2,
        "attacker": "NOR",
        "defender": "VER",
        "overtake_next_1_lap": 1,
        "overtake_next_2_laps": 1,
        "overtake_next_3_laps": 1,
    }])

    ret = compute_position_retention_labels(pairs_df, verified_ot, laps_df, max_laps_in_race=4)
    # Horizon 1 (lap 3): clean racing lap, retained = 1
    assert ret["retained_position_1_lap"].iloc[0] == 1
    assert bool(ret["retention_censored_1_lap"].iloc[0]) is False

    # Horizon 2 (lap 4): defender pitted during interval, so retention evaluation is censored
    assert bool(ret["retention_censored_2_laps"].iloc[0]) is True
    assert pd.isna(ret["retained_position_2_laps"].iloc[0])


def test_no_future_columns_enter_model_eligible_feature_list(model_features_config):
    """Test that no outcome, future target, or provenance columns enter model_feature_eligible."""
    eligible_cols = set(model_features_config["features"]["model_feature_eligible"]["columns"])

    forbidden_patterns = [
        "overtake_next",
        "retained_position",
        "repassed_within",
        "censored",
        "retention_censored",
        "overtake_event",
        "label_source",
        "label_version",
        "label_generated_at",
        "observation_id",
        "battle_sequence_id",
    ]

    for col in eligible_cols:
        for pattern in forbidden_patterns:
            assert pattern not in col, f"Future/target column '{col}' leaked into model_feature_eligible!"
