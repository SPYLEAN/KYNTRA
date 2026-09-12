"""KYNTRA Production Runtime Data Models.

Defines the canonical single-source-of-truth runtime snapshot, health model,
active battle tracker, operational modes, and latency instrumentation schemas.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RuntimeMode(str, Enum):
    """Explicit operational modes for KYNTRA runtime. Never changed silently."""
    LIVE_FEED = "LIVE_FEED"
    CAPTURED_LIVE = "CAPTURED_LIVE"
    HISTORICAL_REPLAY = "HISTORICAL_REPLAY"
    REANALYSIS = "REANALYSIS"
    SYNTHETIC_TEST = "SYNTHETIC_TEST"


class SystemHealthStatus(str, Enum):
    """Overall platform health status."""
    OPERATIONAL = "OPERATIONAL"
    DEGRADED = "DEGRADED"
    DECISION_BLOCKED = "DECISION_BLOCKED"
    OFFLINE = "OFFLINE"


class ModuleHealth(BaseModel):
    """Health diagnostic for an individual pipeline subsystem."""
    module_name: str
    status: str = "OPERATIONAL"  # OPERATIONAL | DEGRADED | FAILED | DISABLED
    last_success_at: Optional[str] = None
    last_error: Optional[str] = None
    freshness_s: float = 0.0
    latency_ms: float = 0.0


class RuntimeHealthSnapshot(BaseModel):
    """Composite health state for the runtime orchestrator."""
    system_health: SystemHealthStatus = SystemHealthStatus.OPERATIONAL
    modules: Dict[str, ModuleHealth] = Field(default_factory=dict)
    updated_at: str


class LatencyMetrics(BaseModel):
    """Granular and rolling measured local latencies (in milliseconds)."""
    ingestion_ms: float = 0.0
    features_ms: float = 0.0
    inference_ms: float = 0.0
    matrix_ms: float = 0.0
    ranking_ms: float = 0.0
    gate_ms: float = 0.0
    total_cycle_ms: float = 0.0
    rolling_total_p50_ms: float = 0.0
    rolling_total_p95_ms: float = 0.0


class ActiveBattleTracker(BaseModel):
    """Tracks continuous existence, gap dynamics, and TTL for an active battle."""
    battle_id: str
    attacker: str
    defender: str
    current_gap_s: float
    first_detected_lap: int
    last_seen_lap: int
    last_seen_time: Optional[str] = None
    consecutive_laps_active: int = 1
    is_active: bool = True
    is_expired: bool = False
    window_state: str = "CLOSED"


class KyntraRuntimeSnapshot(BaseModel):
    """Canonical single-source-of-truth runtime state for the strategist workstation.

    Consolidates the entire end-to-end race intelligence pipeline into one coherent snapshot.
    """
    runtime_id: str
    mode: RuntimeMode
    event_id: str
    session_key: Optional[str] = None
    current_lap: int
    source_timestamps: Dict[str, Optional[str]] = Field(default_factory=dict)
    provider_status: Dict[str, Any] = Field(default_factory=dict)
    freshness: Dict[str, Any] = Field(default_factory=dict)
    active_battles: List[ActiveBattleTracker] = Field(default_factory=list)
    selected_battle_id: Optional[str] = None
    current_matrix: Optional[Dict[str, Any]] = None
    current_ranking: Optional[Dict[str, Any]] = None
    candidate_call: Optional[Dict[str, Any]] = None
    published_call: Optional[Dict[str, Any]] = None
    call_lifecycle: str = "WITHHELD"
    race_control: Dict[str, Any] = Field(default_factory=dict)
    energy_availability: Dict[str, Any] = Field(default_factory=dict)
    model_identities: Dict[str, Any] = Field(default_factory=dict)
    decision_snapshot_id: Optional[str] = None
    health: RuntimeHealthSnapshot
    latencies: LatencyMetrics
