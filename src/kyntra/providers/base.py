"""KYNTRA Data Provider Interface Abstraction.

Defines the core contract for data ingestion sources:
- ReplayProvider: Historical telemetry from parquet datasets
- PublicLiveProvider: Future open live timing / telemetry feeds (OpenF1, FastF1)
- TeamTelemetryProvider: Future private high-frequency ATLAS / CAN telemetry feeds
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from kyntra.schemas import RaceState


class ProviderCapabilities(BaseModel):
    """Capabilities exposed by a data provider implementation."""
    can_seek: bool = False
    can_pause: bool = False
    supported_playback_speeds: List[float] = Field(default_factory=lambda: [1.0])
    is_live: bool = False
    max_frequency_hz: Optional[float] = 1.0
    can_capture: bool = False


class ProviderMetadata(BaseModel):
    """Provenance and identity metadata for the active provider."""
    name: str
    provider_type: str  # REPLAY | PUBLIC_LIVE | TEAM_TELEMETRY | OPENF1_LIVE
    source_identifier: str
    provenance: str = "PROVENANCE_VERIFIED"
    source_mode: str = "HISTORICAL_REPLAY"  # LIVE_FEED | CAPTURED_LIVE | HISTORICAL_REPLAY
    meeting: Optional[str] = None
    session: Optional[str] = None
    last_update_timestamp: Optional[float] = None
    data_age: Optional[float] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class BaseDataProvider(ABC):
    """Abstract base class for all KYNTRA telemetry and race data providers."""

    @abstractmethod
    def start(self) -> None:
        """Initialize and start the data ingestion stream."""
        pass

    @abstractmethod
    def stop(self) -> None:
        """Stop and tear down the data stream."""
        pass

    @abstractmethod
    def next_state(self) -> Optional[RaceState]:
        """Emit the next coherent field-wide RaceState."""
        pass

    @abstractmethod
    def seek(self, lap: int) -> bool:
        """Seek provider cursor to a specific lap if supported."""
        pass

    @abstractmethod
    def pause(self) -> None:
        """Pause continuous playback/ingestion."""
        pass

    @abstractmethod
    def resume(self) -> None:
        """Resume continuous playback/ingestion."""
        pass

    @abstractmethod
    def set_speed(self, speed: float) -> None:
        """Adjust playback multiplier if supported."""
        pass

    @abstractmethod
    def get_metadata(self) -> ProviderMetadata:
        """Return provider identity, data source, and session metadata."""
        pass

    @abstractmethod
    def get_capabilities(self) -> ProviderCapabilities:
        """Return provider feature flags and capabilities."""
        pass
