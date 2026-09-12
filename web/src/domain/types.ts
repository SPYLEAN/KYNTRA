/**
 * KYNTRA CANONICAL FRONTEND DOMAIN
 * Authoritative typed representation of race state, battle intelligence,
 * strategy evaluation, and call publication for the KYNTRA runtime.
 * 
 * CORE PRODUCT RULE:
 * React does zero motorsport decision-making. React renders backend truth.
 * All operating modes (LIVE, FORECAST, REPLAY) map into these canonical domain types.
 */

// ============================================================================
// 1. TEMPORAL & OPERATING MODES
// ============================================================================

/**
 * Product-level operating modes selected by the operator.
 */
export type OperatingMode = 'LIVE' | 'FORECAST' | 'REPLAY';

/**
 * Explicit backend source provenance for runtime feeds.
 */
export type SourceMode =
  | 'LIVE_FEED'
  | 'CAPTURED_LIVE'
  | 'HISTORICAL_REPLAY'
  | 'REANALYSIS'
  | 'SYNTHETIC_TEST';

/**
 * Five permanent workstation contexts.
 */
export type WorkspaceContext = 'RACE' | 'STRATEGY' | 'EVENTS' | 'ANALYSIS' | 'SYSTEM';

// ============================================================================
// 2. STATUS & PROVENANCE TAXONOMY
// ============================================================================

/**
 * Standard data states across all components.
 */
export type DataState =
  | 'LOADING'
  | 'LIVE'
  | 'STALE'
  | 'UNKNOWN'
  | 'UNAVAILABLE'
  | 'EMPTY'
  | 'ERROR'
  | 'RECONNECTING';

/**
 * Canonical data provenance classes.
 */
export type ProvenanceClass =
  | 'LIVE'
  | 'PUBLIC SOURCE'
  | 'DERIVED'
  | 'FROZEN MODEL'
  | 'SIMULATED ENERGY'
  | 'RULE CHECK'
  | 'ORDINAL STABILITY'
  | 'FORECAST SIMULATION'
  | 'HISTORICAL OUTCOME'
  | 'REANALYSIS'
  | 'UNKNOWN';

export interface Provenance {
  source_class: ProvenanceClass;
  source_stream?: string;
  model_name?: string;
  model_version?: string;
  model_sha256?: string;
  config_version?: string;
  config_sha256?: string;
  calculation_method?: string;
  is_simulated?: boolean;
}

export interface FreshnessState {
  age_seconds: number | null;
  budget_seconds: number;
  is_stale: boolean;
  received_at: string | null;
  evaluated_at: string | null;
}

// ============================================================================
// 3. SYSTEM & MODULE HEALTH
// ============================================================================

export type SystemHealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'DECISION_BLOCKED' | 'OFFLINE';

export interface ModuleHealth {
  status: SystemHealthStatus;
  latency_ms?: number | null;
  error_message?: string | null;
  last_heartbeat?: string | null;
}

export interface SystemHealth {
  overall_status: SystemHealthStatus;
  pipeline_latency_ms: number | null;
  latency_breakdown?: Record<string, number>;
  modules: {
    telemetry_provider?: ModuleHealth;
    battle_tracker?: ModuleHealth;
    overtake_model?: ModuleHealth;
    energy_engine?: ModuleHealth;
    regulation_engine?: ModuleHealth;
    stability_engine?: ModuleHealth;
    strategy_brain?: ModuleHealth;
    publication_gate?: ModuleHealth;
    decision_store?: ModuleHealth;
  };
  updated_at: string;
}

// ============================================================================
// 4. RACE CONTEXT & TELEMETRY
// ============================================================================

export type TrackStatusFia = '1' | '2' | '4' | '5' | '6' | '7';
export type TrackFlagState = 'GREEN' | 'YELLOW' | 'SC' | 'VSC' | 'RED';

export interface DriverState {
  driver_code: string;
  driver_number?: number;
  team_name?: string;
  team_color?: string;
  position: number;
  gap_to_leader_s: number | null;
  interval_to_ahead_s: number | null;
  lap_number: number;
  tyre_compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTER' | 'WET' | 'UNKNOWN';
  tyre_age_laps: number | null;
  current_lap_time_s?: number | null;
  last_lap_time_s?: number | null;
  track_progress?: number | null;
  speed_kmh?: number | null;
  throttle_pct?: number | null;
  brake_pct?: number | null;
  gear?: number | null;
  drs_active?: boolean;
}

