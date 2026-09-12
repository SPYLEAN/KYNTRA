"""Final Safety and Coherence Publication Gate for KYNTRA Calls."""

from datetime import datetime, timezone, timedelta
import logging
from typing import Any, Dict, List, Optional
import uuid

from kyntra.publication.config import PublicationConfig, load_publication_config
from kyntra.publication.models import (
    CallLifecycleState,
    FailureSeverity,
    FinalGateResult,
    PublicationReason,
    PublishedCallSnapshot,
)
from kyntra.strategy.models import CandidateRecommendation, StrategistAction, StrategyMatrixSnapshot

logger = logging.getLogger(__name__)

EXPECTED_FROZEN_MODEL_SHA = "a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5"

ACTION_UI_MAP = {
    StrategistAction.CONSERVE.value: "SAVE ENERGY",
    StrategistAction.BUILD.value: "PREPARE",
    StrategistAction.DEPLOY.value: "APPLY PRESSURE",
    StrategistAction.OVERTAKE.value: "OVERTAKE NOW",
}


def evaluate_final_publication_gate(
    candidate: CandidateRecommendation,
    matrix: StrategyMatrixSnapshot,
    current_race_data: Dict[str, Any],
    current_battle_data: Optional[Dict[str, Any]],
    current_energy_state: Optional[Dict[str, Any]] = None,
    current_rule_state: Optional[Dict[str, Any]] = None,
    evaluation_time_iso: Optional[str] = None,
    publication_config: Optional[PublicationConfig] = None,
    is_reanalysis: bool = False,
) -> FinalGateResult:
    """Evaluate all 7 safety, freshness, and coherence checks immediately before call publication.

    A candidate recommendation produced by lexicographic ranking NEVER automatically
    becomes visible on the pit wall without successfully passing this gate.

    Returns:
        FinalGateResult: Complete forensic audit and published call (if approved).
    """
    now_dt = datetime.now(timezone.utc)
    gate_time = evaluation_time_iso or now_dt.isoformat()
    cfg = publication_config or load_publication_config()

    checks: Dict[str, Dict[str, Any]] = {}
    reason_codes: List[str] = []

    # --------------------------------------------------------------------------
    # PRE-CHECK: Candidate Availability
    # --------------------------------------------------------------------------
    if not candidate.available or not candidate.backend_action:
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.WITHHELD,
            primary_reason=candidate.primary_reason or PublicationReason.STRATEGY_TIE.value,
            reason_codes=candidate.reason_codes or [PublicationReason.STRATEGY_TIE.value],
            gate_time=gate_time,
            checks={"candidate_available": {"passed": False, "reason": "CANDIDATE_NOT_AVAILABLE"}},
            published_call=None,
        )

    # --------------------------------------------------------------------------
    # CHECK 1: Battle Identity & Driver Continuity
    # --------------------------------------------------------------------------
    if current_battle_data is None:
        checks["battle_identity"] = {
            "passed": False,
            "reason": "BATTLE_DISAPPEARED",
            "severity": FailureSeverity.DECISION_BLOCKING.value,
        }
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.INVALIDATED,
            primary_reason=PublicationReason.BATTLE_STATE_CHANGED.value,
            reason_codes=["BATTLE_DISAPPEARED", PublicationReason.BATTLE_STATE_CHANGED.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    cand_attacker = matrix.attacker
    cand_defender = matrix.defender
    curr_attacker = current_race_data.get("attacker")
    curr_defender = current_race_data.get("defender")

    if (curr_attacker and curr_attacker != cand_attacker) or (curr_defender and curr_defender != cand_defender):
        checks["battle_identity"] = {
            "passed": False,
            "expected_pair": f"{cand_attacker}_vs_{cand_defender}",
            "current_pair": f"{curr_attacker}_vs_{curr_defender}",
            "severity": FailureSeverity.DECISION_BLOCKING.value,
        }
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.INVALIDATED,
            primary_reason=PublicationReason.BATTLE_STATE_CHANGED.value,
            reason_codes=["DRIVER_PAIR_CHANGED", PublicationReason.BATTLE_STATE_CHANGED.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    checks["battle_identity"] = {
        "passed": True,
        "attacker": cand_attacker,
        "defender": cand_defender,
        "event_id": current_race_data.get("event_id") or getattr(matrix, "session_key", "UNKNOWN"),
        "lap": matrix.lap_number,
    }

    # --------------------------------------------------------------------------
    # CHECK 2: Temporal Coherence & Cross-Stream Skew
    # --------------------------------------------------------------------------
    event_time_str = current_race_data.get("event_time")
    received_time_str = current_race_data.get("received_time") or matrix.received_time

    # Validate that timestamps are well-formed if provided
    coherence_passed = True
    skew_s = 0.0
    if event_time_str and received_time_str:
        try:
            t_evt = datetime.fromisoformat(event_time_str.replace("Z", "+00:00"))
            t_rcv = datetime.fromisoformat(received_time_str.replace("Z", "+00:00"))
            skew_s = abs((t_rcv - t_evt).total_seconds())
            if skew_s > cfg.max_cross_stream_skew_s:
                coherence_passed = False
        except Exception:
            pass

    checks["temporal_coherence"] = {
        "passed": coherence_passed,
        "skew_seconds": round(skew_s, 3),
        "skew_budget_s": cfg.max_cross_stream_skew_s,
    }

    if not coherence_passed:
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.WITHHELD,
            primary_reason=PublicationReason.TEMPORAL_COHERENCE_UNRESOLVED.value,
            reason_codes=["CROSS_STREAM_SKEW_EXCEEDED", PublicationReason.TEMPORAL_COHERENCE_UNRESOLVED.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    # --------------------------------------------------------------------------
    # CHECK 3: Freshness Budgets
    # --------------------------------------------------------------------------
    # Evaluate state age if provided
    state_age_s = float(current_race_data.get("state_age_ms", 0.0)) / 1000.0
    is_fresh = state_age_s <= cfg.battle_state_budget_s

    checks["freshness"] = {
        "passed": is_fresh,
        "observed_age_s": round(state_age_s, 3),
        "budget_s": cfg.battle_state_budget_s,
    }

    if not is_fresh:
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.EXPIRED,
            primary_reason=PublicationReason.STALE_DATA_TIMEOUT.value,
            reason_codes=["BATTLE_STATE_STALE", PublicationReason.STALE_DATA_TIMEOUT.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    # --------------------------------------------------------------------------
    # CHECK 4: Immediate Race-Control & Regulation Recheck
    # --------------------------------------------------------------------------
    # Check if latest track status prohibits candidate action
    current_track_status = str(
        (current_rule_state or {}).get("track_status") or current_race_data.get("track_status") or "1"
    ).strip()

    is_neutralized = current_track_status in ["2", "4", "5", "6", "7", "YELLOW", "SC", "VSC", "RED"]

    if candidate.backend_action == StrategistAction.OVERTAKE.value and is_neutralized:
        checks["race_control_recheck"] = {
            "passed": False,
            "action": candidate.backend_action,
            "track_status": current_track_status,
            "reason": "OVERTAKE_PROHIBITED_UNDER_NEUTRALIZATION",
            "severity": FailureSeverity.DECISION_BLOCKING.value,
        }
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.BLOCKED,
            primary_reason=PublicationReason.RULE_STATE_CHANGED.value,
            reason_codes=["NEUTRALIZATION_ACTIVE", PublicationReason.RULE_STATE_CHANGED.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    # Check if rule result became UNKNOWN for OVERTAKE
    curr_rule_res = (current_rule_state or {}).get("result")
    if candidate.backend_action == StrategistAction.OVERTAKE.value and curr_rule_res == "UNKNOWN":
        checks["race_control_recheck"] = {
            "passed": False,
            "action": candidate.backend_action,
            "rule_result": "UNKNOWN",
            "severity": FailureSeverity.DECISION_BLOCKING.value,
        }
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.WITHHELD,
            primary_reason=PublicationReason.RULE_STATE_CHANGED.value,
            reason_codes=["REGULATION_UNCERTAINTY", PublicationReason.RULE_STATE_CHANGED.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    checks["race_control_recheck"] = {
        "passed": True,
        "track_status": current_track_status,
        "action": candidate.backend_action,
    }

    # --------------------------------------------------------------------------
    # CHECK 5: Immediate Energy Feasibility Recheck
    # --------------------------------------------------------------------------
    energy_dict = current_energy_state or {}
    avail_e_mj = energy_dict.get("available_energy_mj")
    energy_avail = energy_dict.get("available", True)

    if not energy_avail:
        checks["energy_recheck"] = {
            "passed": False,
            "reason": "ENERGY_TELEMETRY_UNAVAILABLE",
            "severity": FailureSeverity.DECISION_BLOCKING.value,
        }
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.WITHHELD,
            primary_reason=PublicationReason.ENERGY_STATE_CHANGED.value,
            reason_codes=["ENERGY_TELEMETRY_UNAVAILABLE", PublicationReason.ENERGY_STATE_CHANGED.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    if candidate.backend_action in [StrategistAction.DEPLOY.value, StrategistAction.OVERTAKE.value]:
        if avail_e_mj is not None and float(avail_e_mj) <= 0.05:
            checks["energy_recheck"] = {
                "passed": False,
                "available_energy_mj": avail_e_mj,
                "action": candidate.backend_action,
                "reason": "ENERGY_STORE_DEPLETED",
                "severity": FailureSeverity.DECISION_BLOCKING.value,
            }
            return FinalGateResult(
                approved=False,
                lifecycle_state=CallLifecycleState.WITHHELD,
                primary_reason=PublicationReason.ENERGY_FEASIBILITY_LOST.value,
                reason_codes=["ENERGY_STORE_DEPLETED", PublicationReason.ENERGY_FEASIBILITY_LOST.value],
                gate_time=gate_time,
                checks=checks,
                published_call=None,
            )

    checks["energy_recheck"] = {
        "passed": True,
        "available_energy_mj": avail_e_mj,
        "action": candidate.backend_action,
    }

    # --------------------------------------------------------------------------
    # CHECK 6: Critical Input Availability
    # --------------------------------------------------------------------------
    gap_val = current_battle_data.get("gap_seconds")
    if gap_val is None:
        checks["critical_inputs"] = {
            "passed": False,
            "missing": ["gap_seconds"],
            "severity": FailureSeverity.DECISION_BLOCKING.value,
        }
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.WITHHELD,
            primary_reason=PublicationReason.CRITICAL_INPUT_UNAVAILABLE.value,
            reason_codes=["MISSING_GAP_TELEMETRY", PublicationReason.CRITICAL_INPUT_UNAVAILABLE.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    checks["critical_inputs"] = {"passed": True, "gap_seconds": gap_val}

    # --------------------------------------------------------------------------
    # CHECK 7: Model & Config Hash Integrity
    # --------------------------------------------------------------------------
    model_sha = matrix.model_sha256
    model_sha_passed = True
    if model_sha and model_sha != EXPECTED_FROZEN_MODEL_SHA:
        model_sha_passed = False

    checks["model_integrity"] = {
        "passed": model_sha_passed,
        "observed_sha": model_sha,
        "expected_sha": EXPECTED_FROZEN_MODEL_SHA,
    }

    if not model_sha_passed:
        return FinalGateResult(
            approved=False,
            lifecycle_state=CallLifecycleState.BLOCKED,
            primary_reason=PublicationReason.MODEL_HASH_MISMATCH.value,
            reason_codes=["MODEL_BUNDLE_HASH_MISMATCH", PublicationReason.MODEL_HASH_MISMATCH.value],
            gate_time=gate_time,
            checks=checks,
            published_call=None,
        )

    # --------------------------------------------------------------------------
    # ALL CHECKS PASSED: CONSTRUCT PUBLISHED CALL
    # --------------------------------------------------------------------------
    valid_until_dt = now_dt + timedelta(seconds=cfg.call_validity_budget_s)
    valid_until_iso = valid_until_dt.isoformat()

    ui_call_label = ACTION_UI_MAP.get(candidate.backend_action, candidate.ui_call or "CALL")
    call_id = f"CALL_{cand_attacker}_{cand_defender}_{matrix.lap_number}_{uuid.uuid4().hex[:8]}"
    dec_snap_id = f"SNAP_{cand_attacker}_{cand_defender}_{matrix.lap_number}_{uuid.uuid4().hex[:8]}"
    battle_id = f"{cand_attacker}_{cand_defender}"

    published = PublishedCallSnapshot(
        call_id=call_id,
        decision_snapshot_id=dec_snap_id,
        matrix_snapshot_id=matrix.snapshot_id,
        battle_id=battle_id,
        backend_action=candidate.backend_action,
        ui_call=ui_call_label,
        lifecycle_state=CallLifecycleState.VALID,
        primary_reason=PublicationReason.GATE_PASSED.value,
        reason_codes=["FINAL_GATE_ALL_CHECKS_PASSED"],
        published_at=gate_time,
        valid_until=valid_until_iso,
        robustness=candidate.robustness,
        why_selected=candidate.why_selected,
        why_not_overtake=candidate.why_not_overtake,
        provenance={
            "publication_config_version": cfg.version,
            "publication_config_sha256": cfg.sha256,
            "model_sha256": matrix.model_sha256,
            "stability_manifest_sha256": matrix.stability_manifest_sha256,
            "strategy_config_sha256": matrix.strategy_config_sha256,
            "rule_bundle_version": matrix.rule_bundle_version,
            "source_mode": current_race_data.get("source_mode", "HISTORICAL_REPLAY"),
        },
        is_reanalysis=is_reanalysis,
    )

    return FinalGateResult(
        approved=True,
        lifecycle_state=CallLifecycleState.VALID,
        primary_reason=PublicationReason.GATE_PASSED.value,
        reason_codes=["FINAL_GATE_APPROVED"],
        gate_time=gate_time,
        checks=checks,
        published_call=published,
    )
