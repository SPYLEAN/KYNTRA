"""KYNTRA Persistent Event Store / Race Memory.

Append-only event log backed by SQLite. Records meaningful discrete race events:
lap transitions, track status changes, battle formations/ends, overtake windows,
and compliance updates without sample-level spam.
"""

import json
from pathlib import Path
import sqlite3
import threading
from typing import Any, Dict, List, Optional
import uuid

from kyntra.schemas import RaceEvent

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "race_memory.db"


class EventStore:
    """Thread-safe, append-only SQLite persistent event log."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock:
            conn = self._get_connection()
            try:
                with conn:
                    conn.execute("""
                        CREATE TABLE IF NOT EXISTS race_events (
                            id TEXT PRIMARY KEY,
                            timestamp REAL NOT NULL,
                            race_id TEXT NOT NULL,
                            lap INTEGER,
                            sector INTEGER,
                            event_type TEXT NOT NULL,
                            cars TEXT NOT NULL,
                            battle_id TEXT,
                            raw_state_ref TEXT,
                            derived_data TEXT NOT NULL,
                            source TEXT NOT NULL,
                            provenance TEXT NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """)
                    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_race ON race_events (race_id, timestamp);")
                    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON race_events (event_type);")
            finally:
                conn.close()

    def append_event(self, event: RaceEvent) -> None:
        """Append a single verified RaceEvent to persistent memory with deterministic deduplication."""
        # Ensure deterministic identity
        if not event.event_id or (len(event.event_id) == 36 and event.event_id.count("-") == 4):
            event.event_id = RaceEvent.build_deterministic_id(
                race_id=event.race_id,
                lap=event.lap,
                event_type=event.event_type,
                timestamp=event.timestamp,
                cars=event.cars,
                battle_id=event.battle_id,
                source=event.source,
            )

        with self._lock:
            conn = self._get_connection()
            try:
                with conn:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO race_events (
                            id, timestamp, race_id, lap, sector, event_type,
                            cars, battle_id, raw_state_ref, derived_data,
                            source, provenance
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            event.event_id,
                            event.timestamp,
                            event.race_id,
                            event.lap,
                            event.sector,
                            event.event_type,
                            json.dumps(event.cars),
                            event.battle_id,
                            event.raw_state_reference,
                            json.dumps(event.derived_data),
                            event.source,
                            event.provenance,
                        ),
                    )
            finally:
                conn.close()

    def get_timeline_markers(
        self,
        race_id: Optional[str] = None,
        limit: int = 150,
    ) -> List[Dict[str, Any]]:
        """Retrieve key chronological race milestones for the timeline scrubber."""
        query = """
            SELECT id, timestamp, race_id, lap, event_type, cars, battle_id, derived_data
            FROM race_events
            WHERE event_type IN ('BATTLE', 'PASS', 'PIT', 'FLAG', 'WINDOW', 'TRACK_STATUS')
        """
        params: List[Any] = []
        if race_id:
            query += " AND race_id = ?"
            params.append(race_id)

        query += " ORDER BY timestamp ASC LIMIT ?"
        params.append(limit)

        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(query, params)
                markers = []
                for row in cursor.fetchall():
                    derived = json.loads(row["derived_data"]) if row["derived_data"] else {}
                    cars = json.loads(row["cars"]) if row["cars"] else []
                    markers.append({
                        "id": row["id"],
                        "timestamp": row["timestamp"],
                        "race_id": row["race_id"],
                        "lap": row["lap"],
                        "event_type": row["event_type"],
                        "cars": cars,
                        "battle_id": row["battle_id"],
                        "label": derived.get("description") or f"{row['event_type']} L{row['lap']}",
                    })
                return markers
            finally:
                conn.close()

    def get_events(
        self,
        race_id: Optional[str] = None,
        event_type: Optional[str] = None,
        min_lap: Optional[int] = None,
        battle_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[RaceEvent]:
        """Query persistent event history with optional filters."""
        query = "SELECT * FROM race_events WHERE 1=1"
        params: List[Any] = []

        if race_id:
            query += " AND race_id = ?"
            params.append(race_id)

        if event_type:
            query += " AND event_type = ?"
            params.append(event_type)

        if min_lap is not None:
            query += " AND lap >= ?"
            params.append(min_lap)

        if battle_id:
            query += " AND battle_id = ?"
            params.append(battle_id)

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(query, params)
                rows = cursor.fetchall()
            finally:
                conn.close()

        events = []
        for r in rows:
            events.append(
                RaceEvent(
                    event_id=r["id"],
                    timestamp=float(r["timestamp"]),
                    race_id=r["race_id"],
                    lap=r["lap"],
                    sector=r["sector"],
                    event_type=r["event_type"],
                    cars=json.loads(r["cars"]) if r["cars"] else [],
                    battle_id=r["battle_id"],
                    raw_state_reference=r["raw_state_ref"],
                    derived_data=json.loads(r["derived_data"]) if r["derived_data"] else {},
                    source=r["source"],
                    provenance=r["provenance"],
                )
            )
        return events

    def clear(self, race_id: Optional[str] = None) -> None:
        """Clear event log (used in test suites)."""
        with self._lock:
            conn = self._get_connection()
            try:
                with conn:
                    if race_id:
                        conn.execute("DELETE FROM race_events WHERE race_id = ?", (race_id,))
                    else:
                        conn.execute("DELETE FROM race_events")
            finally:
                conn.close()


# Global event store singleton instance
_GLOBAL_EVENT_STORE: Optional[EventStore] = None


def get_event_store(db_path: Optional[Path] = None) -> EventStore:
    """Return singleton event store instance."""
    global _GLOBAL_EVENT_STORE
    if _GLOBAL_EVENT_STORE is None or db_path is not None:
        _GLOBAL_EVENT_STORE = EventStore(db_path=db_path)
    return _GLOBAL_EVENT_STORE
