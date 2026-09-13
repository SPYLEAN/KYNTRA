"""KYNTRA Historical Replay Data Provider.

Streams sequential race states from verified historical demo parquets
(Italy, Australia, Miami, Japan) without mutating raw telemetry datasets.
Supports variable playback speed, pause/resume, and random lap seeking.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd

from kyntra.ingestion.capture import SessionCaptureReader
from kyntra.processing.replay_loader import DRIVER_INFO, EVENT_INFO, load_demo_replay
from kyntra.providers.base import BaseDataProvider, ProviderCapabilities, ProviderMetadata
from kyntra.schemas import CarState, RaceState, SessionState, TrackState


class ReplayProvider(BaseDataProvider):
    """Deterministic historical replay provider backed by demo parquets or captured live sessions."""

    def __init__(
        self,
        event_id: str = "2026_13_ITA",
        capture_path: Optional[Union[str, Path]] = None,
    ):
        self.capture_path: Optional[Path] = None
        self._is_captured_replay = False

        # Determine if event_id is a capture file or explicit capture_path passed
        if capture_path is not None:
            self.capture_path = Path(capture_path)
            self._is_captured_replay = True
        elif str(event_id).endswith(".jsonl") or Path(event_id).is_file():
            self.capture_path = Path(event_id)
            self._is_captured_replay = True

        if self._is_captured_replay:
            self.event_id = event_id
            self.event_meta = {"event_name": "Captured Live Session", "circuit": "Dynamic"}
            self._capture_reader: Optional[SessionCaptureReader] = None
            self._capture_frame_idx: int = 0
            self._total_laps: int = 53
        else:
            if event_id not in EVENT_INFO:
                raise ValueError(f"Unknown event_id '{event_id}'. Supported: {list(EVENT_INFO.keys())}")
            self.event_id = event_id
            self.event_meta = EVENT_INFO[event_id]
            self._total_laps = self.event_meta.get("total_laps", 53)

        self._df: Optional[pd.DataFrame] = None
        self._laps: List[int] = []
        self._current_lap_idx: int = 0
        self._substep_idx: int = 0
        self._substeps_per_lap: int = 80  # ~1.0s per substep for accurate 1:1 race time progression
        self._is_running: bool = False
        self._is_paused: bool = False
        self._playback_speed: float = 1.0
        self._track_max_distance: float = 5793.0  # Approx circuit length in meters

    def start(self) -> None:
        """Load parquet or captured live session and initialize replay cursor."""
        if self._is_captured_replay and self.capture_path:
            self._capture_reader = SessionCaptureReader(self.capture_path)
            self._capture_frame_idx = 0
            self._laps = self._capture_reader.get_laps()
            if self._capture_reader.header:
                self.event_meta = {
                    "event_name": self._capture_reader.header.event_name,
                    "circuit": self._capture_reader.header.circuit or "Captured Circuit",
                }
                self._total_laps = self._capture_reader.header.total_laps or (max(self._laps) if self._laps else 50)
            self._is_running = True
            self._is_paused = False
            return

        self._df = load_demo_replay(self.event_id)
        raw_laps = sorted(int(l) for l in self._df["lap"].dropna().unique())
        self._laps = raw_laps if raw_laps else [1]
        self._current_lap_idx = 0
        self._substep_idx = 0
        self._is_running = True
        self._is_paused = False

        # Determine track distance scale from data if available
        if "Distance" in self._df.columns:
            valid_dist = self._df["Distance"].dropna()
            if not valid_dist.empty and valid_dist.max() > 1000.0:
                self._track_max_distance = float(valid_dist.max())

    def stop(self) -> None:
        """Stop replay and reset state."""
        self._is_running = False
        self._is_paused = False

    def pause(self) -> None:
        """Pause playback."""
        self._is_paused = True

    def resume(self) -> None:
        """Resume playback."""
        self._is_paused = False

    def set_speed(self, speed: float) -> None:
        """Set playback speed multiplier."""
        if speed > 0.0:
            self._playback_speed = float(speed)

    def seek(self, lap: int) -> bool:
        """Seek cursor to specified lap."""
        if self._is_captured_replay and self._capture_reader:
            frames = self._capture_reader.get_frames()
            if not frames:
                return False
            for idx, frame in enumerate(frames):
                if frame.race_state.session.current_lap == lap:
                    self._capture_frame_idx = idx
                    return True
            closest_idx = min(
                range(len(frames)),
                key=lambda i: abs((frames[i].race_state.session.current_lap or 1) - lap),
            )
            self._capture_frame_idx = closest_idx
            return True

        if not self._laps:
            return False
        if lap in self._laps:
            self._current_lap_idx = self._laps.index(lap)
            self._substep_idx = 0
            return True
        # Find nearest
        closest_lap = min(self._laps, key=lambda x: abs(x - lap))
        self._current_lap_idx = self._laps.index(closest_lap)
        self._substep_idx = 0
        return True

    def next_state(self) -> Optional[RaceState]:
        """Emit next coherent field-wide RaceState."""
        if self._is_captured_replay:
            if not self._is_running or not self._capture_reader or self._capture_reader.total_frames == 0:
                return None
            if self._capture_frame_idx >= self._capture_reader.total_frames:
                self._capture_frame_idx = 0  # loop seamlessly
            frame = self._capture_reader.get_frame(self._capture_frame_idx)
            if not self._is_paused:
                self._capture_frame_idx += 1
            return frame.race_state if frame else None

        if not self._is_running or self._df is None or not self._laps:
            return None

        if self._current_lap_idx >= len(self._laps):
            # Loop replay seamlessly or hold on final lap
            self._current_lap_idx = 0
            self._substep_idx = 0

        current_lap = self._laps[self._current_lap_idx]
        lap_df = self._df[self._df["lap"] == current_lap]

        if lap_df.empty:
            self._current_lap_idx += 1
            return self.next_state()

        # Fraction of lap progress for current substep
        step_fraction = (self._substep_idx + 1) / self._substeps_per_lap

        # Reconstruct each car's state
        cars_dict: Dict[str, CarState] = {}
        driver_ids = lap_df["driver"].dropna().unique().tolist()

        # Extract per-car snapshot at current substep
        car_rows = []
        for d_id in driver_ids:
            d_str = str(d_id)
            d_df = lap_df[lap_df["driver"] == d_id]
            if d_df.empty:
                continue

            n_samples = len(d_df)
            sample_idx = min(int(step_fraction * n_samples) - 1, n_samples - 1)
            sample_idx = max(0, sample_idx)
            row = d_df.iloc[sample_idx]
            car_rows.append((d_str, row))

        # Sort cars by distance or session time to determine running position
        def get_sort_key(item):
            _, r = item
            dist = r.get("Distance")
            if pd.notna(dist):
                return float(dist)
            return 0.0

        car_rows.sort(key=get_sort_key, reverse=True)

        # Leader distance for gap calculation
        leader_dist = get_sort_key(car_rows[0]) if car_rows else 0.0

        for pos, (d_str, r) in enumerate(car_rows, start=1):
            info = DRIVER_INFO.get(d_str, {
                "code": f"#{d_str}",
                "name": f"Driver {d_str}",
                "team": "Independent",
                "color": "#94a3b8",
            })

            speed_kmh = float(r["Speed"]) if pd.notna(r.get("Speed")) else None
            speed_mps = max(20.0, (speed_kmh or 240.0) / 3.6)

            # Spatial distance
            car_dist = float(r.get("Distance", 0.0)) if pd.notna(r.get("Distance")) else 0.0
            dist_to_leader = max(0.0, leader_dist - car_dist)
            gap_to_leader = round(dist_to_leader / speed_mps, 3) if pos > 1 else 0.0

            # Gap to car ahead
            dist_to_ahead = float(r.get("DistanceToDriverAhead", 0.0)) if pd.notna(r.get("DistanceToDriverAhead")) else None
            gap_ahead = None
            if pos == 1:
                gap_ahead = None
            elif dist_to_ahead is not None and dist_to_ahead > 0:
                gap_ahead = round(dist_to_ahead / speed_mps, 3)
            else:
                gap_ahead = round(0.5 + 0.4 * pos, 2)

            # Coordinates
            x_coord = float(r["X"]) if pd.notna(r.get("X")) else None
            y_coord = float(r["Y"]) if pd.notna(r.get("Y")) else None

            # Tyre info
            compound = str(r["compound"]) if pd.notna(r.get("compound")) else "MEDIUM"
            tyre_age = float(r["tyre_life"]) if pd.notna(r.get("tyre_life")) else float(current_lap)

            # Progress around lap [0.0, 1.0]
            progress = min(1.0, max(0.0, (car_dist % self._track_max_distance) / max(1.0, self._track_max_distance)))

            code = info["code"]
            cars_dict[code] = CarState(
                driver=code,
                number=d_str,
                name=info.get("name"),
                team=info.get("team"),
                color=info.get("color"),
                position=pos,
                gap_to_leader=gap_to_leader,
                gap_to_car_ahead=gap_ahead,
                speed=round(speed_kmh, 1) if speed_kmh is not None else None,
                tyre_compound=compound,
                tyre_age=round(tyre_age, 1),
                pit_status="ON_TRACK",
                drs_active=bool(gap_ahead is not None and gap_ahead <= 1.0),
                x=x_coord,
                y=y_coord,
                progress=round(progress, 4),
            )

        # Session time derivation
        first_row = car_rows[0][1] if car_rows else None
        session_time = None
        if first_row is not None and pd.notna(first_row.get("SessionTime")):
            st = first_row["SessionTime"]
            session_time = float(st.total_seconds()) if hasattr(st, "total_seconds") else float(st)
        else:
            session_time = float(current_lap * 82.5 + self._substep_idx * (82.5 / max(1, self._substeps_per_lap)))

        # Track status: default green (1); check for safety car in telemetry if flagged
        track_status = "1"
        if first_row is not None and pd.notna(first_row.get("TrackStatus")):
            track_status = str(first_row["TrackStatus"])

        session_state = SessionState(
            event_id=self.event_id,
            event_name=self.event_meta["event_name"],
            circuit=self.event_meta.get("circuit"),
            session_type="RACE",
            current_lap=current_lap,
            total_laps=self._total_laps,
            session_time=round(session_time, 2) if session_time else None,
            replay_time=round(session_time, 2) if session_time else None,
            data_mode="HISTORICAL_REPLAY",
            source_mode="HISTORICAL_REPLAY",
            provider="REPLAY_ENGINE",
            meeting=self.event_meta.get("event_name"),
            last_update_timestamp=round(session_time if session_time else 0.0, 2),
            data_age=0.0,
        )

        track_state = TrackState(
            track_status=track_status,
            sector=min(3, max(1, int(step_fraction * 3) + 1)),
            weather="DRY",
            active_flags=["GREEN"] if track_status == "1" else ["NEUTRALIZED"],
            event_config_available=True,
        )

        # Advance substep and lap index
        if not self._is_paused:
            self._substep_idx += 1
            if self._substep_idx >= self._substeps_per_lap:
                self._substep_idx = 0
                self._current_lap_idx += 1

        return RaceState(
            session=session_state,
            track=track_state,
            cars=cars_dict,
            timestamp=round(session_time if session_time else (current_lap * 80.0), 2),
        )

    def get_metadata(self) -> ProviderMetadata:
        """Return provider metadata."""
        if self._is_captured_replay:
            src_id = str(self.capture_path) if self.capture_path else self.event_id
            hdr = getattr(self._capture_reader, "header", None)
            return ProviderMetadata(
                name="KYNTRA Captured Session Replay Engine",
                provider_type="REPLAY",
                source_identifier=src_id,
                provenance="DERIVED_PUBLIC_TELEMETRY (CAPTURED_LIVE)",
                source_mode="CAPTURED_LIVE",
                meeting=hdr.event_name if hdr else self.event_meta.get("event_name"),
                session=hdr.session_type if hdr else "SESSION",
                last_update_timestamp=None,
                data_age=0.0,
                details={
                    "event_id": self.event_id,
                    "event_name": self.event_meta["event_name"],
                    "total_laps": self._total_laps,
                    "circuit": self.event_meta.get("circuit"),
                    "playback_speed": self._playback_speed,
                    "is_paused": self._is_paused,
                    "captured_frames": getattr(self._capture_reader, "total_frames", 0),
                },
            )

        return ProviderMetadata(
            name="KYNTRA Replay Engine V1",
            provider_type="REPLAY",
            source_identifier=f"data/demo/{self.event_meta.get('file', self.event_id)}",
            provenance="REAL_PUBLIC_TELEMETRY (HISTORICAL_REPLAY)",
            source_mode="HISTORICAL_REPLAY",
            meeting=self.event_meta["event_name"],
            session="RACE",
            last_update_timestamp=None,
            data_age=0.0,
            details={
                "event_id": self.event_id,
                "event_name": self.event_meta["event_name"],
                "total_laps": self._total_laps,
                "circuit": self.event_meta.get("circuit"),
                "playback_speed": self._playback_speed,
                "is_paused": self._is_paused,
            },
        )

    def get_capabilities(self) -> ProviderCapabilities:
        """Return provider capabilities."""
        return ProviderCapabilities(
            can_seek=True,
            can_pause=True,
            supported_playback_speeds=[0.5, 1.0, 2.0, 5.0, 10.0],
            is_live=False,
            max_frequency_hz=10.0,
        )
