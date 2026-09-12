"""KYNTRA Live Session Capture Architecture.

Enables local deterministic persistence and offline playback of live OpenF1 feeds.
Every normalized live state and discrete telemetry event received during a session
is recorded sequentially with strict timestamp ordering, driver identities,
and provenance attribution.

Capture format: JSON Lines (JSONL) with initial metadata header record.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Union
from pydantic import BaseModel, Field

from kyntra.schemas import RaceState


CAPTURE_FORMAT_VERSION = "KYNTRA_SESSION_CAPTURE_V1"
DEFAULT_CAPTURE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "captures"


class SessionCaptureHeader(BaseModel):
    """Metadata header stored as the first line of every session capture file."""
    format: str = CAPTURE_FORMAT_VERSION
    version: str = "1.0.0"
    session_id: str
    event_id: str
    event_name: str
    circuit: Optional[str] = None
    session_type: str = "PRACTICE"  # PRACTICE | QUALIFYING | RACE | SPRINT
    captured_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    source_provider: str = "OPENF1_LIVE"
    source_mode: str = "CAPTURED_LIVE"
    meeting_key: Optional[Union[int, str]] = None
    session_key: Optional[Union[int, str]] = None
    total_laps: Optional[int] = None
    driver_count: int = 0
    total_frames: int = 0


class SessionCaptureFrame(BaseModel):
    """Single sequential time-slice record in a session capture file."""
    frame_idx: int
    timestamp: float
    session_time: Optional[float] = None
    race_state: RaceState
    raw_records: Optional[List[Dict[str, Any]]] = None


class SessionCaptureWriter:
    """Stream-appends normalized RaceState frames to a local JSONL capture file."""

    def __init__(
        self,
        output_path: Union[str, Path],
        header: SessionCaptureHeader,
    ):
        self.output_path = Path(output_path)
        self.header = header
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self._frame_count = 0
        self._file = open(self.output_path, "w", encoding="utf-8")
        
        # Write initial header
        header_dict = self.header.model_dump()
        self._file.write(json.dumps({"type": "HEADER", "data": header_dict}) + "\n")
        self._file.flush()

    def append_frame(
        self,
        race_state: RaceState,
        raw_records: Optional[List[Dict[str, Any]]] = None,
    ) -> SessionCaptureFrame:
        """Serialize and append a coherent RaceState frame to disk."""
        # Ensure frame records state as CAPTURED_LIVE when replayed later
        state_dict = race_state.model_dump()
        if "session" in state_dict:
            state_dict["session"]["source_mode"] = "CAPTURED_LIVE"
            state_dict["session"]["data_mode"] = "CAPTURED_LIVE"

        frame = SessionCaptureFrame(
            frame_idx=self._frame_count,
            timestamp=race_state.timestamp,
            session_time=race_state.session.session_time,
            race_state=race_state,
            raw_records=raw_records,
        )
        payload = {
            "type": "FRAME",
            "frame_idx": frame.frame_idx,
            "timestamp": frame.timestamp,
            "session_time": frame.session_time,
            "data": state_dict,
            "raw_records": raw_records or [],
        }
        self._file.write(json.dumps(payload) + "\n")
        self._file.flush()
        self._frame_count += 1
        return frame

    def close(self) -> None:
        """Close capture file and finalize frame tally."""
        if not self._file.closed:
            self._file.close()

    def __enter__(self) -> "SessionCaptureWriter":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()


class SessionCaptureReader:
    """Deterministic offline parser and sequential iterator for captured sessions."""

    def __init__(self, file_path: Union[str, Path]):
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise FileNotFoundError(f"Capture file does not exist: {self.file_path}")

        self.header: Optional[SessionCaptureHeader] = None
        self._frames: List[SessionCaptureFrame] = []
        self._load_file()

    def _load_file(self) -> None:
        with open(self.file_path, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                record = json.loads(line)
                rec_type = record.get("type")

                if rec_type == "HEADER":
                    self.header = SessionCaptureHeader(**record["data"])
                elif rec_type == "FRAME":
                    state_data = record["data"]
                    # Force truthful provenance when loaded
                    if "session" in state_data:
                        state_data["session"]["source_mode"] = "CAPTURED_LIVE"
                        state_data["session"]["data_mode"] = "CAPTURED_LIVE"
                    race_state = RaceState(**state_data)
                    frame = SessionCaptureFrame(
                        frame_idx=record.get("frame_idx", len(self._frames)),
                        timestamp=record.get("timestamp", race_state.timestamp),
                        session_time=record.get("session_time"),
                        race_state=race_state,
                        raw_records=record.get("raw_records"),
                    )
                    self._frames.append(frame)

        if self.header is None:
            raise ValueError(f"Capture file '{self.file_path}' is missing a valid HEADER record.")
        self.header.total_frames = len(self._frames)

    @property
    def total_frames(self) -> int:
        return len(self._frames)

    def get_frame(self, index: int) -> Optional[SessionCaptureFrame]:
        if 0 <= index < len(self._frames):
            return self._frames[index]
        return None

    def get_frames(self) -> List[SessionCaptureFrame]:
        return self._frames

    def get_laps(self) -> List[int]:
        laps = set()
        for f in self._frames:
            l = f.race_state.session.current_lap
            if l is not None:
                laps.add(int(l))
        return sorted(list(laps)) if laps else [1]


def list_captured_sessions(capture_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Enumerate all available local session capture files in capture directory."""
    cdir = capture_dir or DEFAULT_CAPTURE_DIR
    if not cdir.exists():
        return []

    captures = []
    for file_path in sorted(cdir.glob("*.jsonl")):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                first_line = f.readline()
                if not first_line:
                    continue
                record = json.loads(first_line)
                if record.get("type") == "HEADER":
                    hdr = record["data"]
                    hdr["file_path"] = str(file_path)
                    hdr["file_size_bytes"] = file_path.stat().st_size
                    captures.append(hdr)
        except Exception:
            continue

    return captures
