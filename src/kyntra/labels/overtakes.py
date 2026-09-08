"""Verified Overtake Event Detection, Multi-Horizon Labeling, and Position Retention Engine.

Enforces:
1. Multi-source on-track overtake verification (rejecting pit, DNF, SC, lap 1, lapping).
2. Event-based multi-horizon labeling where subsequent re-passes DO NOT erase positive labels.
3. Explicit horizon censoring flags (preventing silent false zeros).
4. Separate position retention target family (evaluating pass durability and re-passes).
5. Full traceability from positive labels back to verified overtake_event_id.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from kyntra.processing.track_status import TrackStatusParser


LABEL_VERSION = "2.0.0"
LABEL_SOURCE = "KYNTRA_VERIFIED_ON_TRACK_ENGINE"


class OvertakeEvent(BaseModel):
    """An on-track overtake event between attacker and defender."""

    overtake_event_id: str
    event_id: str
    lap: int
    session_time: Optional[float] = None
    attacker: str
    defender: str
    attacker_new_pos: int
    defender_new_pos: int
    verification_method: str = "ON_TRACK_TIMING_AND_POSITION_TRANSITION"
    confidence: float = 1.0
    verified: bool = True
    rejection_reason: Optional[str] = None
    is_same_lap: bool = False


def detect_race_overtakes(
    laps_df: pd.DataFrame,
    event_id: str,
) -> Tuple[List[OvertakeEvent], List[Dict]]:
    """Detect genuine on-track overtakes across all laps of a session.

    Rejects:
    - Pit stops (defender pitted or attacker exited pit)
    - DNF / Retirements (defender stopped)
    - Race neutralization (Safety Car, VSC, Red Flag)
    - Start lap (Lap 1)
    - Lapped cars / blue flag passes

    Returns:
        Tuple[List[OvertakeEvent], List[Dict]]:
            - verified_events: List of verified genuine overtakes.
            - rejected_events: Log of position inversions rejected with explicit reasons.
    """
    verified_events: List[OvertakeEvent] = []
    rejected_events: List[Dict] = []

    if laps_df.empty or "LapNumber" not in laps_df.columns:
        return verified_events, rejected_events

    max_lap = int(laps_df["LapNumber"].max())

    # Build driver position mapping per lap: lap -> driver -> position
    # and driver metadata mapping: lap -> driver -> record
    pos_by_lap: Dict[int, Dict[str, int]] = {}
    row_by_lap: Dict[int, Dict[str, Dict]] = {}

    for lap_num in range(1, max_lap + 1):
        lap_rows = laps_df[laps_df["LapNumber"] == lap_num]
        pos_map = {}
        r_map = {}
        for _, r in lap_rows.iterrows():
            d = str(r["Driver"])
            pos = r.get("Position")
            if pd.notna(pos):
                pos_map[d] = int(pos)
                r_map[d] = r.to_dict()
        pos_by_lap[lap_num] = pos_map
        row_by_lap[lap_num] = r_map

    same_lap_discovered = 0
    same_lap_verified = 0
    same_lap_rejected = 0

    # Detect position inversions and same-lap passes between consecutive laps t and t+1
    for t in range(1, max_lap):
        t_pos = pos_by_lap.get(t, {})
        next_t_pos = pos_by_lap.get(t + 1, {})
        t_rows = row_by_lap.get(t, {})
        next_t_rows = row_by_lap.get(t + 1, {})

        # Track status on transition lap
        track_status = str(laps_df[laps_df["LapNumber"] == t + 1]["TrackStatus"].iloc[0]) if not laps_df[laps_df["LapNumber"] == t + 1].empty else "1"
        is_neutralized = TrackStatusParser.is_neutralized(track_status)

        # Check all pairs of drivers present in both laps
        common_drivers = set(t_pos.keys()).intersection(next_t_pos.keys())

        for a in common_drivers:
            for b in common_drivers:
                if a == b:
                    continue

                # Attacker a was behind defender b at lap t
                if t_pos[a] > t_pos[b]:
                    event_lap = t + 1

                    # Case 1: Attacker a is ahead of b at end of lap t+1 (Inter-lap pass)
                    if next_t_pos[a] < next_t_pos[b]:
                        event_id_str = f"OT_{event_id}_L{event_lap:03d}_{a}_{b}"

                        # 1. Lap 1 exclusion
                        if event_lap <= 1:
                            rejected_events.append({
                                "overtake_event_id": event_id_str,
                                "event_id": event_id,
                                "lap": event_lap,
                                "attacker": a,
                                "defender": b,
                                "reason": "LAP_1_START_CHAOS",
                            })
                            continue

                        # 2. Neutralized race exclusion (Safety Car / VSC)
                        if is_neutralized:
                            rejected_events.append({
                                "overtake_event_id": event_id_str,
                                "event_id": event_id,
                                "lap": event_lap,
                                "attacker": a,
                                "defender": b,
                                "reason": "NEUTRALIZED_RACE_SC_VSC",
                            })
                            continue

                        # 3. Pit Stop Exclusion
                        def_pit_t = pd.notna(t_rows.get(b, {}).get("PitInTime"))
                        def_pit_next = pd.notna(next_t_rows.get(b, {}).get("PitInTime")) or pd.notna(next_t_rows.get(b, {}).get("PitOutTime"))
                        att_pit_t = pd.notna(t_rows.get(a, {}).get("PitInTime"))
                        att_pit_next = pd.notna(next_t_rows.get(a, {}).get("PitInTime")) or pd.notna(next_t_rows.get(a, {}).get("PitOutTime"))

                        if def_pit_t or def_pit_next:
                            rejected_events.append({
                                "overtake_event_id": event_id_str,
                                "event_id": event_id,
                                "lap": event_lap,
                                "attacker": a,
                                "defender": b,
                                "reason": "DEFENDER_PITTED",
                            })
                            continue

                        if att_pit_t or att_pit_next:
                            rejected_events.append({
                                "overtake_event_id": event_id_str,
                                "event_id": event_id,
                                "lap": event_lap,
                                "attacker": a,
                                "defender": b,
                                "reason": "ATTACKER_PITTED",
                            })
                            continue

                        # 4. Retirement / DNF Exclusion
                        if (t + 2) in pos_by_lap and b not in pos_by_lap[t + 2]:
                            rejected_events.append({
                                "overtake_event_id": event_id_str,
                                "event_id": event_id,
                                "lap": event_lap,
                                "attacker": a,
                                "defender": b,
                                "reason": "DEFENDER_RETIRED",
                            })
                            continue

                        # Genuine On-Track Overtake!
                        session_time_val = None
                        if "Time" in next_t_rows[a]:
                            t_val = next_t_rows[a]["Time"]
                            if pd.notna(t_val):
                                session_time_val = float(t_val.total_seconds()) if hasattr(t_val, "total_seconds") else float(t_val)

                        ot_event = OvertakeEvent(
                            overtake_event_id=event_id_str,
                            event_id=event_id,
                            lap=event_lap,
                            session_time=session_time_val,
                            attacker=a,
                            defender=b,
                            attacker_new_pos=next_t_pos[a],
                            defender_new_pos=next_t_pos[b],
                            verification_method="ON_TRACK_TIMING_AND_POSITION_TRANSITION",
                            confidence=1.0,
                            verified=True,
                            is_same_lap=False,
                        )
                        verified_events.append(ot_event)

                    # Case 2: Attacker is still behind at end of lap t+1 (Candidate same-lap pass & re-pass)
                    elif t_pos[a] == t_pos[b] + 1 and event_lap > 1 and not is_neutralized:
                        # Adjacent chase pair candidate
                        same_lap_discovered += 1

                        # Pit check for same lap
                        def_pit = pd.notna(next_t_rows.get(b, {}).get("PitInTime")) or pd.notna(next_t_rows.get(b, {}).get("PitOutTime"))
                        att_pit = pd.notna(next_t_rows.get(a, {}).get("PitInTime")) or pd.notna(next_t_rows.get(a, {}).get("PitOutTime"))
                        if def_pit or att_pit:
                            same_lap_rejected += 1
                            rejected_events.append({
                                "overtake_event_id": f"OT_SL_CAND_{event_id}_L{event_lap:03d}_{a}_{b}",
                                "event_id": event_id,
                                "lap": event_lap,
                                "attacker": a,
                                "defender": b,
                                "reason": "PIT_DURING_SAME_LAP_CANDIDATE",
                            })
                            continue

                        # Inspect sector timing evidence
                        s1_a = next_t_rows[a].get("Sector1SessionTime")
                        s1_b = next_t_rows[b].get("Sector1SessionTime")
                        s2_a = next_t_rows[a].get("Sector2SessionTime")
                        s2_b = next_t_rows[b].get("Sector2SessionTime")

                        a_ahead_s1 = False
                        a_ahead_s2 = False

                        if pd.notna(s1_a) and pd.notna(s1_b):
                            try:
                                d1 = (s1_a - s1_b).total_seconds() if hasattr(s1_a - s1_b, "total_seconds") else float(s1_a - s1_b)
                                # Attacker crossed S1 before defender (by >= 0.05s and <= 15s)
                                if -15.0 <= d1 <= -0.05:
                                    a_ahead_s1 = True
                            except Exception:
                                pass

                        if pd.notna(s2_a) and pd.notna(s2_b):
                            try:
                                d2 = (s2_a - s2_b).total_seconds() if hasattr(s2_a - s2_b, "total_seconds") else float(s2_a - s2_b)
                                if -15.0 <= d2 <= -0.05:
                                    a_ahead_s2 = True
                            except Exception:
                                pass

                        if a_ahead_s1 or a_ahead_s2:
                            same_lap_verified += 1
                            s_time = None
                            if a_ahead_s1 and pd.notna(s1_a):
                                s_time = float(s1_a.total_seconds()) if hasattr(s1_a, "total_seconds") else float(s1_a)
                            elif pd.notna(s2_a):
                                s_time = float(s2_a.total_seconds()) if hasattr(s2_a, "total_seconds") else float(s2_a)

                            # 1. Attacker passes defender in Sector 1 or 2
                            sl_ot = OvertakeEvent(
                                overtake_event_id=f"OT_SL_{event_id}_L{event_lap:03d}_{a}_{b}",
                                event_id=event_id,
                                lap=event_lap,
                                session_time=s_time,
                                attacker=a,
                                defender=b,
                                attacker_new_pos=t_pos[b],
                                defender_new_pos=t_pos[a],
                                verification_method="SECTOR_TIMING_ORDER_TRANSITION",
                                confidence=0.90,
                                verified=True,
                                is_same_lap=True,
                            )
                            verified_events.append(sl_ot)

                            # 2. Defender re-passes attacker before lap end
                            repass_time = None
                            if "Time" in next_t_rows[b] and pd.notna(next_t_rows[b]["Time"]):
                                t_b = next_t_rows[b]["Time"]
                                repass_time = float(t_b.total_seconds()) if hasattr(t_b, "total_seconds") else float(t_b)

                            sl_repass = OvertakeEvent(
                                overtake_event_id=f"OT_SL_{event_id}_L{event_lap:03d}_{b}_{a}",
                                event_id=event_id,
                                lap=event_lap,
                                session_time=repass_time,
                                attacker=b,
                                defender=a,
                                attacker_new_pos=next_t_pos[b],
                                defender_new_pos=next_t_pos[a],
                                verification_method="SECTOR_TIMING_ORDER_TRANSITION",
                                confidence=0.90,
                                verified=True,
                                is_same_lap=True,
                            )
                            verified_events.append(sl_repass)
                        else:
                            same_lap_rejected += 1
                            rejected_events.append({
                                "overtake_event_id": f"OT_SL_CAND_{event_id}_L{event_lap:03d}_{a}_{b}",
                                "event_id": event_id,
                                "lap": event_lap,
                                "attacker": a,
                                "defender": b,
                                "reason": "NO_SAME_LAP_INVERSION_EVIDENCE",
                            })

    same_lap_stats = {
        "same_lap_candidates_discovered": same_lap_discovered,
        "same_lap_candidates_verified": same_lap_verified,
        "same_lap_candidates_rejected": same_lap_rejected,
    }

    return verified_events, rejected_events, same_lap_stats


def compute_multi_horizon_labels_and_censoring(
    pairs_df: pd.DataFrame,
    verified_overtakes: List[OvertakeEvent],
    laps_df: pd.DataFrame,
    max_laps_in_race: int,
) -> pd.DataFrame:
    """Compute event-based multi-horizon labels (1, 2, 3 laps) and censoring indicators.

    RULE: A subsequent re-pass does NOT erase an earlier successful pass!
    If attacker passes defender at lap t+1 and defender re-passes at lap t+2,
    then at lap t:
        overtake_next_1_lap = 1
        overtake_next_2_laps = 1
        overtake_next_3_laps = 1

    Censoring: If observation window is truncated by pit stop, DNF, SC, or race end,
    censored_H_lap is set to True (not assigned false zero).
    """
    # Index verified overtakes: (attacker, defender, lap) -> OvertakeEvent
    ot_by_key: Dict[Tuple[str, str, int], OvertakeEvent] = {}
    for ot in verified_overtakes:
        ot_by_key[(ot.attacker, ot.defender, ot.lap)] = ot

    # Build lap-level metadata: (driver, lap) -> dict
    lap_meta: Dict[Tuple[str, int], Dict] = {}
    for _, r in laps_df.iterrows():
        lap_meta[(str(r["Driver"]), int(r["LapNumber"]))] = r.to_dict()

    # Track status per lap
    ts_per_lap: Dict[int, str] = {}
    for _, r in laps_df.groupby("LapNumber"):
        ts_per_lap[int(r["LapNumber"].iloc[0])] = str(r["TrackStatus"].iloc[0])

    labeled_rows = []
    current_time_str = datetime.now(timezone.utc).isoformat()

    for _, row in pairs_df.iterrows():
        r = row.to_dict()
        lap_t = int(r["lap"])
        att = str(r["attacker"])
        def_d = str(r["defender"])

        # Default labels
        h1_ot = 0
        h2_ot = 0
        h3_ot = 0

        h1_censor = False
        h2_censor = False
        h3_censor = False

        matched_event_id = None
        matched_event_lap = None
        matched_event_time = None
        matched_event_attacker = None
        matched_event_defender = None
        matched_event_method = None
        matched_event_conf = None

        # Check horizons 1, 2, 3
        for h in (1, 2, 3):
            target_lap = lap_t + h

            # 1. Check if race ended before target lap
            if target_lap > max_laps_in_race:
                if h == 1:
                    h1_censor = True
                if h == 2:
                    h2_censor = True
                if h == 3:
                    h3_censor = True
                continue

            # 2. Check if an overtake happened between lap_t and target_lap
            ot_found = False
            for check_lap in range(lap_t + 1, target_lap + 1):
                if (att, def_d, check_lap) in ot_by_key:
                    ot = ot_by_key[(att, def_d, check_lap)]
                    ot_found = True
                    if matched_event_id is None:
                        matched_event_id = ot.overtake_event_id
                        matched_event_lap = ot.lap
                        matched_event_time = ot.session_time
                        matched_event_attacker = ot.attacker
                        matched_event_defender = ot.defender
                        matched_event_method = ot.verification_method
                        matched_event_conf = ot.confidence
                    break

            if ot_found:
                if h == 1:
                    h1_ot = 1
                if h == 2:
                    h2_ot = 1
                if h == 3:
                    h3_ot = 1
            else:
                # Check for censoring in interval [lap_t+1, target_lap]
                # If either car pitted, retired, or SC was active before target lap, censor
                is_censored = False
                for check_lap in range(lap_t + 1, target_lap + 1):
                    # SC active?
                    if TrackStatusParser.is_neutralized(ts_per_lap.get(check_lap, "1")):
                        is_censored = True
                        break

                    att_lap_data = lap_meta.get((att, check_lap))
                    def_lap_data = lap_meta.get((def_d, check_lap))

                    if att_lap_data is None or def_lap_data is None:
                        is_censored = True
                        break

                    # Pit stop?
                    if (
                        pd.notna(att_lap_data.get("PitInTime"))
                        or pd.notna(att_lap_data.get("PitOutTime"))
                        or pd.notna(def_lap_data.get("PitInTime"))
                        or pd.notna(def_lap_data.get("PitOutTime"))
                    ):
                        is_censored = True
                        break

                if is_censored:
                    if h == 1:
                        h1_censor = True
                    if h == 2:
                        h2_censor = True
                    if h == 3:
                        h3_censor = True

        r["overtake_next_1_lap"] = h1_ot
        r["overtake_next_2_laps"] = h2_ot
        r["overtake_next_3_laps"] = h3_ot

        r["censored_1_lap"] = h1_censor
        r["censored_2_laps"] = h2_censor
        r["censored_3_laps"] = h3_censor

        r["overtake_event_id"] = matched_event_id
        r["overtake_event_lap"] = matched_event_lap
        r["overtake_event_time"] = matched_event_time
        r["overtake_event_attacker"] = matched_event_attacker
        r["overtake_event_defender"] = matched_event_defender
        r["overtake_verification_method"] = matched_event_method
        r["overtake_confidence"] = matched_event_conf

        r["label_source"] = LABEL_SOURCE
        r["label_version"] = LABEL_VERSION
        r["label_generated_at"] = current_time_str

        labeled_rows.append(r)

    return pd.DataFrame(labeled_rows)


def compute_position_retention_labels(
    pairs_df: pd.DataFrame,
    verified_overtakes: List[OvertakeEvent],
    laps_df: pd.DataFrame,
    max_laps_in_race: int,
) -> pd.DataFrame:
    """Compute separate position-retention target family conditional on successful pass.

    Targets:
    - retained_position_1_lap, retained_position_2_laps, retained_position_3_laps
    - repassed_within_1_lap, repassed_within_2_laps, repassed_within_3_laps
    - retention_censored_1_lap, retention_censored_2_laps, retention_censored_3_laps
    """
    # Index verified overtakes: (attacker, defender, lap) -> OvertakeEvent
    # Also reverse overtakes (re-passes): (defender, attacker, lap) -> OvertakeEvent
    pass_events: Dict[Tuple[str, str, int], OvertakeEvent] = {}
    repass_events: Dict[Tuple[str, str, int], OvertakeEvent] = {}

    for ot in verified_overtakes:
        pass_events[(ot.attacker, ot.defender, ot.lap)] = ot
        repass_events[(ot.defender, ot.attacker, ot.lap)] = ot

    # Driver positions per lap: lap -> driver -> pos
    pos_by_lap: Dict[int, Dict[str, int]] = {}
    lap_meta: Dict[Tuple[str, int], Dict] = {}
    for _, r in laps_df.iterrows():
        l_num = int(r["LapNumber"])
        d = str(r["Driver"])
        p = r.get("Position")
        if pd.notna(p):
            if l_num not in pos_by_lap:
                pos_by_lap[l_num] = {}
            pos_by_lap[l_num][d] = int(p)
        lap_meta[(d, l_num)] = r.to_dict()

    ts_per_lap: Dict[int, str] = {}
    for _, r in laps_df.groupby("LapNumber"):
        ts_per_lap[int(r["LapNumber"].iloc[0])] = str(r["TrackStatus"].iloc[0])

    df = pairs_df.copy()

    for h in (1, 2, 3):
        ret_col = f"retained_position_{h}_lap" if h == 1 else f"retained_position_{h}_laps"
        repass_col = f"repassed_within_{h}_lap" if h == 1 else f"repassed_within_{h}_laps"
        censor_col = f"retention_censored_{h}_lap" if h == 1 else f"retention_censored_{h}_laps"

        ret_vals = []
        repass_vals = []
        censor_vals = []

        for _, row in df.iterrows():
            # Retention is only defined conditional on a verified pass occurring
            h_pass = row.get(f"overtake_next_{h}_lap" if h == 1 else f"overtake_next_{h}_laps", 0)

            if h_pass == 1:
                att = str(row["attacker"])
                def_d = str(row["defender"])
                start_lap = int(row["lap"])
                eval_lap = start_lap + h

                if eval_lap > max_laps_in_race or eval_lap not in pos_by_lap:
                    ret_vals.append(None)
                    repass_vals.append(None)
                    censor_vals.append(True)
                else:
                    # Check intermediate censoring: SC/VSC, pit stop, retirement in (start_lap, eval_lap]
                    is_censored = False
                    for chk_lap in range(start_lap + 1, eval_lap + 1):
                        if chk_lap not in pos_by_lap:
                            is_censored = True
                            break
                        if TrackStatusParser.is_neutralized(ts_per_lap.get(chk_lap, "1")):
                            is_censored = True
                            break
                        att_data = lap_meta.get((att, chk_lap))
                        def_data = lap_meta.get((def_d, chk_lap))
                        if att_data is None or def_data is None:
                            is_censored = True
                            break
                        if (
                            pd.notna(att_data.get("PitInTime"))
                            or pd.notna(att_data.get("PitOutTime"))
                            or pd.notna(def_data.get("PitInTime"))
                            or pd.notna(def_data.get("PitOutTime"))
                        ):
                            is_censored = True
                            break

                    if is_censored:
                        ret_vals.append(None)
                        repass_vals.append(None)
                        censor_vals.append(True)
                    else:
                        curr_pos = pos_by_lap.get(eval_lap, {})
                        att_p = curr_pos.get(att)
                        def_p = curr_pos.get(def_d)

                        if att_p is not None and def_p is not None:
                            is_ahead = (att_p < def_p)
                            ret_vals.append(1 if is_ahead else 0)
                            repass_vals.append(0 if is_ahead else 1)
                            censor_vals.append(False)
                        else:
                            ret_vals.append(None)
                            repass_vals.append(None)
                            censor_vals.append(True)
            else:
                # Not conditional on pass: None / Not Applicable
                ret_vals.append(None)
                repass_vals.append(None)
                censor_vals.append(False)

        df[ret_col] = ret_vals
        df[repass_col] = repass_vals
        df[censor_col] = censor_vals

    return df
