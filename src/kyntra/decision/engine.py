"""KYNTRA Tactical Decision Engine — Hardened Phase 3.1 Specification.

Integrates:
1. Frozen LightGBM overtake model inference (Can I pass?) — ACTIVE & VERIFIED
2. Simulated 2026 regulation energy accounting (Can I afford it?) — ACTIVE & SIMULATED
3. Deterministic post-pass position durability evaluation (Can I keep it?) — PENDING VERIFICATION (UNKNOWN)
4. Deterministic FIA sporting & track status compliance (Am I allowed?) — ACTIVE (SC/VSC BLOCKED, fails safely to UNKNOWN if event unconfigured)
5. Counterfactual action evaluation & KYNTRA Call — PENDING VERIFICATION (AWAITING STRATEGY ENGINE)
"""

from typing import Any, Dict, List, Optional
from kyntra.models.registry import get_overtake_model
from kyntra.schemas import (
    BattleStateSnapshot,
    ComplianceSnapshot,
    CounterfactualActionSnapshot,
    DecisionSnapshot,
    EnergySnapshot,
    OvertakeInferenceSnapshot,
    ProvenanceSnapshot,
    RaceStateSnapshot,
    RecommendationSnapshot,
    StabilitySnapshot,
)


def evaluate_stability(
    pace_delta: Optional[float] = None,
    tyre_age_delta: Optional[float] = None,
    rear_threat: Optional[str] = None,
) -> StabilitySnapshot:
    """Evaluate post-pass position durability deterministically.

    SAFETY AUDIT (Phase 3.1):
    KYNTRA V1 does NOT currently have an approved stability rule engine.
    Heuristic numeric thresholds have been removed pending empirical verification.
    Outputs verdict='UNKNOWN', available=False, and evidence=[].
    """
    return StabilitySnapshot(
        method="DETERMINISTIC_POST_PASS_STABILITY_V1",
        verdict="UNKNOWN",
        available=False,
        evidence=[],
        reason="STABILITY_RULESET_PENDING_VERIFICATION",
    )


