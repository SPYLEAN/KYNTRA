"""KYNTRA Public Live Data Provider (Placeholder Interface).

Architecture hook for streaming real-time public Formula 1 timing and telemetry feeds
(e.g., OpenF1 WebSocket, FastF1 live session telemetry, or official F1 live timing subscription).

CRITICAL TRUTH BOUNDARY:
Does not fabricate mock live data. Remains in STANDBY until configured with valid
live subscription credentials and active track session.
"""

from typing import Optional
from kyntra.providers.base import BaseDataProvider, ProviderCapabilities, ProviderMetadata
from kyntra.schemas import RaceState


class PublicLiveProvider(BaseDataProvider):
    """Placeholder interface for external live public race timing and telemetry streams."""

    def __init__(self, feed_url: Optional[str] = None):
        self.feed_url = feed_url
        self._is_connected: bool = False

    def start(self) -> None:
        """Establish network connection to live public telemetry source."""
        # Standby mode: requires external live session
        self._is_connected = False

    def stop(self) -> None:
        """Terminate connection."""
        self._is_connected = False

    def next_state(self) -> Optional[RaceState]:
        """Poll or dequeue latest live state.
        
        Returns None while in STANDBY mode to prevent data fabrication.
        """
        return None

    def seek(self, lap: int) -> bool:
        """Seeking is unsupported for live synchronous broadcasts."""
        return False

    def pause(self) -> None:
        """Pausing is unsupported for live broadcast streams."""
        pass

    def resume(self) -> None:
        pass

    def set_speed(self, speed: float) -> None:
        """Speed adjustment is unsupported for live feeds (fixed 1.0x real-time)."""
        pass

    def get_metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            name="KYNTRA Public Live Feed Provider (Standby)",
            provider_type="PUBLIC_LIVE",
            source_identifier=self.feed_url or "OPENF1_LIVE_FEED_STANDBY",
            provenance="PUBLIC_TIMING_FEED (LIVE_STANDBY)",
            details={
                "status": "STANDBY",
                "message": "No active live session connected. Feed is in standby awaiting live telemetry source.",
            },
        )

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            can_seek=False,
            can_pause=False,
            supported_playback_speeds=[1.0],
            is_live=True,
            max_frequency_hz=4.0,
        )
