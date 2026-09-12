"""KYNTRA Battle Watchlist Engine.

Transforms detected BattleStates into a prioritized live watchlist using
transparent ordinal states (WATCH, FORMING, ACTIVE, CRITICAL, UNKNOWN)
without fabricated weights or black-box scores.
"""

from typing import Dict, List, Optional

from kyntra.schemas import BattleState, BattleWatchlistItem, TrackState


class BattleWatchlistEngine:
    """Ranks active battles transparently for live pit-wall monitoring."""

    def __init__(self):
        # State tracking for gap trend (battle_id -> previous gap)
        self._prev_gaps: Dict[str, float] = {}

    def build_watchlist(
        self,
        battles: Dict[str, BattleState],
        track_state: TrackState,
        window_states: Optional[Dict[str, str]] = None,
    ) -> List[BattleWatchlistItem]:
        """Convert BattleStates into sorted, classified BattleWatchlistItems."""
        items: List[BattleWatchlistItem] = []
        windows = window_states or {}

        # Compliance status based on track neutralization
        is_neutralized = track_state.track_status in ["2", "4", "5", "6", "7", "SC", "VSC", "RED"]
        compliance_status = "BLOCKED" if is_neutralized else "LEGAL"

        for b_id, b in battles.items():
            gap = b.gap_seconds

            # 1. Determine transparent ordinal priority state
            if gap is None:
                priority = "UNKNOWN"
            elif gap <= 0.60 and (b.closing_rate is None or b.closing_rate >= -0.2):
                priority = "CRITICAL"
            elif gap <= 1.20:
                priority = "ACTIVE"
            elif gap <= 2.00:
                priority = "FORMING"
            else:
                priority = "WATCH"

            # 2. Determine gap trend
            gap_trend = "UNKNOWN"
            if gap is not None and b_id in self._prev_gaps:
                prev = self._prev_gaps[b_id]
                delta = gap - prev
                if delta < -0.04:
                    gap_trend = "CLOSING"
                elif delta > 0.04:
                    gap_trend = "OPENING"
                else:
                    gap_trend = "STABLE"
            elif gap is not None:
                gap_trend = "STABLE"

            if gap is not None:
                self._prev_gaps[b_id] = gap

            # Closing state
            closing_state = None
            if b.closing_rate is not None:
                if b.closing_rate > 0.3:
                    closing_state = f"+{b.closing_rate:.1f} m/s (CATCHING)"
                elif b.closing_rate < -0.3:
                    closing_state = f"{b.closing_rate:.1f} m/s (FALLING BACK)"
                else:
                    closing_state = "PACE MATCHED"

            window_state = windows.get(b_id, "UNKNOWN")

            item = BattleWatchlistItem(
                battle_id=b_id,
                attacker=b.attacker,
                defender=b.defender,
                attacker_position=b.attacker_position,
                defender_position=b.defender_position,
                gap_seconds=gap,
                gap_trend=gap_trend,
                closing_state=closing_state,
                window_state=window_state,
                model_available=len(b.feature_missingness) == 0 or "gap_seconds" not in b.feature_missingness,
                compliance_status=compliance_status,
                priority_state=priority,
            )
            items.append(item)

        # Sort items: CRITICAL -> ACTIVE -> FORMING -> WATCH -> UNKNOWN, then by gap ascending
        priority_rank = {"CRITICAL": 0, "ACTIVE": 1, "FORMING": 2, "WATCH": 3, "UNKNOWN": 4}
        items.sort(key=lambda x: (priority_rank.get(x.priority_state, 5), x.gap_seconds or 999.0))

        return items
