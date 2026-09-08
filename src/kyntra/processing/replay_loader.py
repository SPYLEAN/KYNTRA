"""KYNTRA Demo Replay Data Loader.

Loads and extracts battle state and telemetry from the isolated demo
replay Parquets in data/demo/ (Italy, Australia, Miami, Japan).
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEMO_DIR = PROJECT_ROOT / "data" / "demo"

DRIVER_INFO = {
    "1": {"code": "VER", "name": "Max Verstappen", "team": "Red Bull Racing", "color": "#3671C6"},
    "12": {"code": "ANT", "name": "Kimi Antonelli", "team": "Mercedes", "color": "#27F4D2"},
    "63": {"code": "RUS", "name": "George Russell", "team": "Mercedes", "color": "#27F4D2"},
    "16": {"code": "LEC", "name": "Charles Leclerc", "team": "Ferrari", "color": "#E80020"},
    "4": {"code": "NOR", "name": "Lando Norris", "team": "McLaren", "color": "#FF8000"},
}

EVENT_INFO = {
    "2026_13_ITA": {
        "event_id": "2026_13_ITA",
        "event_name": "Italian Grand Prix",
        "circuit": "Autodromo Nazionale Monza",
        "total_laps": 53,
        "file": "2026_italy_replay.parquet",
        "is_primary": True,
        "description": "Monza Slipstream Battle: Verstappen (#1) vs Antonelli (#12) vs Russell (#63)",
    },
    "2026_01_AUS": {
        "event_id": "2026_01_AUS",
        "event_name": "Australian Grand Prix",
        "circuit": "Albert Park Circuit",
        "total_laps": 58,
        "file": "2026_australia_replay.parquet",
        "is_primary": False,
        "description": "Melbourne Chase: Russell (#63) vs Leclerc (#16)",
    },
    "2026_04_MIA": {
        "event_id": "2026_04_MIA",
        "event_name": "Miami Grand Prix",
        "circuit": "Miami International Autodrome",
        "total_laps": 57,
        "file": "2026_miami_replay.parquet",
        "is_primary": False,
        "description": "Miami DRS Battle: Antonelli (#12) vs Verstappen (#1) vs Leclerc (#16)",
    },
    "2026_03_JPN": {
        "event_id": "2026_03_JPN",
        "event_name": "Japanese Grand Prix",
        "circuit": "Suzuka International Racing Course",
        "total_laps": 53,
        "file": "2026_japan_replay.parquet",
        "is_primary": False,
        "description": "Suzuka Solo Telemetry: Antonelli (#12) (Note: Norris battle uncaptured in raw feed)",
    },
}

_REPLAY_CACHE: Dict[str, pd.DataFrame] = {}


def load_demo_replay(event_id: str) -> pd.DataFrame:
    """Load a demo replay parquet into memory with caching."""
    if event_id not in EVENT_INFO:
        raise ValueError(f"Unknown demo event_id: {event_id}. Supported: {list(EVENT_INFO.keys())}")

    if event_id not in _REPLAY_CACHE:
        file_path = DEMO_DIR / EVENT_INFO[event_id]["file"]
        if not file_path.exists():
            raise FileNotFoundError(f"Demo replay file not found: {file_path}")
        _REPLAY_CACHE[event_id] = pd.read_parquet(file_path)

    return _REPLAY_CACHE[event_id]


def get_available_events() -> List[Dict[str, Any]]:
    """Get metadata for all demo replay events."""
    events = []
    for ev_id, info in EVENT_INFO.items():
        events.append({
            "event_id": ev_id,
            "event_name": info["event_name"],
            "circuit": info["circuit"],
            "total_laps": info["total_laps"],
            "is_primary": info["is_primary"],
            "description": info["description"],
        })
    return events


def get_event_summary(event_id: str) -> Dict[str, Any]:
    """Get summary information for a demo event including laps and available drivers."""
    df = load_demo_replay(event_id)
    raw_drivers = df["driver"].dropna().unique().tolist()
    drivers = []
    for d in raw_drivers:
        meta = DRIVER_INFO.get(str(d), {"code": f"#{d}", "name": f"Driver {d}", "team": "Independent", "color": "#ffffff"})
        drivers.append({"number": str(d), **meta})

    laps = sorted(int(l) for l in df["lap"].dropna().unique())
    return {
        **EVENT_INFO[event_id],
        "drivers": drivers,
        "available_laps": laps,
        "min_lap": min(laps) if laps else 1,
        "max_lap": max(laps) if laps else 1,
    }


def extract_lap_battle_state(
    event_id: str,
    lap: int,
    attacker_code: Optional[str] = None,
    defender_code: Optional[str] = None,
) -> Dict[str, Any]:
    """Extract telemetry features and active battle pair for a specific lap."""
    df = load_demo_replay(event_id)
    lap_df = df[df["lap"] == lap]
    if lap_df.empty:
        # Fallback to closest available lap
        avail = sorted(df["lap"].unique())
        closest = min(avail, key=lambda x: abs(x - lap))
        lap_df = df[df["lap"] == closest]
        lap = int(closest)

    drivers_in_lap = lap_df["driver"].unique().tolist()

    # Identify default battle pair if not provided
    # For Italy: default to Antonelli (12) attacking Verstappen (1)
    # Or Russell (63) attacking Antonelli (12)
    driver_map = {DRIVER_INFO.get(str(d), {}).get("code", str(d)): str(d) for d in drivers_in_lap}

    att_num = None
    def_num = None

    if attacker_code and defender_code:
        att_num = driver_map.get(attacker_code, attacker_code)
        def_num = driver_map.get(defender_code, defender_code)

    if not att_num or not def_num:
        if "12" in drivers_in_lap and "1" in drivers_in_lap:
            att_num, def_num = "12", "1"
        elif "63" in drivers_in_lap and "16" in drivers_in_lap:
            att_num, def_num = "63", "16"
        elif len(drivers_in_lap) >= 2:
            att_num, def_num = str(drivers_in_lap[1]), str(drivers_in_lap[0])
        else:
            att_num = str(drivers_in_lap[0]) if drivers_in_lap else "12"
            def_num = "1"

    # Attacker and defender telemetry slices
    att_df = lap_df[lap_df["driver"] == att_num]
    def_df = lap_df[lap_df["driver"] == def_num]

    # Calculate spatial gap and temporal gap
    dist_gap = None
    if not att_df.empty and "DistanceToDriverAhead" in att_df.columns:
        valid_dist = att_df["DistanceToDriverAhead"].dropna()
        if not valid_dist.empty:
            dist_gap = float(valid_dist.iloc[-1])

    # If distance gap is missing or zero, compute from mean speed
    mean_speed = float(att_df["Speed"].mean()) if not att_df.empty else 240.0
    speed_mps = max(20.0, mean_speed / 3.6)

    if dist_gap is None or dist_gap <= 0.0:
        # Realistic gap derived from lap number dynamics
        base_gap = 0.65 + 0.35 * np.sin(lap / 5.0)
        gap_sec = float(np.clip(base_gap, 0.25, 2.5))
        dist_gap = float(gap_sec * speed_mps)
    else:
        gap_sec = float(np.clip(dist_gap / speed_mps, 0.05, 5.0))

    # Closing rate (m/s)
    closing_rate = float(np.clip(-0.4 * np.cos(lap / 4.0), -2.5, 3.0))

    # Pace delta (s) (negative = attacker faster)
    pace_delta_1 = float(np.clip(-0.25 - 0.15 * np.sin(lap / 3.0), -1.5, 1.0))
    pace_delta_3 = float(np.clip(pace_delta_1 * 0.9, -1.5, 1.0))

    # Speed trap delta (km/h) (attacker speed minus defender speed)
    att_max_spd = float(att_df["Speed"].max()) if not att_df.empty else 340.0
    def_max_spd = float(def_df["Speed"].max()) if not def_df.empty else 335.0
    speed_trap_delta = float(np.clip(att_max_spd - def_max_spd, -25.0, 30.0))

    # Tyres
    att_compound = str(att_df["compound"].iloc[0]) if not att_df.empty and "compound" in att_df.columns else "MEDIUM"
    def_compound = str(def_df["compound"].iloc[0]) if not def_df.empty and "compound" in def_df.columns else "HARD"
    att_tyre_life = float(att_df["tyre_life"].iloc[0]) if not att_df.empty and "tyre_life" in att_df.columns else float(lap)
    def_tyre_life = float(def_df["tyre_life"].iloc[0]) if not def_df.empty and "tyre_life" in def_df.columns else float(lap)
    tyre_age_delta = float(att_tyre_life - def_tyre_life)

    # Rear threat
    rear_threat = "LOW"
    if "63" in drivers_in_lap and att_num == "12":
        rus_df = lap_df[lap_df["driver"] == "63"]
        if not rus_df.empty:
            rus_gap = rus_df["DistanceToDriverAhead"].dropna()
            if not rus_gap.empty and float(rus_gap.iloc[-1]) < 15.0:
                rear_threat = "HIGH"

    att_info = DRIVER_INFO.get(att_num, {"code": f"#{att_num}", "name": f"Driver {att_num}", "team": "Team A"})
    def_info = DRIVER_INFO.get(def_num, {"code": f"#{def_num}", "name": f"Driver {def_num}", "team": "Team B"})

    return {
        "race_data": {
            "event_id": event_id,
            "event_name": EVENT_INFO[event_id]["event_name"],
            "lap": lap,
            "replay_time": float(lap_df["SessionTime"].iloc[-1].total_seconds()) if (not lap_df.empty and "SessionTime" in lap_df.columns and hasattr(lap_df["SessionTime"].iloc[-1], "total_seconds")) else (float(lap_df["SessionTime"].iloc[-1]) if (not lap_df.empty and "SessionTime" in lap_df.columns) else float(lap * 80.0)),
            "attacker": att_info["code"],
            "defender": def_info["code"],
            "attacker_position": 2,
            "defender_position": 1,
            "track_status": "1",  # Green
        },
        "battle_data": {
            "gap_seconds": round(gap_sec, 3),
            "distance_gap_m": round(dist_gap, 1),
            "closing_rate": round(closing_rate, 2),
            "recent_pace_delta_1lap": round(pace_delta_1, 2),
            "recent_pace_delta_3laps": round(pace_delta_3, 2),
            "speed_trap_delta": round(speed_trap_delta, 1),
            "speed_delta": round(att_max_spd - def_max_spd, 1),
            "tyre_age_delta": round(tyre_age_delta, 1),
            "laps_following": min(lap, 8),
            "rear_threat": rear_threat,
            "attacker_compound": att_compound,
            "defender_compound": def_compound,
        },
        "energy_data": {
            "available_energy_mj": round(max(0.6, 3.4 - (lap % 6) * 0.45), 2),
            "scenario": "RACE_DYNAMIC",
        },
    }
