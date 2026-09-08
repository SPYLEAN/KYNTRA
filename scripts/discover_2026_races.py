import fastf1
import sys
from pathlib import Path

cache_dir = Path("data/cache")
cache_dir.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(cache_dir))

print("=== DISCOVERING COMPLETED 2026 RACE SESSIONS ===")
schedule = fastf1.get_event_schedule(2026)

completed_rounds = []
for idx, row in schedule.iterrows():
    round_num = row["RoundNumber"]
    if round_num == 0:
        continue
    event_name = row["EventName"]
    session_name = row["Session5"]
    session_date = row["Session5DateUtc"]
    
    try:
        session = fastf1.get_session(2026, round_num, "R")
        session.load(laps=True, telemetry=False, weather=False, messages=False)
        lap_count = len(session.laps)
        drivers_count = len(session.drivers)
        print(f"Round {round_num:02d} | {event_name:<25} | {session_date} | Laps: {lap_count:4d} | Drivers: {drivers_count:2d} | STATUS: AVAILABLE")
        completed_rounds.append((round_num, event_name, lap_count))
    except Exception as exc:
        print(f"Round {round_num:02d} | {event_name:<25} | {session_date} | STATUS: NOT_AVAILABLE ({exc})")

print(f"\nTotal completed & loadable 2026 race sessions: {len(completed_rounds)}")