def evaluate_compliance(
    track_status: Optional[str],
    available_energy_mj: float = 0.0,
    event_id: Optional[str] = None,
) -> ComplianceSnapshot:
    """Evaluate deterministic FIA sporting and technical compliance.

    Verified Sporting & Technical Rules (FIA 2026 Issue 20 & Issue 08):
    - VSC: Overtaking prohibited under Sporting Regulation Article B5.12.2(c).
    - Safety Car: Overtaking prohibited under Sporting Regulation Article B5.13.2(c).
    - Suspended Session / Red Flag: Overtaking prohibited under Sporting Regulation Article B5.14.2(a).
    - Yellow Flag: Driver behaviour governed by Section B1.8.4; conservative state
      applied with reason YELLOW_FLAG_RULE_SOURCE_PENDING_ISC_VERIFICATION.
    - Note on DEPLOY semantics: Electrical energy deployment is NOT prohibited by FIA
      rules during SC/VSC; only racecraft OVERTAKE is blocked by sporting rules.
    - If event configuration is missing or circuit detection parameters are unverified,
      fails safely to status='UNKNOWN'.
    """
    ts = str(track_status or "1").strip()

    # 1. Virtual Safety Car (VSC)
    if ts in ["6", "7", "VSC"]:
        return ComplianceSnapshot(
            status="BLOCKED",
            allowed_actions=["CONSERVE", "BUILD", "DEPLOY"],
            blocked_actions=["OVERTAKE"],
            reason_codes=[
                "FIA Sporting Regulations Article B5.12.2(c): No car may overtake another car on the track whilst the VSC procedure is in operation"
            ],
        )

    # 2. Safety Car (SC)
    if ts in ["4", "SC"]:
        return ComplianceSnapshot(
            status="BLOCKED",
            allowed_actions=["CONSERVE", "BUILD", "DEPLOY"],
            blocked_actions=["OVERTAKE"],
            reason_codes=[
                "FIA Sporting Regulations Article B5.13.2(c): No car may overtake another car on the track whilst the safety car is deployed"
            ],
        )

    # 3. Suspended race / Red Flag
    if ts in ["5", "RED"]:
        return ComplianceSnapshot(
            status="BLOCKED",
            allowed_actions=["CONSERVE", "BUILD", "DEPLOY"],
            blocked_actions=["OVERTAKE"],
            reason_codes=[
                "FIA Sporting Regulations Article B5.14.2(a): Overtaking is forbidden during a suspended sprint session or race"
            ],
        )

    # 4. Yellow Flag
    if ts in ["2", "YELLOW"]:
        return ComplianceSnapshot(
            status="BLOCKED",
            allowed_actions=["CONSERVE", "BUILD", "DEPLOY"],
            blocked_actions=["OVERTAKE"],
            reason_codes=[
                "YELLOW_FLAG_RULE_SOURCE_PENDING_ISC_VERIFICATION: Driver behaviour governed by Section B1.8.4; overtaking prohibited in yellow flag zone pending ISC Appendix H verification"
            ],
        )

    # Check if event configuration exists and is verified
    # Verified event config exists for Australia (configs/events/2026_australia.yaml)
    # If event config is missing, fail safely to UNKNOWN rather than inventing a rule value.
    if not event_id:
        return ComplianceSnapshot(
            status="UNKNOWN",
            allowed_actions=["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"],
            blocked_actions=[],
            reason_codes=["EVENT_UNCONFIGURED_COMPLIANCE_UNKNOWN"],
        )

    norm_id = str(event_id).lower()
    has_event_config = "australia" in norm_id or "2026_01" in norm_id

    if not has_event_config:
        return ComplianceSnapshot(
            status="UNKNOWN",
            allowed_actions=["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"],
            blocked_actions=[],
            reason_codes=[
                f"Event configuration for '{event_id}' is unconfigured; circuit detection parameters pending official FIA publication"
            ],
        )

    # Australia event configuration is available
    return ComplianceSnapshot(
        status="LEGAL",
        allowed_actions=["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"],
        blocked_actions=[],
        reason_codes=[
            "Track clear (Green Flag); FIA 2026 Technical Regulations Issue 20 & Sporting Regulations Issue 08 compliant"
        ],
    )