export interface RaceContext {
  event_id: string;
  event_name: string;
  session_type: string;
  circuit_name: string;
  current_lap: number;
  total_laps: number;
  track_status: TrackStatusFia;
  flag_state: TrackFlagState;
  clock_time_utc: string | null;
  elapsed_seconds: number | null;
  running_order: DriverState[];
  drivers_by_code: Record<string, DriverState>;
  provenance: Provenance;
}

// ============================================================================
// 5. BATTLE TRACKING CONTEXT
// ============================================================================

export type BattleClosingStatus = 'CLOSING' | 'STABLE' | 'DROPPING' | 'UNKNOWN';
export type RearThreatLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export interface BattleSummary {
  battle_id: string;
  attacker_code: string;
  defender_code: string;
  attacker_position: number;
  defender_position: number;
  gap_seconds: number | null;
  distance_gap_m: number | null;
  closing_rate_mps: number | null;
  closing_status: BattleClosingStatus;
  continuity_laps: number;
  pass_probability_p1: number | null;
  is_critical: boolean; // gap < 0.8s
  is_selected: boolean;
  freshness: FreshnessState;
}

export interface BattleContext {
  battle_id: string;
  attacker_code: string;
  defender_code: string;
  attacker: DriverState | null;
  defender: DriverState | null;
  gap_seconds: number | null;
  distance_gap_m: number | null;
  closing_rate_mps: number | null;
  speed_delta_kmh: number | null;
  pace_delta_1lap_s: number | null;
  pace_delta_3laps_s: number | null;
  tyre_age_delta_laps: number | null;
  laps_following: number;
  rear_threat: RearThreatLevel;
  rear_threat_car?: string | null;
  provenance: Provenance;
  freshness: FreshnessState;
}

// ============================================================================
// 6. PREDICTION & HORIZON (P1, P2, P3)
// ============================================================================

export interface PassWindow {
  horizon_laps: 1 | 2 | 3;
  p_pass_raw: number | null;
  p_pass_projected: number | null; // PAV calibrated monotonic
  horizon_projection_applied: boolean;
  model_name: string;
  model_version: string;
  model_sha256: string;
  feature_missingness: string[];
  provenance: Provenance;
}

// ============================================================================
// 7. SIMULATED ENERGY (2026 MGU-K)
// ============================================================================

export interface EnergyScenario {
  scenario_name: 'CONSERVATIVE' | 'NOMINAL' | 'FAVORABLE';
  available_energy_mj: number | null;
  planned_deployment_mj: number | null;
  expected_recovery_mj: number | null;
  terminal_energy_mj: number | null;
  state_of_charge_fraction: number | null;
  is_feasible: boolean;
}

export interface EnergyState {
  available_energy_mj: number | null;
  state_of_charge_fraction: number | null;
  lap_deployment_cap_mj: number; // 4.0 MJ per 2026 regulations
  max_power_kw: number; // 350 kW MGU-K limit
  active_scenario: 'CONSERVATIVE' | 'NOMINAL' | 'FAVORABLE';
  scenarios: Record<string, EnergyScenario>;
  is_regulation_constrained: boolean;
  provenance: Provenance;
  freshness: FreshnessState;
}

// ============================================================================
// 8. RULES & REGULATIONS
// ============================================================================

export type RuleStatus = 'ALLOWED' | 'RESTRICTED' | 'BLOCKED' | 'UNKNOWN';

export interface RuleState {
  status: RuleStatus;
  rule_bundle_version: string;
  rule_bundle_sha256: string;
  active_flags: string[];
  vsc_or_sc_active: boolean;
  yellow_flag_in_sector: boolean;
  drs_legal: boolean;
  allowed_actions: CanonicalAction[];
  blocked_actions: CanonicalAction[];
  disqualification_reasons: Record<string, string>;
  provenance: Provenance;
  freshness: FreshnessState;
}

// ============================================================================
// 9. STABILITY V1
// ============================================================================

export type StabilityVerdict = 'FAVORABLE' | 'CAUTION' | 'HIGH_RISK' | 'UNKNOWN';

export interface StabilityState {
  verdict: StabilityVerdict;
  stability_method: string;
  config_version: string;
  available: boolean;
  available_evidence_families: string[];
  triggered_evidence_families: string[];
  reason: string | null;
  provenance: Provenance;
  freshness: FreshnessState;
}

// ============================================================================
// 10. STRATEGY MATRIX & COUNTERFACTUAL ACTIONS
// ============================================================================

