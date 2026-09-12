"""KYNTRA Team Telemetry Provider (Placeholder Interface).

Architecture hook for direct constructor-level telemetry feeds:
- High-frequency chassis & powertrain sensors (10Hz - 100Hz)
- Proprietary McLaren / Mercedes / Ferrari ATLAS and CAN bus streams
- Unobfuscated Energy Store battery state-of-charge (SOC), cell temperatures, and bus currents
- Direct driver steering wheel rotary position and ERS deployment mode switches

CRITICAL TRUTH BOUNDARY:
Does not fabricate private team channels. Remains in STANDBY until configured with
authorized constructor telemetry endpoints.
"""

from typing import Optional
from kyntra.providers.base import BaseDataProvider, ProviderCapabilities, ProviderMetadata
from kyntra.schemas import RaceState


class TeamTelemetryProvider(BaseDataProvider):
    """Placeholder interface for constructor private garage and pit-wall telemetry streams."""

    def __init__(self, team_id: Optional[str] = None, endpoint: Optional[str] = None):
        self.team_id = team_id or "UNCONFIGURED"
        self.endpoint = endpoint
        self._is_connected: bool = False

    def start(self) -> None:
        """Connect to secure constructor telemetry gateway."""
        self._is_connected = False

    def stop(self) -> None:
        self._is_connected = False

    def next_state(self) -> Optional[RaceState]:
        """Returns None while in STANDBY mode to prevent data fabrication."""
        return None

    def seek(self, lap: int) -> bool:
        return False

    def pause(self) -> None:
        pass

    def resume(self) -> None:
        pass

    def set_speed(self, speed: float) -> None:
        pass

    def get_metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            name="KYNTRA Constructor Telemetry Provider (Standby)",
            provider_type="TEAM_TELEMETRY",
            source_identifier=f"TEAM_{self.team_id}_ATLAS_CAN_BUS",
            provenance="CONSTRUCTOR_DIRECT_FEED (PENDING_AUTHENTICATION)",
            details={
                "status": "STANDBY",
                "team_id": self.team_id,
                "endpoint": self.endpoint or "SECURE_TEAM_GATEWAY_UNCONNECTED",
                "future_capabilities": [
                    "50Hz MGU-K electrical DC bus current and voltage",
                    "Direct battery cell-level SoC without estimation",
                    "Differential tyre surface and carcass temperature gradients",
                    "Driver steering wheel ERS switch state and overtake button triggers",
                ],
            },
        )

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            can_seek=False,
            can_pause=False,
            supported_playback_speeds=[1.0],
            is_live=True,
            max_frequency_hz=100.0,
        )
