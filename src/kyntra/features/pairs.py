"""Attacker-Defender state and continuous battle sequence generation.

Generates on-track adjacent candidate pairs (Defender = Pos k, Attacker = Pos k+1)
at every valid racing lap without artificial proximity cutoffs, preserves rejection reasons,
and groups continuous chase relationships into unique battle_sequence_id blocks.
"""

from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from kyntra.processing.track_status import TrackStatusParser


class PairRejectionReason(str):
    """Reason codes for excluded candidate pair states."""

    LAP_1 = "LAP_1_START_CHAOS"
    IN_PIT_LANE = "CAR_IN_PIT_LANE"
    RETIRED = "CAR_RETIRED_OR_STOPPED"
    NEUTRALIZED_RACE = "SAFETY_CAR_OR_VSC_ACTIVE"
    LAPPED_CAR = "DIFFERENT_RACING_LAP"
    TIMING_ANOMALY = "INVALID_OR_MISSING_TIMING"


class BattleSequenceManager:
    """Manages continuous chase relationships between an attacker and defender.

    TERMINATION RULES:
    A battle sequence terminates when any of the following occur:
    1. Pair Breaks: Attacker or Defender is no longer adjacent in track position.
    2. Pit Stop: Either driver enters or exits the pit lane.
    3. Race Neutralization: Safety Car, VSC, or Red Flag interrupts racing.
    4. Retirement: Either driver retires from the session.
    5. Lap Mismatch: Either car is lapped or laps become non-consecutive (delta_lap != 1).
    6. Position Change: Attacker overtakes defender (ending the chase phase).
    """

    def __init__(self, event_code: str):
        self.event_code = event_code
        self._sequence_counters: Dict[Tuple[str, str], int] = {}
        self._active_sequences: Dict[Tuple[str, str], Tuple[str, int]] = {}  # (att, def) -> (seq_id, last_lap)

    def get_or_create_sequence_id(self, attacker: str, defender: str, current_lap: int) -> str:
        key = (str(attacker), str(defender))

        if key in self._active_sequences:
            seq_id, last_lap = self._active_sequences[key]
            # If strictly consecutive lap, continue existing sequence
            if current_lap == last_lap + 1:
                self._active_sequences[key] = (seq_id, current_lap)
                return seq_id

        # Otherwise start a new sequence
        count = self._sequence_counters.get(key, 0) + 1
        self._sequence_counters[key] = count
        new_seq_id = f"{self.event_code}_{attacker}_{defender}_{count:03d}"
        self._active_sequences[key] = (new_seq_id, current_lap)
        return new_seq_id

    def terminate_inactive(self, current_lap: int, active_pairs_this_lap: List[Tuple[str, str]]):
        """Terminate sequences that did not appear on current lap."""
        active_keys = set(active_pairs_this_lap)
        for key in list(self._active_sequences.keys()):
            if key not in active_keys:
                del self._active_sequences[key]


