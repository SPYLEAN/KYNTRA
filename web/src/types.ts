/**
 * KYNTRA DecisionSnapshot TypeScript Types.
 * Strictly adheres to KYNTRA_FRONTEND_BACKEND_CONTRACT.md.
 */

export interface RaceStateSnapshot {
  event_id: string | null;
  event_name: string | null;
  lap: number | null;
  replay_time: number | null;
  attacker: string | null;
  defender: string | null;
  attacker_position: number | null;
  defender_position: number | null;
}

export interface ProvenanceSnapshot {
  telemetry_source: string;
  energy_source: string;
  regulation_config_version: string | null;
  event_config_version: string | null;
  overtake_model_version: string | null;
  stability_method: string | null;
}

export interface BattleStateSnapshot {
  gap_seconds: number | null;
  distance_gap_m: number | null;
  closing_rate: number | null;
  speed_delta: number | null;
  tyre_age_delta: number | null;
  laps_following: number | null;
  rear_threat: string | null;
}

export interface OvertakeInferenceSnapshot {
  available: boolean;
  model_version: string | null;
  p_1_lap: number | null;
  p_2_laps: number | null;
  p_3_laps: number | null;
  raw_p_1_lap: number | null;
  raw_p_2_laps: number | null;
  raw_p_3_laps: number | null;
  horizon_projection_applied: boolean;
  feature_missingness: string[];
}

export interface StabilitySnapshot {
  method: string;
  verdict: 'FAVORABLE' | 'CAUTION' | 'HIGH_RISK' | 'UNKNOWN';
  available: boolean;
  evidence: string[];
  reason?: string | null;
}

export interface EnergySnapshot {
  available_energy_mj: number | null;
  fraction: number | null;
  scenario: string | null;
  simulated: boolean;
  provenance: string;
  projected_action_cost_mj: number | null;
  projected_post_action_reserve_mj: number | null;
  sensitivity: 'ROBUST' | 'ENERGY_SENSITIVE' | null;
}

export interface ComplianceSnapshot {
  status: 'LEGAL' | 'BLOCKED' | 'UNKNOWN';
  allowed_actions: string[];
  blocked_actions: string[];
  reason_codes: string[];
}

export interface CounterfactualActionSnapshot {
  action: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';
  available: boolean;
  feasible: boolean | null;
  pass_outcome: string | null;
  retention_outcome: string | null;
  ending_energy_mj: number | null;
  future_opportunity: string | null;
  rank: number | null;
  reason?: string | null;
}

export interface RecommendationSnapshot {
  available: boolean;
  canonical_action: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE' | null;
  ui_label: 'SAVE ENERGY' | 'PREPARE' | 'APPLY PRESSURE' | 'OVERTAKE NOW' | null;
  robust: boolean | null;
  energy_sensitive: boolean | null;
  why: string[];
  reason?: string | null;
}

export interface DecisionSnapshot {
  race: RaceStateSnapshot;
  provenance: ProvenanceSnapshot;
  battle: BattleStateSnapshot;
  overtake: OvertakeInferenceSnapshot;
  energy: EnergySnapshot;
  stability: StabilitySnapshot;
  compliance: ComplianceSnapshot;
  counterfactuals: CounterfactualActionSnapshot[];
  recommendation: RecommendationSnapshot;
}

export interface EventInfo {
  event_id: string;
  event_name: string;
  circuit: string;
  total_laps: number;
  is_primary: boolean;
  description: string;
}

export interface SystemStatus {
  status: string;
  overtake_model: {
    loaded: boolean;
    model_name: string;
    model_version: string;
    algorithm: string;
    features: string[];
    metadata: Record<string, any>;
  };
  energy_simulator: {
    status: string;
    provenance: string;
    regulation: string;
    power_curve: string;
    lap_deployment_cap_mj: number;
  };
  demo_holdouts: {
    status: string;
    events: string[];
    leakage_risk: string;
  };
}
