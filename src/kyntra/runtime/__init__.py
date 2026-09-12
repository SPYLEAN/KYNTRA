"""KYNTRA Runtime Package.

Production racecraft decision orchestrator, active battle management,
canonical runtime snapshots, health telemetry, and failure injection.
"""

from kyntra.runtime.battle_manager import ActiveBattleManager
from kyntra.runtime.failure_injection import FailureInjector
from kyntra.runtime.models import (
    ActiveBattleTracker,
    KyntraRuntimeSnapshot,
    LatencyMetrics,
    ModuleHealth,
    RuntimeHealthSnapshot,
    RuntimeMode,
    SystemHealthStatus,
)
from kyntra.runtime.orchestrator import (
    KyntraRuntimeOrchestrator,
    get_runtime_orchestrator,
)

__all__ = [
    "KyntraRuntimeOrchestrator",
    "get_runtime_orchestrator",
    "KyntraRuntimeSnapshot",
    "RuntimeMode",
    "SystemHealthStatus",
    "ModuleHealth",
    "RuntimeHealthSnapshot",
    "LatencyMetrics",
    "ActiveBattleTracker",
    "ActiveBattleManager",
    "FailureInjector",
]
