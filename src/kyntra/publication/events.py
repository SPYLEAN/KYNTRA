"""WebSocket event payload generators for Strategy and Decision Publication."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from kyntra.publication.models import CallLifecycleState, FinalGateResult, PublishedCallSnapshot
from kyntra.strategy.models import CandidateRecommendation, StrategyMatrixSnapshot


class StrategyStreamEventType:
    """Canonical event types for the strategy WebSocket stream."""

    MATRIX_UPDATED = "strategy.matrix.updated"
    CANDIDATE_UPDATED = "strategy.candidate.updated"
    CALL_PUBLISHED = "strategy.call.published"
    CALL_AGING = "strategy.call.aging"
    CALL_EXPIRED = "strategy.call.expired"
    CALL_INVALIDATED = "strategy.call.invalidated"
    CALL_BLOCKED = "strategy.call.blocked"
    CALL_WITHHELD = "strategy.call.withheld"
    DECISION_SNAPSHOT_CREATED = "decision.snapshot.created"


def build_stream_event(
    event_type: str,
    payload: Dict[str, Any],
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    """Build standardized WebSocket envelope payload."""
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    return {
        "event_type": event_type,
        "timestamp": ts,
        "data": payload,
    }


def event_for_matrix_updated(matrix: StrategyMatrixSnapshot) -> Dict[str, Any]:
    return build_stream_event(
        StrategyStreamEventType.MATRIX_UPDATED,
        {
            "event_id": getattr(matrix, "session_key", None) or getattr(matrix, "battle_id", "UNKNOWN"),
            "lap": matrix.lap_number,
            "attacker": matrix.attacker,
            "defender": matrix.defender,
            "ranking_available": matrix.ranking.get("available", False),
            "recommendation_available": matrix.recommendation.get("available", False),
            "matrix_snapshot": matrix.model_dump(),
        },
    )


def event_for_candidate_updated(candidate: CandidateRecommendation, battle_id: str) -> Dict[str, Any]:
    return build_stream_event(
        StrategyStreamEventType.CANDIDATE_UPDATED,
        {
            "battle_id": battle_id,
            "backend_action": candidate.backend_action,
            "ui_call": candidate.ui_call,
            "publication_status": candidate.publication_status,
            "candidate": candidate.model_dump(),
        },
    )


def event_for_gate_result(gate_result: FinalGateResult, battle_id: str) -> Dict[str, Any]:
    """Map final gate outcome to the corresponding explicit stream event type."""
    state = gate_result.lifecycle_state

    if state == CallLifecycleState.VALID:
        etype = StrategyStreamEventType.CALL_PUBLISHED
    elif state == CallLifecycleState.AGING:
        etype = StrategyStreamEventType.CALL_AGING
    elif state == CallLifecycleState.EXPIRED:
        etype = StrategyStreamEventType.CALL_EXPIRED
    elif state == CallLifecycleState.INVALIDATED:
        etype = StrategyStreamEventType.CALL_INVALIDATED
    elif state == CallLifecycleState.BLOCKED:
        etype = StrategyStreamEventType.CALL_BLOCKED
    else:  # WITHHELD or PENDING_FINAL_GATE
        etype = StrategyStreamEventType.CALL_WITHHELD

    return build_stream_event(
        etype,
        {
            "battle_id": battle_id,
            "lifecycle_state": state.value,
            "primary_reason": gate_result.primary_reason,
            "approved": gate_result.approved,
            "gate_result": gate_result.model_dump(),
            "published_call": gate_result.published_call.model_dump() if gate_result.published_call else None,
        },
        timestamp=gate_result.gate_time,
    )


def event_for_decision_snapshot(snapshot: Any) -> Dict[str, Any]:
    """Emit decision.snapshot.created event for append-only audit persistence."""
    data = snapshot.model_dump() if hasattr(snapshot, "model_dump") else dict(snapshot)
    dec_id = data.get("decision_id") or "UNKNOWN"
    return build_stream_event(
        StrategyStreamEventType.DECISION_SNAPSHOT_CREATED,
        {
            "decision_id": dec_id,
            "snapshot": data,
        },
    )
