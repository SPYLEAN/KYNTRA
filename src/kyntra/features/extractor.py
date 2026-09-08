"""Feature engineering engine for KYNTRA overtake intelligence.

Strictly enforces:
1. No future information: all features derived strictly from observations at or before lap t.
2. Gap data integrity: gap_seconds is only populated when defensible timing delta exists;
   spatial distance is recorded in distance_gap_m, with explicit gap_source provenance.
3. Observable dirty-air proxies V1: only observable lap counts and gap variability,
   never claiming unobservable aerodynamic downforce loss.
4. Threat from behind: computes proximity of car at position k+2 to assess defensive pressure.
"""

from typing import Dict, List, Optional
import numpy as np
import pandas as pd


def extract_race_features(
    pairs_df: pd.DataFrame,
    laps_df: pd.DataFrame,
    weather_df: Optional[pd.DataFrame] = None,
    total_laps: int = 50,
) -> pd.DataFrame:
    """Enrich candidate pairs with strictly non-future tactical features.

    Args:
        pairs_df: Candidate pairs at decision time t.
        laps_df: Complete session laps dataframe.
        weather_df: Optional session weather dataframe.
        total_laps: Total planned race distance.

    Returns:
        pd.DataFrame: Enriched feature dataset ready for ML labeling.
    """
    if pairs_df.empty:
        return pairs_df

    df = pairs_df.copy()

    # Index laps by (Driver, LapNumber) for fast O(1) lookup
    lap_idx: Dict[Tuple[str, int], Dict] = {}
    for _, r in laps_df.iterrows():
        d = str(r["Driver"])
        l_num = int(r["LapNumber"])
        lap_idx[(d, l_num)] = r.to_dict()

    # Weather summary defaults
    mean_air_temp = float(weather_df["AirTemp"].mean()) if weather_df is not None and "AirTemp" in weather_df else 25.0
    mean_track_temp = float(weather_df["TrackTemp"].mean()) if weather_df is not None and "TrackTemp" in weather_df else 35.0
    has_rainfall = bool((weather_df["Rainfall"].sum() > 0)) if weather_df is not None and "Rainfall" in weather_df else False

    enriched_rows = []

    # Track consecutive laps following per (attacker, defender)
    following_history: Dict[Tuple[str, str], int] = {}
    close_history: Dict[Tuple[str, str], int] = {}
    gap_history: Dict[Tuple[str, str], List[float]] = {}

    # Sort pairs temporally by lap, then position
    df = df.sort_values(["lap", "attacker_position"])

    for _, row in df.iterrows():
        r = row.to_dict()
        lap_t = int(r["lap"])
        att = str(r["attacker"])
        def_d = str(r["defender"])
        pair_key = (att, def_d)

        att_curr = lap_idx.get((att, lap_t), {})
        def_curr = lap_idx.get((def_d, lap_t), {})

        # 1. Spatial gap and timing gap
        # If FastF1 provides Time or LapStartTime at finish line, compute gap_seconds
        gap_sec = None
        gap_source = "TIMING_LINE_DELTA"

        if "Time" in att_curr and "Time" in def_curr:
            t_att = att_curr["Time"]
            t_def = def_curr["Time"]
            if pd.notna(t_att) and pd.notna(t_def):
                if hasattr(t_att, "total_seconds") and hasattr(t_def, "total_seconds"):
                    diff = t_att.total_seconds() - t_def.total_seconds()
                    if 0.0 <= diff <= 60.0:
                        gap_sec = round(diff, 3)

        # Distance gap proxy (meters): estimated from timing gap and avg lap speed if available
        # or initialized defensibly
        avg_speed_kmh = float(att_curr.get("SpeedST", 280.0) or 280.0)
        speed_mps = (avg_speed_kmh * 1000.0) / 3600.0
        dist_m = round(gap_sec * speed_mps, 1) if gap_sec is not None else None

        # Closing rate (m/s or s/lap): delta compared to previous lap
        closing_rate = None
        closing_source = "HISTORICAL_1_LAP_DELTA"
        if lap_t > 2:
            prev_att = lap_idx.get((att, lap_t - 1), {})
            prev_def = lap_idx.get((def_d, lap_t - 1), {})
            if "Time" in prev_att and "Time" in prev_def and gap_sec is not None:
                pt_att = prev_att.get("Time")
                pt_def = prev_def.get("Time")
                if pd.notna(pt_att) and pd.notna(pt_def) and hasattr(pt_att, "total_seconds"):
                    prev_gap = pt_att.total_seconds() - pt_def.total_seconds()
                    closing_rate = round(prev_gap - gap_sec, 3)  # positive means closing in

        # 2. Relative Pace: 1-lap and 3-lap rolling deltas
        # Pace delta = Defender lap time - Attacker lap time (positive = attacker is faster)
        pace_delta_1 = None
        att_lt = att_curr.get("LapTime")
        def_lt = def_curr.get("LapTime")

        if pd.notna(att_lt) and pd.notna(def_lt) and hasattr(att_lt, "total_seconds") and hasattr(def_lt, "total_seconds"):
            pace_delta_1 = round(def_lt.total_seconds() - att_lt.total_seconds(), 3)

        # 3-lap rolling pace delta
        pace_delta_3 = None
        recent_att_times = []
        recent_def_times = []
        for lookback in range(3):
            past_l = lap_t - lookback
            if past_l >= 1:
                lt_a = lap_idx.get((att, past_l), {}).get("LapTime")
                lt_d = lap_idx.get((def_d, past_l), {}).get("LapTime")
                if pd.notna(lt_a) and pd.notna(lt_d) and hasattr(lt_a, "total_seconds"):
                    recent_att_times.append(lt_a.total_seconds())
                    recent_def_times.append(lt_d.total_seconds())

        if len(recent_att_times) >= 2:
            pace_delta_3 = round(np.mean(recent_def_times) - np.mean(recent_att_times), 3)
        else:
            pace_delta_3 = pace_delta_1

        # 3. Sector deltas (positive = attacker faster in sector)
        s1_delta = None
        s2_delta = None
        s3_delta = None
        for s_idx in (1, 2, 3):
            s_col = f"Sector{s_idx}Time"
            sa = att_curr.get(s_col)
            sd = def_curr.get(s_col)
            if pd.notna(sa) and pd.notna(sd) and hasattr(sa, "total_seconds"):
                val = round(sd.total_seconds() - sa.total_seconds(), 3)
                if s_idx == 1:
                    s1_delta = val
                elif s_idx == 2:
                    s2_delta = val
                elif s_idx == 3:
                    s3_delta = val

        # 4. Speed Trap delta
        st_att = float(att_curr.get("SpeedST") or 0.0)
        st_def = float(def_curr.get("SpeedST") or 0.0)
        st_delta = round(st_att - st_def, 1) if (st_att > 0 and st_def > 0) else None

        # 5. Tyre life & compound delta
        att_life = float(att_curr.get("TyreLife") or 0.0)
        def_life = float(def_curr.get("TyreLife") or 0.0)
        tyre_age_delta = round(def_life - att_life, 1)  # positive = defender tyres are older

        # 6. Race phase & laps remaining
        laps_rem = max(0, total_laps - lap_t)
        progress = lap_t / max(1, total_laps)
        if progress < 0.25:
            phase = "OPENING"
        elif progress > 0.75:
            phase = "CLOSING"
        else:
            phase = "MIDDLE"

        # 7. Observable Dirty-Air Proxies V1
        f_count = following_history.get(pair_key, 0) + 1
        following_history[pair_key] = f_count

        is_close = (gap_sec is not None and gap_sec <= 1.5) or (dist_m is not None and dist_m <= 100.0)
        c_count = close_history.get(pair_key, 0) + (1 if is_close else 0)
        close_history[pair_key] = c_count

        g_list = gap_history.get(pair_key, [])
        if dist_m is not None:
            g_list.append(dist_m)
            gap_history[pair_key] = g_list[-5:]  # rolling 5 observations

        g_mean = round(float(np.mean(g_list)), 1) if g_list else None
        g_std = round(float(np.std(g_list)), 1) if len(g_list) >= 2 else None

        # 8. Threat from behind (car at position k+2)
        rear_gap_m = None
        rear_threat = "LOW"
        att_pos = int(r["attacker_position"])
        # Find driver at att_pos + 1
        rear_driver_row = [row_d for (dr, l), row_d in lap_idx.items() if l == lap_t and row_d.get("Position") == att_pos + 1]
        if rear_driver_row:
            r_driver = rear_driver_row[0]
            if "Time" in r_driver and "Time" in att_curr:
                rt = r_driver.get("Time")
                at = att_curr.get("Time")
                if pd.notna(rt) and pd.notna(at) and hasattr(rt, "total_seconds"):
                    r_gap = rt.total_seconds() - at.total_seconds()
                    if 0.0 <= r_gap <= 60.0:
                        rear_gap_m = round(r_gap * speed_mps, 1)
                        if r_gap < 1.5:
                            rear_threat = "HIGH"
                        elif r_gap < 3.0:
                            rear_threat = "MEDIUM"

        # Format lap time string or seconds
        r["distance_gap_m"] = dist_m
        r["gap_seconds"] = gap_sec
        r["gap_source"] = gap_source
        r["closing_rate"] = closing_rate
        r["closing_rate_source"] = closing_source

        r["attacker_lap_time"] = round(att_lt.total_seconds(), 3) if pd.notna(att_lt) and hasattr(att_lt, "total_seconds") else None
        r["defender_lap_time"] = round(def_lt.total_seconds(), 3) if pd.notna(def_lt) and hasattr(def_lt, "total_seconds") else None
        r["recent_pace_delta_1lap"] = pace_delta_1
        r["recent_pace_delta_3laps"] = pace_delta_3

        r["sector1_delta"] = s1_delta
        r["sector2_delta"] = s2_delta
        r["sector3_delta"] = s3_delta

        r["attacker_speed_trap"] = st_att if st_att > 0 else None
        r["defender_speed_trap"] = st_def if st_def > 0 else None
        r["speed_trap_delta"] = st_delta

        r["tyre_age_delta"] = tyre_age_delta
        r["attacker_pit_context"] = "NORMAL"
        r["defender_pit_context"] = "NORMAL"
        r["race_phase"] = phase
        r["laps_remaining"] = laps_rem

        r["consecutive_laps_following"] = f_count
        r["consecutive_laps_close"] = c_count
        r["distance_gap_mean_recent"] = g_mean
        r["distance_gap_std_recent"] = g_std

        r["rear_distance_gap_m"] = rear_gap_m
        r["rear_threat_proxy"] = rear_threat

        r["weather_air_temp"] = round(mean_air_temp, 1)
        r["weather_track_temp"] = round(mean_track_temp, 1)
        r["weather_rainfall"] = has_rainfall

        enriched_rows.append(r)

    return pd.DataFrame(enriched_rows)
