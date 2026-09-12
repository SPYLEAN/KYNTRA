"""KYNTRA Active Battle Lifecycle Manager.

Continuously tracks, scores, and expires battles over time.
Guarantees battle continuity across laps and manages user battle selection.
"""

from typing import Dict, List, Optional
import logging

from kyntra.battles.detector import BattleDetector
from kyntra.runtime.models import ActiveBattleTracker
from kyntra.schemas import BattleState, RaceState

logger = logging.getLogger(__name__)


class ActiveBattleManager:
    """Manages tracking, persistence, TTL expiration, and selection of track battles."""

    def __init__(self, max_laps_inactive: int = 2):
        self._detector = BattleDetector()
        self._max_laps_inactive = max_laps_inactive
        self._tracked_battles: Dict[str, ActiveBattleTracker] = {}
        self._selected_battle_id: Optional[str] = None

    @property
    def selected_battle_id(self) -> Optional[str]:
        return self._selected_battle_id

    def select_battle(self, battle_id: Optional[str]) -> bool:
        """Select a battle for pit-wall tactical focus."""
        if battle_id is None:
            self._selected_battle_id = None
            return True
        if battle_id in self._tracked_battles:
            self._selected_battle_id = battle_id
            return True
        return False

    def update(
        self,
        race_state: RaceState,
        window_states: Optional[Dict[str, str]] = None,
    ) -> Dict[str, BattleState]:
        """Detect and reconcile active battles for the current state."""
        current_lap = race_state.session.current_lap
        t_stamp = race_state.timestamp
        window_states = window_states or {}

        # 1. Run canonical battle detector
        detected_battles = self._detector.detect_battles(race_state)
        active_ids = set(detected_battles.keys())

        # 2. Update existing and insert newly detected battles
        for b_id, b_state in detected_battles.items():
            gap = float(b_state.gap_seconds if b_state.gap_seconds is not None else 0.0)
            win_st = window_states.get(b_id, "CLOSED")

            if b_id in self._tracked_battles:
                tracker = self._tracked_battles[b_id]
                tracker.current_gap_s = gap
                tracker.last_seen_lap = current_lap
                tracker.last_seen_time = str(t_stamp)
                tracker.consecutive_laps_active += 1
                tracker.is_active = True
                tracker.is_expired = False
                tracker.window_state = win_st
            else:
                self._tracked_battles[b_id] = ActiveBattleTracker(
                    battle_id=b_id,
                    attacker=b_state.attacker,
                    defender=b_state.defender,
                    current_gap_s=gap,
                    first_detected_lap=current_lap,
                    last_seen_lap=current_lap,
                    last_seen_time=str(t_stamp),
                    consecutive_laps_active=1,
                    is_active=True,
                    is_expired=False,
                    window_state=win_st,
                )

        # 3. Check for expired battles
        for b_id, tracker in list(self._tracked_battles.items()):
            if b_id not in active_ids:
                tracker.is_active = False
                laps_since = current_lap - tracker.last_seen_lap
                if laps_since >= self._max_laps_inactive:
                    tracker.is_expired = True

        # 4. Reconcile selected battle
        if self._selected_battle_id:
            sel_tracker = self._tracked_battles.get(self._selected_battle_id)
            if not sel_tracker or sel_tracker.is_expired:
                self._selected_battle_id = None

        # Fallback selection: first active battle sorted by gap
        if not self._selected_battle_id:
            active_trackers = [t for t in self._tracked_battles.values() if t.is_active and not t.is_expired]
            if active_trackers:
                active_trackers.sort(key=lambda t: t.current_gap_s)
                self._selected_battle_id = active_trackers[0].battle_id

        return detected_battles

    def get_tracked_battles(self, include_expired: bool = False) -> List[ActiveBattleTracker]:
        """Return list of tracked battles."""
        if include_expired:
            return list(self._tracked_battles.values())
        return [t for t in self._tracked_battles.values() if not t.is_expired]

    def get_battle_tracker(self, battle_id: str) -> Optional[ActiveBattleTracker]:
        """Retrieve single battle tracker."""
        return self._tracked_battles.get(battle_id)

    def clear(self) -> None:
        """Reset battle tracker."""
        self._tracked_battles.clear()
        self._selected_battle_id = None
