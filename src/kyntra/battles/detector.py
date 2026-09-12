"""KYNTRA Automated Battle Detector.

PROVENANCE: UNVERIFIED OPERATIONAL HEURISTICS — NOT FIA REGULATIONS OR LEARNED ML THRESHOLDS

Scans the field-wide RaceState across adjacent track positions, automatically
identifying active chasing and defensive engagements without requiring manual
driver-pair selection, governed by externalized discovery and termination heuristics.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import yaml

from kyntra.schemas import BattleState, CarState, RaceState

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CONFIG_PATH = PROJECT_ROOT / "configs" / "battle_detection.yaml"


class BattleDetector:
    """Unsupervised adjacent position battle detector with externalized heuristics."""

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or CONFIG_PATH
        self.proximity_threshold_s: float = 2.5
        self.termination_gap_s: float = 3.5
        self.termination_consecutive_ticks: int = 3
        self._history: Dict[str, List[Tuple[float, float]]] = {}  # battle_id -> list of (timestamp, gap)
        self._active_battles: Dict[str, BattleState] = {}
        self._termination_counts: Dict[str, int] = {}  # battle_id -> consecutive ticks above termination_gap_s
        self._load_config()

    def _load_config(self) -> None:
        """Load discovery and termination heuristics from configs/battle_detection.yaml."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    cfg = data.get("battle_detection", {})
                    self.proximity_threshold_s = float(cfg.get("proximity_threshold_seconds", 2.5))
                    self.termination_gap_s = float(cfg.get("termination_gap_seconds", 3.5))
                    self.termination_consecutive_ticks = int(cfg.get("termination_consecutive_ticks", 3))
            except Exception:
                self.proximity_threshold_s = 2.5
                self.termination_gap_s = 3.5
                self.termination_consecutive_ticks = 3

    def detect_battles(self, race_state: RaceState) -> Dict[str, BattleState]:
        """Examine RaceState and discover or maintain all active adjacent-car battles."""
        cars = list(race_state.cars.values())
        if len(cars) < 2:
            self._active_battles.clear()
            self._termination_counts.clear()
            return {}

        # Sort cars by position ascending: P1, P2, P3, ...
        ranked_cars = [c for c in cars if c.position is not None]
        ranked_cars.sort(key=lambda c: c.position)

        current_tick_battles: Dict[str, BattleState] = {}
        observed_adjacent_battle_ids: Set[str] = set()

        for i in range(1, len(ranked_cars)):
            attacker = ranked_cars[i]
            defender = ranked_cars[i - 1]

            # Evaluate gap
            gap_s = attacker.gap_to_car_ahead
            if gap_s is None:
                # Fallback: estimate from distance or speed if available
                if attacker.speed and defender.speed:
                    gap_s = 1.0
                else:
                    gap_s = 1.5

            battle_id = f"{race_state.session.event_id}_{attacker.driver}_{defender.driver}"
            observed_adjacent_battle_ids.add(battle_id)

            is_already_active = battle_id in self._active_battles

            # Evaluate formation and termination heuristic thresholds:
            if is_already_active:
                # Active battle: check if exceeding termination gap
                if gap_s > self.termination_gap_s:
                    self._termination_counts[battle_id] = self._termination_counts.get(battle_id, 0) + 1
                    if self._termination_counts[battle_id] >= self.termination_consecutive_ticks:
                        # Exceeded termination threshold for configured duration -> battle terminates
                        if battle_id in self._active_battles:
                            del self._active_battles[battle_id]
                        if battle_id in self._termination_counts:
                            del self._termination_counts[battle_id]
                        continue
                else:
                    # Gap returned below termination gap -> reset termination counter
                    self._termination_counts[battle_id] = 0
            else:
                # Candidate new battle: check discovery proximity threshold
                if gap_s > self.proximity_threshold_s:
                    continue
                # Discovered: reset counter
                self._termination_counts[battle_id] = 0

            # Calculate closing rate (m/s) and speed delta
            speed_delta = None
            closing_rate = None
            if attacker.speed is not None and defender.speed is not None:
                speed_delta = round(attacker.speed - defender.speed, 1)
                closing_rate = round(speed_delta / 3.6, 2)

            # Historical gap tracking for trend and duration
            t_now = race_state.timestamp
            if battle_id not in self._history:
                self._history[battle_id] = []
            self._history[battle_id].append((t_now, gap_s))
            if len(self._history[battle_id]) > 20:
                self._history[battle_id] = self._history[battle_id][-20:]

            hist = self._history[battle_id]
            duration_s = max(0.0, hist[-1][0] - hist[0][0]) if len(hist) > 1 else 0.0

            # Traffic context: check if attacker has pressure from car behind
            rear_threat = "LOW"
            if i + 1 < len(ranked_cars):
                car_behind = ranked_cars[i + 1]
                if car_behind.gap_to_car_ahead is not None and car_behind.gap_to_car_ahead <= 1.0:
                    rear_threat = "HIGH"

            missing = []
            if attacker.gap_to_car_ahead is None:
                missing.append("gap_seconds")
            if closing_rate is None:
                missing.append("closing_rate")
            if attacker.speed is None or defender.speed is None:
                missing.append("speed_trap_delta")

            tyre_context = {
                "attacker_compound": attacker.tyre_compound or "UNKNOWN",
                "defender_compound": defender.tyre_compound or "UNKNOWN",
                "attacker_tyre_age": attacker.tyre_age,
                "defender_tyre_age": defender.tyre_age,
                "tyre_age_delta": (
                    round(attacker.tyre_age - defender.tyre_age, 1)
                    if attacker.tyre_age is not None and defender.tyre_age is not None
                    else None
                ),
            }

            traffic_context = {
                "rear_threat": rear_threat,
                "drs_available": attacker.drs_active,
            }

            battle_state = BattleState(
                battle_id=battle_id,
                attacker=attacker.driver,
                defender=defender.driver,
                attacker_position=attacker.position,
                defender_position=defender.position,
                gap_seconds=round(gap_s, 3) if gap_s is not None else None,
                closing_rate=closing_rate,
                relative_pace=round(-closing_rate * 0.3, 2) if closing_rate is not None else None,
                speed_delta=speed_delta,
                tyre_context=tyre_context,
                traffic_context=traffic_context,
                battle_duration=round(duration_s, 1),
                feature_missingness=missing,
            )
            current_tick_battles[battle_id] = battle_state
            self._active_battles[battle_id] = battle_state

        # Clean up any previously active battles that are no longer adjacent (pit, retirement, position swap)
        defunct_battles = set(self._active_battles.keys()) - observed_adjacent_battle_ids
        for b_id in defunct_battles:
            if b_id in self._active_battles:
                del self._active_battles[b_id]
            if b_id in self._termination_counts:
                del self._termination_counts[b_id]

        return current_tick_battles

    def clear(self) -> None:
        """Reset internal tracking state."""
        self._history.clear()
        self._active_battles.clear()
        self._termination_counts.clear()
