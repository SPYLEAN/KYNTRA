"""KYNTRA Conservative Rolling Window Engine.

PROVENANCE: UNVERIFIED — REQUIRES FUTURE BACKTEST (WINDOW_STATE_HEURISTIC)

Tracks successive frozen LightGBM inference outputs through time for each active battle,
deriving qualitative temporal window trajectories (FORMING, STABLE, PEAKING, FADING, UNKNOWN)
based on observable relative trend consistency without unverified neural architectures,
hardcoded absolute probability thresholds, or fabricated forecasts.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import yaml

from kyntra.schemas import WindowState

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CONFIG_PATH = PROJECT_ROOT / "configs" / "window_detection.yaml"


class WindowEngine:
    """Conservative rolling window tracker for active battles based on relative trajectory."""

    def __init__(self, config_path: Optional[Path] = None, max_history_len: int = 20):
        self.config_path = config_path or CONFIG_PATH
        self.max_history_len = max_history_len
        self.min_history_points: int = 2
        self.recent_window_size: int = 5
        self.noise_tolerance: float = 0.008
        self.near_peak_tolerance: float = 0.020
        self._load_config()

        # battle_id -> list of observation dicts
        self._battle_histories: Dict[str, List[Dict[str, Any]]] = {}

    def _load_config(self) -> None:
        """Load WINDOW_STATE_HEURISTIC tolerances from configs/window_detection.yaml."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    cfg = data.get("window_state_detection", {})
                    self.min_history_points = int(cfg.get("min_history_points", 2))
                    self.recent_window_size = int(cfg.get("recent_window_size", 5))
                    self.noise_tolerance = float(cfg.get("noise_tolerance", 0.008))
                    self.near_peak_tolerance = float(cfg.get("near_peak_tolerance", 0.020))
            except Exception:
                pass

    def update_battle_probability(
        self,
        battle_id: str,
        timestamp: float,
        p1: Optional[float],
        p2: Optional[float],
        p3: Optional[float],
        gap: Optional[float] = None,
        closing_rate: Optional[float] = None,
    ) -> WindowState:
        """Record an inference output point and classify the rolling window trajectory.
        
        Evaluates purely relative recent trajectory without absolute P1 thresholds.
        """
        if battle_id not in self._battle_histories:
            self._battle_histories[battle_id] = []

        obs = {
            "timestamp": round(timestamp, 2),
            "p1": round(p1, 4) if p1 is not None else None,
            "p2": round(p2, 4) if p2 is not None else None,
            "p3": round(p3, 4) if p3 is not None else None,
            "gap": round(gap, 3) if gap is not None else None,
            "closing_rate": round(closing_rate, 2) if closing_rate is not None else None,
        }

        self._battle_histories[battle_id].append(obs)
        if len(self._battle_histories[battle_id]) > self.max_history_len:
            self._battle_histories[battle_id] = self._battle_histories[battle_id][-self.max_history_len:]

        history = self._battle_histories[battle_id]

        # Valid P1 observations
        valid_p1s = [(h["timestamp"], h["p1"]) for h in history if h["p1"] is not None]

        if len(valid_p1s) < self.min_history_points:
            return WindowState(
                battle_id=battle_id,
                window_state="UNKNOWN",
                trend_direction="UNKNOWN",
                recent_history=history,
                peak_observed_probability=valid_p1s[0][1] if valid_p1s else None,
                peak_observed_time=valid_p1s[0][0] if valid_p1s else None,
            )

        # Find historical peak across all valid observations in history
        peak_time, peak_val = max(valid_p1s, key=lambda x: x[1])

        # Extract recent trajectory window
        recent_pts = valid_p1s[-self.recent_window_size:]
        recent_p1s = [p for _, p in recent_pts]
        latest_p1 = recent_p1s[-1]

        # Deltas between consecutive points in the recent window
        deltas = [recent_p1s[i] - recent_p1s[i - 1] for i in range(1, len(recent_p1s))]
        last_delta = deltas[-1] if deltas else 0.0

        # Local recent maximum within this recent window
        local_max = max(recent_p1s)
        dist_from_local_max = local_max - latest_p1
        is_near_local_max = dist_from_local_max <= self.near_peak_tolerance

        # Upward run preceding local maximum
        idx_local_max = recent_p1s.index(local_max)
        if idx_local_max > 0:
            has_prior_rise = (local_max - min(recent_p1s[:idx_local_max + 1])) > self.noise_tolerance
        else:
            has_prior_rise = (peak_val - min(p for _, p in valid_p1s)) > self.noise_tolerance

        # Relative trajectory checks (no absolute P1 thresholds):
        # 1. PEAKING: Near local maximum AND upward momentum flattened or reversed, with prior rise
        is_peaking = (
            is_near_local_max
            and last_delta <= self.noise_tolerance
            and has_prior_rise
        )

        # 2. FORMING: Recent probabilities consistently rising
        is_rising = (
            last_delta > self.noise_tolerance
            and (len(deltas) == 1 or deltas[-2] >= -self.noise_tolerance)
            and (recent_p1s[-1] - recent_p1s[0]) > self.noise_tolerance
        )

        # 3. FADING: Successive valid probabilities are declining
        is_declining = (
            last_delta < -self.noise_tolerance
            and (
                (len(deltas) >= 2 and deltas[-2] <= self.noise_tolerance)
                or dist_from_local_max > self.near_peak_tolerance
            )
        )

        if is_peaking:
            trend_direction = "FLAT" if abs(last_delta) <= self.noise_tolerance else "DECREASING"
            window_state = "PEAKING"
        elif is_rising:
            trend_direction = "INCREASING"
            window_state = "FORMING"
        elif is_declining:
            trend_direction = "DECREASING"
            window_state = "FADING"
        else:
            trend_direction = "FLAT"
            window_state = "STABLE"

        return WindowState(
            battle_id=battle_id,
            window_state=window_state,
            trend_direction=trend_direction,
            recent_history=history,
            peak_observed_probability=round(peak_val, 4),
            peak_observed_time=round(peak_time, 2),
        )

    def get_window_state(self, battle_id: str) -> Optional[WindowState]:
        """Return latest window state for a battle without adding an observation."""
        if battle_id not in self._battle_histories:
            return None
        hist = self._battle_histories[battle_id]
        if not hist:
            return None
        last = hist[-1]
        return self.update_battle_probability(
            battle_id=battle_id,
            timestamp=last["timestamp"],
            p1=last["p1"],
            p2=last["p2"],
            p3=last["p3"],
            gap=last["gap"],
            closing_rate=last["closing_rate"],
        )

    def clear(self) -> None:
        self._battle_histories.clear()
