"""KYNTRA Append-Only Forensic Decision Store.

Maintains immutable forensic DecisionSnapshot records and published call histories.
Guarantees that historical beliefs are never overwritten when new state arrives.
"""

from collections import deque
import threading
from typing import Any, Dict, List, Optional

from kyntra.publication.models import PublishedCallSnapshot


class DecisionStore:
    """Thread-safe, append-only in-memory and persistent forensic decision store."""

    def __init__(self, max_history_per_battle: int = 200):
        self._lock = threading.Lock()
        self._max_history = max_history_per_battle
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
            # Immutability check: cannot overwrite existing decision_id
            if dec_id in self._decisions_by_id:
                raise ValueError(f"DecisionSnapshot '{dec_id}' is immutable and already exists.")

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
            self._decisions_by_id.clear()
            self._decision_timeline.clear()
            self._calls_by_battle.clear()
            self._decisions_by_battle.clear()
            self._latest_global_call = None


_GLOBAL_DECISION_STORE: Optional[DecisionStore] = None


def get_decision_store() -> DecisionStore:
    """Singleton getter for the global forensic DecisionStore."""
    global _GLOBAL_DECISION_STORE
    if _GLOBAL_DECISION_STORE is None:
        _GLOBAL_DECISION_STORE = DecisionStore()
    return _GLOBAL_DECISION_STORE
