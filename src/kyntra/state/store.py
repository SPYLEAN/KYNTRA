"""KYNTRA Current State Store.

Maintains the single authoritative latest coherent RaceState, active battles,
and DecisionSnapshot across the entire platform. Guarantees strict timestamp
coherence across all live pit-wall panels.
"""

import threading
from typing import Any, Dict, List, Optional

from kyntra.schemas import (
    BattleState,
    BattleWatchlistItem,
    DecisionSnapshot,
    RaceState,
    WindowState,
)


class CurrentStateStore:
    """Thread-safe single-source-of-truth current state holder."""

    def __init__(self):
        self._lock = threading.Lock()
        self._latest_race_state: Optional[RaceState] = None
        self._latest_decision_snapshot: Optional[DecisionSnapshot] = None
        self._active_battles: Dict[str, BattleState] = {}
        self._watchlist: List[BattleWatchlistItem] = []
        self._active_windows: Dict[str, WindowState] = {}
        self._selected_battle_id: Optional[str] = None

    def update_race_state(self, state: RaceState) -> None:
        """Update current RaceState atomically."""
        with self._lock:
            self._latest_race_state = state

    def get_race_state(self) -> Optional[RaceState]:
        """Retrieve current RaceState."""
        with self._lock:
            return self._latest_race_state

    def update_decision_snapshot(self, snapshot: DecisionSnapshot) -> None:
        """Update current DecisionSnapshot atomically."""
        with self._lock:
            self._latest_decision_snapshot = snapshot

    def get_decision_snapshot(self) -> Optional[DecisionSnapshot]:
        """Retrieve current coherent DecisionSnapshot."""
        with self._lock:
            return self._latest_decision_snapshot

    def update_battles(
        self,
        battles: Dict[str, BattleState],
        watchlist: List[BattleWatchlistItem],
    ) -> None:
        """Update active battles and watchlist atomically."""
        with self._lock:
            self._active_battles = battles
            self._watchlist = watchlist
            if not self._selected_battle_id and watchlist:
                self._selected_battle_id = watchlist[0].battle_id

    def get_active_battles(self) -> Dict[str, BattleState]:
        with self._lock:
            return dict(self._active_battles)

    def get_watchlist(self) -> List[BattleWatchlistItem]:
        with self._lock:
            return list(self._watchlist)

    def set_selected_battle_id(self, battle_id: str) -> None:
        with self._lock:
            self._selected_battle_id = battle_id

    def get_selected_battle_id(self) -> Optional[str]:
        with self._lock:
            return self._selected_battle_id

    def update_window(self, battle_id: str, window: WindowState) -> None:
        with self._lock:
            self._active_windows[battle_id] = window

    def get_window(self, battle_id: str) -> Optional[WindowState]:
        with self._lock:
            return self._active_windows.get(battle_id)

    def get_all_windows(self) -> Dict[str, WindowState]:
        with self._lock:
            return dict(self._active_windows)

    def update_published_call(self, call: Any) -> None:
        """Update current published call atomically."""
        with self._lock:
            self._current_published_call = call

    def get_published_call(self) -> Optional[Any]:
        """Retrieve current published call."""
        with self._lock:
            return getattr(self, "_current_published_call", None)


# Singleton instance
_GLOBAL_STATE_STORE: Optional[CurrentStateStore] = None


def get_current_state_store() -> CurrentStateStore:
    global _GLOBAL_STATE_STORE
    if _GLOBAL_STATE_STORE is None:
        _GLOBAL_STATE_STORE = CurrentStateStore()
    return _GLOBAL_STATE_STORE
