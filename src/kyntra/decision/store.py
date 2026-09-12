"""KYNTRA Append-Only Forensic Decision Store.

Maintains immutable forensic DecisionSnapshot records and published call histories.
Supports thread-safe in-memory caching and optional durable SQLite persistence
to guarantee decisions survive process restart without data loss or mutation.
"""

from collections import deque
import json
from pathlib import Path
import sqlite3
import threading
from typing import Any, Dict, List, Optional

from kyntra.publication.models import PublishedCallSnapshot


class DecisionStore:
    """Thread-safe, append-only forensic decision store with optional SQLite backing."""

    def __init__(
        self,
        max_history_per_battle: int = 200,
        db_path: Optional[str] = None,
    ):
        self._lock = threading.Lock()
        self._max_history = max_history_per_battle
        self._db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

        # Indexed by decision_id -> DecisionSnapshot (dict)
        self._decisions_by_id: Dict[str, Dict[str, Any]] = {}
        # Chronological list of decision_ids
        self._decision_timeline: List[str] = []
        # Indexed by battle_id -> deque of PublishedCallSnapshot (dict)
        self._calls_by_battle: Dict[str, deque] = {}
        # Indexed by battle_id -> deque of decision_ids
        self._decisions_by_battle: Dict[str, deque] = {}
        # Latest valid or active call across the whole system
        self._latest_global_call: Optional[Dict[str, Any]] = None

        if self._db_path:
            self._init_sqlite()

    @property
    def is_durable(self) -> bool:
        """Returns True if persistence is backed by SQLite storage across process restarts."""
        return self._db_path is not None

    @property
    def persistence_scope(self) -> str:
        """Report genuine storage scope."""
        if self._db_path:
            return f"DURABLE_SQLITE (Path: {self._db_path})"
        return "EPHEMERAL_PROCESS_MEMORY (Cleared on process termination)"

    def _init_sqlite(self) -> None:
        """Initialize SQLite database schema and load historical records into cache."""
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS decisions (
                decision_id TEXT PRIMARY KEY,
                battle_id TEXT,
                created_at TEXT,
                payload_json TEXT,
                is_reanalysis INTEGER
            )
        """)
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS calls (
                call_id TEXT PRIMARY KEY,
                decision_id TEXT,
                battle_id TEXT,
                published_at TEXT,
                payload_json TEXT
            )
        """)
        self._conn.commit()
        self._load_from_db()

    def _load_from_db(self) -> None:
        """Hydrate in-memory index from SQLite records on startup."""
        if not self._conn:
            return
        # Load decisions
        cur = self._conn.execute("SELECT decision_id, battle_id, payload_json FROM decisions ORDER BY rowid ASC")
        for dec_id, b_id, p_json in cur.fetchall():
            try:
                data = json.loads(p_json)
                self._decisions_by_id[dec_id] = data
                self._decision_timeline.append(dec_id)
                if b_id not in self._decisions_by_battle:
                    self._decisions_by_battle[b_id] = deque(maxlen=self._max_history)
                self._decisions_by_battle[b_id].append(dec_id)
            except Exception:
                pass

        # Load calls
        cur_c = self._conn.execute("SELECT call_id, battle_id, payload_json FROM calls ORDER BY rowid ASC")
        for c_id, b_id, c_json in cur_c.fetchall():
            try:
                c_data = json.loads(c_json)
                if b_id not in self._calls_by_battle:
                    self._calls_by_battle[b_id] = deque(maxlen=self._max_history)
                self._calls_by_battle[b_id].append(c_data)
                self._latest_global_call = c_data
            except Exception:
                pass

    def record_decision(
        self,
        snapshot: Any,
        published_call: Optional[PublishedCallSnapshot] = None,
    ) -> str:
        """Record an immutable DecisionSnapshot and optional PublishedCallSnapshot.

        Never mutates any prior snapshot.
        """
        snap_dict = snapshot.model_dump() if hasattr(snapshot, "model_dump") else dict(snapshot)
        dec_id = snap_dict.get("decision_id")
        if not dec_id:
            import uuid
            dec_id = f"DEC_{uuid.uuid4().hex[:12]}"
            snap_dict["decision_id"] = dec_id

        # Determine battle_id
        race = snap_dict.get("race", {})
        att = race.get("attacker", "ANT")
        dfn = race.get("defender", "VER")
        battle_id = f"{att}_{dfn}"

        with self._lock:
            # Immutability check in memory
            if dec_id in self._decisions_by_id:
                raise ValueError(f"DecisionSnapshot '{dec_id}' is immutable and already exists.")

            # Persist to SQLite if configured
            if self._conn:
                try:
                    self._conn.execute(
                        "INSERT INTO decisions (decision_id, battle_id, created_at, payload_json, is_reanalysis) VALUES (?, ?, ?, ?, ?)",
                        (
                            dec_id,
                            battle_id,
                            snap_dict.get("decision_time", ""),
                            json.dumps(snap_dict),
                            1 if snap_dict.get("is_reanalysis") else 0,
                        ),
                    )
                    if published_call is not None:
                        call_dict = published_call.model_dump()
                        self._conn.execute(
                            "INSERT INTO calls (call_id, decision_id, battle_id, published_at, payload_json) VALUES (?, ?, ?, ?, ?)",
                            (
                                call_dict["call_id"],
                                dec_id,
                                battle_id,
                                call_dict.get("published_at", ""),
                                json.dumps(call_dict),
                            ),
                        )
                    self._conn.commit()
                except sqlite3.IntegrityError as e:
                    raise ValueError(f"DecisionSnapshot '{dec_id}' is immutable and already exists in database.") from e

            self._decisions_by_id[dec_id] = snap_dict
            self._decision_timeline.append(dec_id)

            if battle_id not in self._decisions_by_battle:
                self._decisions_by_battle[battle_id] = deque(maxlen=self._max_history)
            self._decisions_by_battle[battle_id].append(dec_id)

            if published_call is not None:
                call_dict = published_call.model_dump()
                if battle_id not in self._calls_by_battle:
                    self._calls_by_battle[battle_id] = deque(maxlen=self._max_history)
                self._calls_by_battle[battle_id].append(call_dict)
                self._latest_global_call = call_dict

        return dec_id

    def get_decision(self, decision_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve an immutable DecisionSnapshot by its unique ID."""
        with self._lock:
            snap = self._decisions_by_id.get(decision_id)
            return dict(snap) if snap else None

    def get_latest_call(self, battle_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieve the newest published call for a specific battle or globally."""
        with self._lock:
            if battle_id:
                calls = self._calls_by_battle.get(battle_id)
                if calls:
                    return dict(calls[-1])
                return None
            return dict(self._latest_global_call) if self._latest_global_call else None

    def get_call_history(self, battle_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve chronological history of all calls for a battle (including expired/invalidated)."""
        with self._lock:
            calls = self._calls_by_battle.get(battle_id, deque())
            items = list(calls)[-limit:]
            return [dict(c) for c in items]

    def get_decision_history(self, battle_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve chronological DecisionSnapshots for a battle."""
        with self._lock:
            dec_ids = list(self._decisions_by_battle.get(battle_id, deque()))[-limit:]
            return [dict(self._decisions_by_id[did]) for did in dec_ids if did in self._decisions_by_id]

    def clear(self) -> None:
        """Reset store (used primarily in test fixtures)."""
        with self._lock:
            if self._conn:
                self._conn.execute("DELETE FROM decisions")
                self._conn.execute("DELETE FROM calls")
                self._conn.commit()
            self._decisions_by_id.clear()
            self._decision_timeline.clear()
            self._calls_by_battle.clear()
            self._decisions_by_battle.clear()
            self._latest_global_call = None

    def close(self) -> None:
        """Close SQLite database connection if active."""
        with self._lock:
            if self._conn:
                self._conn.close()
                self._conn = None


_GLOBAL_DECISION_STORE: Optional[DecisionStore] = None


def get_decision_store(db_path: Optional[str] = None) -> DecisionStore:
    """Singleton getter for the global forensic DecisionStore."""
    global _GLOBAL_DECISION_STORE
    if _GLOBAL_DECISION_STORE is None:
        _GLOBAL_DECISION_STORE = DecisionStore(db_path=db_path)
    return _GLOBAL_DECISION_STORE
