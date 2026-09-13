"""Canonical Strategist Matrix generator for KYNTRA.

Builds the complete StrategyMatrixSnapshot across all four counterfactual actions.
Enforces:
- Fair baseline rule (order-independent evaluation from identical state)
- ML truth invariant (no fake action-conditioned probabilities)
- 2026 regulation constrained energy scenarios
- Stability V1 consensus integration
- Disabled ranking and recommendation in Phase 07.
"""

from datetime import datetime, timezone
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from kyntra.models.registry import get_overtake_model
from kyntra.stability import evaluate_stability
from kyntra.stability.manifest import get_default_manifest_path, load_stability_manifest
from kyntra.strategy.config import load_strategy_counterfactual_config
from kyntra.strategy.counterfactuals import simulate_action_outcome
from kyntra.strategy.models import (
    ActionOutcomeSnapshot,
    CandidateRecommendation,
    PassWindowSnapshot,
    StrategistAction,
    StrategyMatrixSnapshot,
    StrategyRankingSnapshot,
)
from kyntra.strategy.ranking import evaluate_lexicographic_ranking
from kyntra.strategy.recommendation import generate_candidate_recommendation

FROZEN_MODEL_SHA = "a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5"


def generate_strategy_matrix(
    race_data: Dict[str, Any],
    battle_data: Dict[str, Any],
    simulated_energy_state: Optional[Dict[str, Any]] = None,
    horizon_laps: int = 3,
    action_order: Optional[List[StrategistAction]] = None,
    enable_ranking: bool = False,
) -> StrategyMatrixSnapshot:
    """Generate canonical StrategyMatrixSnapshot evaluating CONSERVE, BUILD, DEPLOY, OVERTAKE.
    
    Args:
        race_data: Current race state dictionary (lap, track_status, event_id, etc.).
        battle_data: Current battle telemetry dictionary (gap_seconds, closing_rate, deltas).
        simulated_energy_state: Optional simulated energy accounting dictionary.
        horizon_laps: Strategist rollout horizon in laps (default: 3).
        action_order: Optional explicit evaluation sequence for regression testing.
        enable_ranking: Whether to execute Phase 08 Lexicographic Strategy Ranking (default: False).
    
    Returns:
        StrategyMatrixSnapshot: Immutable-style canonical strategy matrix.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    snapshot_id = f"sms_{uuid.uuid4().hex[:12]}"

    attacker = str(race_data.get("attacker") or battle_data.get("attacker") or "ANT")
    defender = str(race_data.get("defender") or battle_data.get("defender") or "VER")
    lap = int(race_data.get("lap") or battle_data.get("lap") or 1)
    event_id = race_data.get("event_id")
    battle_id = f"{event_id or 'EVENT'}_L{lap}_{attacker}_vs_{defender}"

    # 1. Manifest metadata
    manifest, manifest_sha = load_stability_manifest()
    manifest_ver = manifest.manifest_version if manifest else "1.1.0"
    dataset_sha = manifest.dataset_sha256 if manifest else None

    # 2. Extract Pass Window (CAN I PASS?) from frozen LightGBM model
    model = get_overtake_model()
    model_features = {
        "gap_seconds": battle_data.get("gap_seconds"),
        "closing_rate": battle_data.get("closing_rate"),
        "recent_pace_delta_1lap": battle_data.get("recent_pace_delta_1lap"),
        "recent_pace_delta_3laps": battle_data.get("recent_pace_delta_3laps"),
        "speed_trap_delta": battle_data.get("speed_trap_delta"),
    }

    missing_model_feats = [f for f, v in model_features.items() if v is None]
    if missing_model_feats:
        pass_window = PassWindowSnapshot(
            available=False,
            p1=None,
            p2=None,
            p3=None,
            raw_p1=None,
            raw_p2=None,
            raw_p3=None,
            pav_applied=False,
            provenance="FROZEN_MODEL_FEATURE_MISSING",
        )
    else:
        try:
            pred = model.predict_one(model_features)
            pass_window = PassWindowSnapshot(
                available=True,
                p1=pred.p_pass_1_lap,
                p2=pred.p_pass_2_laps,
                p3=pred.p_pass_3_laps,
                raw_p1=pred.p_pass_1_lap_raw,
                raw_p2=pred.p_pass_2_laps_raw,
                raw_p3=pred.p_pass_3_laps_raw,
                pav_applied=pred.projection_applied,
                provenance="FROZEN_MODEL",
            )
        except Exception:
            pass_window = PassWindowSnapshot(
                available=False,
                provenance="FROZEN_MODEL_ERROR",
            )

    # 3. Extract Post-Pass Stability (CAN I KEEP IT?) from Stability V1
    stability_res = evaluate_stability(
        features={
            "closing_rate": battle_data.get("closing_rate"),
            "recent_pace_delta_1lap": battle_data.get("recent_pace_delta_1lap"),
            "recent_pace_delta_3laps": battle_data.get("recent_pace_delta_3laps"),
            "speed_trap_delta": battle_data.get("speed_trap_delta"),
            "tyre_age_delta": battle_data.get("tyre_age_delta"),
        }
    )

    # 4. Energy state extraction
    avail_energy_mj = None
    if simulated_energy_state and "available_energy_mj" in simulated_energy_state:
        avail_energy_mj = float(simulated_energy_state["available_energy_mj"])

    # 5. Load strategy counterfactual configuration
    strat_cfg = load_strategy_counterfactual_config()

    # 6. Fair Baseline Action Evaluation
    actions_to_evaluate = action_order or [
        StrategistAction.CONSERVE,
        StrategistAction.BUILD,
        StrategistAction.DEPLOY,
        StrategistAction.OVERTAKE,
    ]

    actions_dict: Dict[str, ActionOutcomeSnapshot] = {}

    for act in actions_to_evaluate:
        outcome = simulate_action_outcome(
            action=act,
            race_data=race_data,
            battle_data=battle_data,
            available_energy_mj=avail_energy_mj,
            pass_window=pass_window,
            stability_result=stability_res,
            horizon_laps=horizon_laps,
            strategy_config=strat_cfg,
        )
        actions_dict[act.value] = outcome

    # 7. Evaluate Lexicographic Strategy Ranking & Candidate Recommendation
    if enable_ranking:
        ranking_snapshot = evaluate_lexicographic_ranking(
            matrix_actions=actions_dict,
            strategy_config=strat_cfg,
            battle_data=battle_data,
        )
        candidate_rec = generate_candidate_recommendation(
            ranking_snapshot=ranking_snapshot,
            matrix_actions=actions_dict,
            battle_data=battle_data,
        )
        ranking_dict = ranking_snapshot.model_dump()
        rec_dict = candidate_rec.model_dump()
        primary_reason = candidate_rec.primary_reason or "STRATEGY_MATRIX_EVALUATED"
    else:
        ranking_dict = {"available": False, "reason": "STRATEGY_RANKING_PENDING_PHASE_08"}
        rec_dict = {"available": False, "reason": "STRATEGY_RANKING_PENDING_PHASE_08"}
        primary_reason = "STRATEGY_RANKING_PENDING_PHASE_08"

    # Assemble summary
    state_summary = {
        "gap_seconds": battle_data.get("gap_seconds"),
        "closing_rate": battle_data.get("closing_rate"),
        "recent_pace_delta_1lap": battle_data.get("recent_pace_delta_1lap"),
        "speed_trap_delta": battle_data.get("speed_trap_delta"),
        "tyre_age_delta": battle_data.get("tyre_age_delta"),
        "available_energy_mj": avail_energy_mj,
        "track_status": race_data.get("track_status", "1"),
    }

    return StrategyMatrixSnapshot(
        snapshot_id=snapshot_id,
        battle_id=battle_id,
        mode=race_data.get("mode", "REPLAY"),
        source_mode=race_data.get("source_mode", "HISTORICAL_REPLAY"),
        event_time=race_data.get("event_time"),
        received_time=now_iso,
        decision_time=now_iso,
        state_age_ms=0.0,
        freshness_status="FRESH",
        session_key=str(race_data["session_key"]) if race_data.get("session_key") is not None else None,
        lap_number=lap,
        attacker=attacker,
        defender=defender,
        model_version=getattr(model, "MODEL_VERSION", "1.0.0"),
        model_sha256=FROZEN_MODEL_SHA,
        rule_bundle_version="2026_FIA_ISSUE_20",
        stability_manifest_version=manifest_ver,
        stability_manifest_sha256=manifest_sha,
        dataset_sha256=dataset_sha,
        strategy_config_version=strat_cfg.version,
        strategy_config_sha256=strat_cfg.sha256,
        assumption_profile=strat_cfg.assumption_profile,
        energy_config_version="2026.1",
        current_state_summary=state_summary,
        pass_window=pass_window,
        actions=actions_dict,
        ranking=ranking_dict,
        recommendation=rec_dict,
        reason=primary_reason,
    )