def extract_adjacent_pairs(
    laps_df: pd.DataFrame,
    event_id: str,
    circuit: str,
    split: str,
    season: int = 2026,
    regulation_era: str = "2026_ENERGY_OVERTAKE",
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Generate on-track adjacent candidate pairs from race laps.

    Args:
        laps_df: Normalized session laps dataframe containing Position, LapNumber, etc.
        event_id: Unique event identifier (e.g. '2026_01_AUS').
        circuit: Circuit name.
        split: Dataset split ('TRAIN', 'VALIDATION', 'DEMO_HOLDOUT').
        season: Championship year.
        regulation_era: Regulation epoch identifier.

    Returns:
        Tuple[pd.DataFrame, pd.DataFrame]:
            - valid_pairs_df: Extracted candidate pair states for feature engineering.
            - rejections_df: Logged rejected pair attempts with rejection reasons.
    """
    valid_rows = []
    rejection_rows = []

    # Clean lap numbers
    df = laps_df.copy()
    if "LapNumber" not in df.columns:
        return pd.DataFrame(), pd.DataFrame()

    max_lap = int(df["LapNumber"].max()) if not df["LapNumber"].empty else 0
    seq_manager = BattleSequenceManager(event_code=event_id)

    # Process lap by lap
    for lap_num in range(1, max_lap + 1):
        lap_data = df[df["LapNumber"] == lap_num].copy()
        if lap_data.empty or len(lap_data) < 2:
            continue

        # Sort by on-track position
        if "Position" not in lap_data.columns or lap_data["Position"].isna().all():
            continue

        lap_data = lap_data.dropna(subset=["Position"]).sort_values("Position")
        drivers_in_order = lap_data.to_dict("records")

        # Track active pairs this lap
        active_pairs_this_lap = []

        # Check SC/VSC status on this lap
        lap_track_status = str(lap_data["TrackStatus"].iloc[0]) if "TrackStatus" in lap_data.columns else "1"
        is_neutralized = TrackStatusParser.is_neutralized(lap_track_status)

        for idx in range(len(drivers_in_order) - 1):
            def_row = drivers_in_order[idx]
            att_row = drivers_in_order[idx + 1]

            defender_driver = str(def_row.get("Driver", ""))
            attacker_driver = str(att_row.get("Driver", ""))
            def_pos = int(def_row.get("Position", idx + 1))
            att_pos = int(att_row.get("Position", idx + 2))

            # Must be adjacent positions (k, k+1)
            if att_pos != def_pos + 1:
                continue

            # 1. Check Lap 1 rejection
            if lap_num <= 1:
                rejection_rows.append({
                    "event_id": event_id,
                    "lap": lap_num,
                    "attacker": attacker_driver,
                    "defender": defender_driver,
                    "reason": PairRejectionReason.LAP_1,
                })
                continue

            # 2. Check Race Neutralization (SC/VSC/Red Flag)
            if is_neutralized:
                rejection_rows.append({
                    "event_id": event_id,
                    "lap": lap_num,
                    "attacker": attacker_driver,
                    "defender": defender_driver,
                    "reason": PairRejectionReason.NEUTRALIZED_RACE,
                })
                continue

            # 3. Check Pit status (neither car can be actively entering/exiting pit)
            def_pit_in = pd.notna(def_row.get("PitInTime"))
            def_pit_out = pd.notna(def_row.get("PitOutTime"))
            att_pit_in = pd.notna(att_row.get("PitInTime"))
            att_pit_out = pd.notna(att_row.get("PitOutTime"))

            if def_pit_in or def_pit_out or att_pit_in or att_pit_out:
                rejection_rows.append({
                    "event_id": event_id,
                    "lap": lap_num,
                    "attacker": attacker_driver,
                    "defender": defender_driver,
                    "reason": PairRejectionReason.IN_PIT_LANE,
                })
                continue

            # 4. Check Lap equality (same racing lap, neither is a lapped car)
            if def_row.get("LapNumber") != att_row.get("LapNumber"):
                rejection_rows.append({
                    "event_id": event_id,
                    "lap": lap_num,
                    "attacker": attacker_driver,
                    "defender": defender_driver,
                    "reason": PairRejectionReason.LAPPED_CAR,
                })
                continue

            # 5. Check Timing validity (must have valid lap time or session time)
            def_time = def_row.get("LapTime")
            att_time = att_row.get("LapTime")
            if pd.isna(def_time) or pd.isna(att_time):
                rejection_rows.append({
                    "event_id": event_id,
                    "lap": lap_num,
                    "attacker": attacker_driver,
                    "defender": defender_driver,
                    "reason": PairRejectionReason.TIMING_ANOMALY,
                })
                continue

            # Valid Candidate Pair
            active_pairs_this_lap.append((attacker_driver, defender_driver))
            seq_id = seq_manager.get_or_create_sequence_id(attacker_driver, defender_driver, lap_num)
            obs_id = f"{event_id}_{lap_num:03d}_{attacker_driver}_{defender_driver}"

            valid_rows.append({
                "observation_id": obs_id,
                "battle_sequence_id": seq_id,
                "event_id": event_id,
                "race_id": event_id,
                "season": season,
                "circuit": circuit,
                "split": split,
                "regulation_era": regulation_era,
                "lap": lap_num,
                "attacker": attacker_driver,
                "defender": defender_driver,
                "attacker_position": att_pos,
                "defender_position": def_pos,
                "attacker_lap_time": att_row.get("LapTime"),
                "defender_lap_time": def_row.get("LapTime"),
                "attacker_team": att_row.get("Team", "UNKNOWN"),
                "defender_team": def_row.get("Team", "UNKNOWN"),
                "attacker_compound": att_row.get("Compound", "UNKNOWN"),
                "defender_compound": def_row.get("Compound", "UNKNOWN"),
                "attacker_tyre_age": att_row.get("TyreLife", 0.0),
                "defender_tyre_age": def_row.get("TyreLife", 0.0),
                "attacker_stint": att_row.get("Stint", 1),
                "defender_stint": def_row.get("Stint", 1),
                "track_status_raw": lap_track_status,
                "track_status_parsed": "CLEAR" if not is_neutralized else "NEUTRALIZED",
            })

        seq_manager.terminate_inactive(lap_num, active_pairs_this_lap)

    valid_df = pd.DataFrame(valid_rows)
    rejections_df = pd.DataFrame(rejection_rows)

    return valid_df, rejections_df
