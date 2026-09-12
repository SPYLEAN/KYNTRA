"""Lifecycle management and staleness transitions for published tactical calls."""

from datetime import datetime, timezone
import logging
from typing import Optional

from kyntra.publication.config import PublicationConfig, load_publication_config
from kyntra.publication.models import CallLifecycleState, PublicationReason, PublishedCallSnapshot

logger = logging.getLogger(__name__)


def evaluate_call_staleness(
    call: PublishedCallSnapshot,
    current_time_iso: Optional[str] = None,
    publication_config: Optional[PublicationConfig] = None,
) -> PublishedCallSnapshot:
    """Evaluate whether an active call has aged or expired based on configured time budget.

    Deterministic transition:
    - If already EXPIRED, INVALIDATED, or BLOCKED: preserve terminal state.
    - If elapsed >= validity_budget: transition to EXPIRED.
    - If elapsed >= (aging_fraction * validity_budget): transition to AGING.
    - Otherwise: remain VALID.
    """
    if call.lifecycle_state in [
        CallLifecycleState.EXPIRED,
        CallLifecycleState.INVALIDATED,
        CallLifecycleState.BLOCKED,
        CallLifecycleState.WITHHELD,
    ]:
        return call

    cfg = publication_config or load_publication_config()
    now_dt = (
        datetime.fromisoformat(current_time_iso.replace("Z", "+00:00"))
        if current_time_iso
        else datetime.now(timezone.utc)
    )

    try:
        pub_dt = datetime.fromisoformat(call.published_at.replace("Z", "+00:00"))
    except Exception:
        return call

    elapsed_s = (now_dt - pub_dt).total_seconds()
    budget_s = cfg.call_validity_budget_s
    aging_threshold_s = budget_s * cfg.aging_threshold_fraction

    cloned = call.model_copy(deep=True)

    if elapsed_s >= budget_s:
        cloned.lifecycle_state = CallLifecycleState.EXPIRED
        if PublicationReason.STALE_DATA_TIMEOUT.value not in cloned.reason_codes:
            cloned.reason_codes.append(PublicationReason.STALE_DATA_TIMEOUT.value)
    elif elapsed_s >= aging_threshold_s:
        cloned.lifecycle_state = CallLifecycleState.AGING
    else:
        cloned.lifecycle_state = CallLifecycleState.VALID

    return cloned


def invalidate_call(
    call: PublishedCallSnapshot,
    reason: str = PublicationReason.BATTLE_STATE_CHANGED.value,
) -> PublishedCallSnapshot:
    """Explicitly transition an existing call to INVALIDATED state upon material source changes."""
    cloned = call.model_copy(deep=True)
    cloned.lifecycle_state = CallLifecycleState.INVALIDATED
    cloned.primary_reason = reason
    if reason not in cloned.reason_codes:
        cloned.reason_codes.append(reason)
    return cloned