export type CanonicalAction = 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';
export type ActionUiLabel = 'SAVE ENERGY' | 'PREPARE' | 'APPLY PRESSURE' | 'OVERTAKE NOW';

export interface StrategyAction {
  action: CanonicalAction;
  ui_label: ActionUiLabel;
  is_available: boolean;
  is_feasible: boolean;
  is_compliant: boolean;
  delta_lap_time_s: number | null;
  p_pass_1lap: number | null;
  p_pass_2laps: number | null;
  p_pass_3laps: number | null;
  terminal_energy_mj: number | null;
  risk_severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  stability_verdict: StabilityVerdict;
  candidate_rank: number | null; // 1 to 4 (1 = winner)
  is_winner: boolean;
  is_disqualified: boolean;
  disqualification_reason: string | null;
  elimination_rationale: string | null;
}

export interface ScenarioRanking {
  scenario_name: string;
  winning_action: CanonicalAction;
  rank_order: CanonicalAction[];
}

export interface StrategyRanking {
  ranking_method: 'LEXICOGRAPHIC_6_TIER';
  ranked_actions: CanonicalAction[];
  winner: CanonicalAction | null;
  is_true_tie_abstention: boolean;
  elimination_traces: Record<CanonicalAction, string>;
}

export interface StrategyMatrix {
  snapshot_id: string;
  matrix_timestamp: string;
  fair_baseline_preconditions: {
    attacker_energy_mj: number | null;
    gap_seconds: number | null;
    closing_rate_mps: number | null;
    track_status: string | null;
  };
  actions: Record<CanonicalAction, StrategyAction>;
  ranking: StrategyRanking;
  scenario_rankings: Record<string, ScenarioRanking>;
  robustness_classification:
    | 'ROBUST WITHIN TESTED ASSUMPTIONS'
    | 'ENERGY-SENSITIVE'
    | 'INSUFFICIENT INFORMATION';
  provenance: Provenance;
  freshness: FreshnessState;
}

// ============================================================================
// 11. KYNTRA CANDIDATE & PUBLISHED CALL
// ============================================================================

export type CallLifecycleState =
  | 'PENDING_FINAL_GATE'
  | 'VALID'
  | 'AGING'
  | 'EXPIRED'
  | 'INVALIDATED'
  | 'BLOCKED'
  | 'WITHHELD';

export interface KyntraCandidate {
  canonical_action: CanonicalAction | null;
  ui_label: ActionUiLabel | null;
  raw_rank_winner: CanonicalAction | null;
  generated_at: string;
  publication_status: 'PENDING_FINAL_GATE';
}

export interface KyntraCall {
  decision_id: string;
  canonical_action: CanonicalAction | null;
  ui_label: ActionUiLabel | null;
  lifecycle_state: CallLifecycleState;
  published_at: string | null;
  valid_until: string | null;
  remaining_seconds: number | null;
  why_selected: string[];
  why_not: Record<CanonicalAction, string>;
  scenario_winners: Record<string, CanonicalAction>;
  robustness:
    | 'ROBUST WITHIN TESTED ASSUMPTIONS'
    | 'ENERGY-SENSITIVE'
    | 'INSUFFICIENT INFORMATION';
  final_gate_passed: boolean;
  gate_reason_codes: string[];
  provenance: Provenance;
}

// ============================================================================
// 12. FORENSIC DECISION SNAPSHOT
// ============================================================================

export interface DecisionSnapshotSummary {
  decision_id: string;
  timestamp: string;
  battle_id: string;
  lap: number;
  published_action: CanonicalAction | null;
  lifecycle_state: CallLifecycleState;
  is_reanalysis: boolean;
  provenance_summary: string;
}

// ============================================================================
// 13. COMPOSITE RUNTIME CONTEXT
// ============================================================================

export interface RuntimeContext {
  operating_mode: OperatingMode;
  source_mode: SourceMode;
  workspace: WorkspaceContext;
  race: RaceContext | null;
  active_battles: BattleSummary[];
  selected_battle_id: string | null;
  selected_battle: BattleContext | null;
  pass_windows: PassWindow[];
  energy: EnergyState | null;
  rules: RuleState | null;
  stability: StabilityState | null;
  strategy_matrix: StrategyMatrix | null;
  candidate_call: KyntraCandidate | null;
  published_call: KyntraCall | null;
  system_health: SystemHealth;
  decision_history: DecisionSnapshotSummary[];
  is_reconnecting: boolean;
  is_polling_fallback: boolean;
  last_sync_timestamp: string | null;
}