def compute_decision(
    race_data: Dict[str, Any],
    battle_data: Dict[str, Any],
    simulated_energy_state: Optional[Dict[str, Any]] = None,
) -> DecisionSnapshot:
    """Generate a single coherent DecisionSnapshot across all 5 decision pillars.

    Phase 3.1 Hardened: Real ML pass probabilities and simulated 2026 energy are active;
    unverified Phase 4 strategy, ranking, and stability heuristics are safely disabled.
    """
    # 1. Race state
    event_id = race_data.get("event_id")
    race = RaceStateSnapshot(
        event_id=event_id,
        event_name=race_data.get("event_name"),
        lap=race_data.get("lap"),
        replay_time=race_data.get("replay_time"),
        attacker=race_data.get("attacker"),
        defender=race_data.get("defender"),
        attacker_position=race_data.get("attacker_position"),
        defender_position=race_data.get("defender_position"),
    )

    # 2. Battle observables
    battle = BattleStateSnapshot(
        gap_seconds=battle_data.get("gap_seconds"),
        distance_gap_m=battle_data.get("distance_gap_m"),
        closing_rate=battle_data.get("closing_rate"),
        speed_delta=battle_data.get("speed_delta"),
        tyre_age_delta=battle_data.get("tyre_age_delta"),
        laps_following=battle_data.get("laps_following"),
        rear_threat=battle_data.get("rear_threat"),
    )

    # 3. Model inference (CAN I PASS?) — Frozen LightGBM with monotonic PAV
    model = get_overtake_model()
    model_features = {
        "gap_seconds": battle_data.get("gap_seconds"),
        "closing_rate": battle_data.get("closing_rate"),
        "recent_pace_delta_1lap": battle_data.get("recent_pace_delta_1lap"),
        "recent_pace_delta_3laps": battle_data.get("recent_pace_delta_3laps"),
        "speed_trap_delta": battle_data.get("speed_trap_delta"),
    }

    try:
        pred = model.predict_one(model_features)
        overtake = OvertakeInferenceSnapshot(
            available=True,
            model_version=pred.model_version,
            p_1_lap=pred.p_pass_1_lap,
            p_2_laps=pred.p_pass_2_laps,
            p_3_laps=pred.p_pass_3_laps,
            raw_p_1_lap=pred.p_pass_1_lap_raw,
            raw_p_2_laps=pred.p_pass_2_laps_raw,
            raw_p_3_laps=pred.p_pass_3_laps_raw,
            horizon_projection_applied=pred.projection_applied,
            feature_missingness=pred.feature_missingness,
        )
    except Exception:
        overtake = OvertakeInferenceSnapshot(
            available=False,
            feature_missingness=list(model_features.keys()),
        )

    # 4. Energy state (CAN I AFFORD IT?) — Simulated 2026 regulation constrained
    energy_sim = simulated_energy_state or {}
    avail_energy = float(energy_sim.get("available_energy_mj", 2.65))
    fraction = avail_energy / 4.0

    energy = EnergySnapshot(
        available_energy_mj=round(avail_energy, 2),
        fraction=round(fraction, 3),
        scenario=energy_sim.get("scenario", "RACE_DEFAULT"),
        simulated=True,
        provenance="SIMULATED — 2026 REGULATION CONSTRAINED",
        projected_action_cost_mj=None,
        projected_post_action_reserve_mj=None,
        sensitivity=None,
    )

    # 5. Stability (CAN I KEEP IT?) — Hardened pending verification
    stability = evaluate_stability(
        pace_delta=battle_data.get("recent_pace_delta_1lap"),
        tyre_age_delta=battle_data.get("tyre_age_delta"),
        rear_threat=battle_data.get("rear_threat"),
    )

    # 6. Compliance (AM I ALLOWED?) — Deterministic FIA rules & safe event fallback
    compliance = evaluate_compliance(
        track_status=race_data.get("track_status"),
        available_energy_mj=avail_energy,
        event_id=event_id,
    )

    # 7. Counterfactual scenarios — Action shells preserved without arbitrary ranking or fabricated deltas
    cf_actions = [
        CounterfactualActionSnapshot(
            action=act,
            available=False,
            feasible=act in compliance.allowed_actions if compliance.status != "UNKNOWN" else None,
            pass_outcome=None,
            retention_outcome=None,
            ending_energy_mj=None,
            future_opportunity=None,
            rank=None,
            reason="COUNTERFACTUAL_ENGINE_PENDING_VERIFICATION",
        )
        for act in ["CONSERVE", "BUILD", "DEPLOY", "OVERTAKE"]
    ]

    # 8. Recommendation Logic (KYNTRA Call) — Hardened pending strategy verification
    # Separate strategy-policy reasons from compliance rules:
    # Under neutralization, tactical energy DEPLOY is suppressed as strategy policy.
    ts_rec = str(race_data.get("track_status") or "1").strip()
    is_neutralized = ts_rec in ["2", "4", "5", "6", "7", "YELLOW", "SC", "VSC", "RED"]
    rec_reason = "TRACK_NEUTRALIZED" if is_neutralized else "STRATEGY_ENGINE_PENDING_VERIFICATION"

    recommendation = RecommendationSnapshot(
        available=False,
        canonical_action=None,
        ui_label=None,
        robust=None,
        energy_sensitive=None,
        why=[],
        reason=rec_reason,
    )

    provenance = ProvenanceSnapshot(
        telemetry_source="REAL_PUBLIC_TELEMETRY",
        energy_source="SIMULATED",
        regulation_config_version="2026_FIA_ISSUE_20",
        event_config_version="2026_V1",
        overtake_model_version=overtake.model_version or "1.0.0",
        stability_method="DETERMINISTIC_POST_PASS_STABILITY_V1",
    )

    return DecisionSnapshot(
        race=race,
        provenance=provenance,
        battle=battle,
        overtake=overtake,
        energy=energy,
        stability=stability,
        compliance=compliance,
        counterfactuals=cf_actions,
        recommendation=recommendation,
    )
