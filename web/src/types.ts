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
  decision_id?: string;
  strategy_matrix?: any;
  published_call?: any;
  final_gate_result?: any;
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

export interface CarState {
  driver: string;
  number: string;
  name?: string | null;
  team?: string | null;
  color?: string | null;
  position?: number | null;
  gap_to_leader?: number | null;
  gap_to_car_ahead?: number | null;
  speed?: number | null;
  tyre_compound?: string | null;
  tyre_age?: number | null;
  pit_status?: string | null;
  drs_active?: boolean | null;
  last_lap_time?: string | null;
  x?: number | null;
  y?: number | null;
  progress?: number | null;
}

export interface TrackState {
  track_status: string;
  sector?: number | null;
  weather?: string | null;
  active_flags: string[];
  event_config_available: boolean;
}

export interface SessionState {
  event_id: string;
  event_name: string;
  circuit?: string | null;
  session_type: string;
  current_lap: number;
  total_laps: number;
  session_time?: number | null;
  replay_time?: number | null;
  data_mode: string;
  source_mode?: 'LIVE_FEED' | 'CAPTURED_LIVE' | 'HISTORICAL_REPLAY' | string;
  provider?: string;
  meeting?: string;
  last_update_timestamp?: number | null;
  data_age?: number | null;
}

export interface RaceState {
  session: SessionState;
  track: TrackState;
  cars: Record<string, CarState>;
  timestamp: number;
}

export interface RaceEvent {
  event_id: string;
  timestamp: number;
  race_id: string;
  lap?: number | null;
  sector?: number | null;
  event_type: string;
  cars: string[];
  battle_id?: string | null;
  raw_state_reference?: string | null;
  derived_data: Record<string, any>;
  source: string;
  provenance: string;
}

export interface BattleWatchlistItem {
  battle_id: string;
  attacker: string;
  defender: string;
  attacker_position?: number | null;
  defender_position?: number | null;
  gap_seconds?: number | null;
  gap_trend?: 'CLOSING' | 'STABLE' | 'OPENING' | 'UNKNOWN' | null;
  closing_state?: string | null;
  window_state?: 'FORMING' | 'STABLE' | 'PEAKING' | 'FADING' | 'UNKNOWN' | null;
  model_available: boolean;
  compliance_status: 'LEGAL' | 'BLOCKED' | 'UNKNOWN';
  priority_state: 'WATCH' | 'FORMING' | 'ACTIVE' | 'CRITICAL' | 'UNKNOWN';
}

export interface WindowObservation {
  timestamp: number;
  p1?: number | null;
  p2?: number | null;
  p3?: number | null;
  gap?: number | null;
  closing_rate?: number | null;
}

export interface WindowState {
  battle_id: string;
  window_state: 'FORMING' | 'STABLE' | 'PEAKING' | 'FADING' | 'UNKNOWN';
  trend_direction: 'INCREASING' | 'FLAT' | 'DECREASING' | 'UNKNOWN';
  recent_history: WindowObservation[];
  peak_observed_probability?: number | null;
  peak_observed_time?: number | null;
}

export interface TrackPoint {
  x: number;
  y: number;
  progress: number;
}

export interface TrackGeometry {
  event_id: string;
  circuit_name: string;
  view_box: string;
  path_d: string;
  points: TrackPoint[];
  sector_markers: { sector: number; progress: number }[];
  activation_line_progress: number;
  detection_line_progress: number;
}

export interface LiveUpdatePayload {
  type: string;
  timestamp: number;
  event_id: string;
  race_state: RaceState;
  decision: DecisionSnapshot | null;
  watchlist: BattleWatchlistItem[];
  active_windows: Record<string, WindowState>;
  selected_battle_id?: string | null;
  recent_events: RaceEvent[];
  provider_meta: Record<string, any>;
  capabilities: Record<string, any>;
}

export type OperatingMode = 'LIVE' | 'REPLAY' | 'FORECAST';
export type ContextWorkspace = 'RACE' | 'STRATEGY' | 'EVENTS' | 'ANALYSIS' | 'SYSTEM';

export type WorkspaceId = 'RACE' | 'STRATEGY' | 'EVENTS' | 'ANALYSIS' | 'SYSTEM';

export type SystemTabId = 'OVERVIEW' | 'DATA' | 'MODEL' | 'ENERGY' | 'FIA' | 'PROVIDERS' | 'LIMITATIONS' | 'TECH_STACK';

export type InspectorType = 'MODEL' | 'ENERGY' | 'COMPLIANCE' | 'CAR' | 'BATTLE' | 'EVENT' | null;

export type TrackViewMode = 'FIELD' | 'FOCUS';

export interface InspectorTarget {
  type: InspectorType;
  carDriver?: string | null;
  battleId?: string | null;
  eventItem?: RaceEvent | null;
}

export interface TrackLayerState {
  cars: boolean;
  sectors: boolean;
  battles: boolean;
  drs?: boolean;
  detection?: boolean;
}

export interface TimelineMarker {
  id: string;
  timestamp: number;
  race_id: string;
  lap: number | null;
  event_type: 'BATTLE' | 'PASS' | 'PIT' | 'FLAG' | 'WINDOW' | 'TRACK_STATUS' | string;
  cars: string[];
  battle_id?: string | null;
  label?: string;
}

export interface ProviderCapabilityItem {
  id: string;
  name: string;
  status: string;
  capabilities: Record<string, string>;
  notes: string;
}

export interface ForecastScenario {
  id: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';
  title: string;
  description: string;
  energyTargetMj: number;
  expectedLapsToAttempt: number;
  simulatedSuccessRate: number;
  endOfStintSocPercent: number;
  counterPassRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
}

export interface HistoricalComparison {
  timestamp: number;
  lap: number;
  battle_id: string;
  what_kyntra_saw: {
    p_1_lap: number;
    p_2_laps: number;
    p_3_laps: number;
    window_state: string;
    energy_available_mj: number;
    compliance_status: string;
  };
  what_happened_next: {
    outcome: 'OVERTAKE_SUCCESS' | 'DEFENDED_SUCCESS' | 'COUNTER_ATTACK' | 'STALEMATE';
    actual_pass_lap: number | null;
    position_change: string;
    resolved_within_laps: number;
    notes: string;
  };
}

export type LayoutPreset = 'PIT_WALL' | 'ANALYSIS' | 'DEMO';

export interface TelemetryPoint {
  timestamp: number;
  attackerSpeed: number;
  defenderSpeed: number;
  gapSeconds: number;
  closingRate: number;
  relativePace: number;
  p1?: number;
  p2?: number;
  p3?: number;
}

export type RuntimeMode = 'LIVE_FEED' | 'CAPTURED_LIVE' | 'HISTORICAL_REPLAY' | 'REANALYSIS' | 'SYNTHETIC_TEST';
export type SystemHealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'DECISION_BLOCKED' | 'OFFLINE';

export interface ModuleHealth {
  module_name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';
  reason?: string | null;
  freshness_s?: number;
  latency_ms?: number;
}

export interface RuntimeHealthSnapshot {
  system_health: SystemHealthStatus;
  modules: Record<string, ModuleHealth>;
  updated_at: string;
}

export interface LatencyMetrics {
  ingestion_ms: number;
  features_ms: number;
  inference_ms: number;
  matrix_ms: number;
  ranking_ms: number;
  gate_ms: number;
  total_cycle_ms: number;
  rolling_total_p50_ms: number;
  rolling_total_p95_ms: number;
}

export interface ActiveBattleTracker {
  battle_id: string;
  attacker: string;
  defender: string;
  first_seen_lap: number;
  last_seen_lap: number;
  laps_active: number;
  consecutive_active_ticks: number;
  current_gap_s: number;
  is_continuous_over_laps: boolean;
  is_expired: boolean;
  window_state: string;
}

export interface StrategyMatrixActionData {
  action: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';
  rule_eligibility: {
    status: 'ALLOWED' | 'BLOCKED' | 'UNKNOWN';
    rule_id?: string | null;
    reason_code?: string | null;
    article?: string | null;
    provenance: string;
  };
  pass_context: {
    p_pass_1_lap?: number | null;
    p_pass_2_laps?: number | null;
    p_pass_3_laps?: number | null;
    horizon_applied: boolean;
    provenance: string;
    model_sha256?: string | null;
  };
  energy_accounting: {
    before_energy_mj: number;
    deployment_mj: number;
    recovery_mj: number;
    terminal_energy_mj: number;
    scenario: string;
    assumption_profile: string;
    provenance: string;
  };
  post_pass_stability: {
    verdict: 'FAVORABLE' | 'CAUTION' | 'HIGH_RISK' | 'UNKNOWN';
    available: boolean;
    reason: string;
    manifest_version: string;
    provenance: string;
  };
  future_opportunity: {
    opportunity_label: string;
    next_lap_energy_headroom_mj: number;
    expected_window_strength: string;
    provenance: string;
  };
  kinematic_consequence: {
    projected_position: number;
    gap_consequence_s: number;
    lap_time_consequence_s: number;
    provenance: string;
  };
  scenario_robustness?: Record<string, any>;
  ranking_result?: {
    rank?: number | null;
    selected: boolean;
    excluded: boolean;
    elimination_tier?: string | null;
    elimination_reason?: string | null;
  };
}

export interface StrategyMatrixSnapshotData {
  matrix_id: string;
  battle_id: string;
  evaluation_timestamp: string;
  fair_baseline: Record<string, any>;
  actions: Record<'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE', StrategyMatrixActionData>;
  ranking?: {
    available: boolean;
    winner?: string | null;
    ranked_actions?: string[];
    excluded_actions?: string[];
    robustness?: string | null;
    scenario_winners?: Record<string, string>;
    ranking_trace?: Record<string, any>;
  };
  recommendation?: {
    canonical_action?: string | null;
    ui_call?: string | null;
    publication_status?: string | null;
    why_selected?: string[];
    why_not?: Record<string, string>;
    primary_reason?: string | null;
    robustness?: string | null;
    scenario_winners?: Record<string, string>;
  };
  provenance: Record<string, string>;
  rule_bundle_version?: string;
}

export interface PublishedCallSnapshotData {
  call_id: string;
  decision_snapshot_id: string;
  battle_id: string;
  event_id: string;
  lap: number;
  ui_call: 'SAVE ENERGY' | 'PREPARE' | 'APPLY PRESSURE' | 'OVERTAKE NOW';
  backend_action: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';
  lifecycle_state: 'VALID' | 'AGING' | 'EXPIRED' | 'BLOCKED' | 'WITHHELD' | 'INVALIDATED' | 'PENDING_FINAL_GATE';
  published_at: string;
  valid_until: string;
  staleness_threshold_s: number;
  gate_checks: Record<string, boolean>;
  robustness: 'ROBUST_WITHIN_TESTED_ASSUMPTIONS' | 'ENERGY_SENSITIVE' | 'INSUFFICIENT_INFORMATION';
  scenario_winners: Record<string, string>;
  why_selected: string[];
  why_not: Record<string, string>;
  primary_reason: string;
  reason_codes: string[];
}

export interface KyntraRuntimeSnapshot {
  runtime_id: string;
  mode: RuntimeMode;
  event_id: string;
  session_key?: string | null;
  current_lap: number;
  source_timestamps: Record<string, string | null>;
  provider_status: Record<string, any>;
  freshness: Record<string, any>;
  active_battles: ActiveBattleTracker[];
  selected_battle_id?: string | null;
  current_matrix?: StrategyMatrixSnapshotData | null;
  current_ranking?: Record<string, any> | null;
  candidate_call?: Record<string, any> | null;
  published_call?: PublishedCallSnapshotData | null;
  call_lifecycle: 'VALID' | 'AGING' | 'EXPIRED' | 'BLOCKED' | 'WITHHELD' | 'INVALIDATED' | 'PENDING_FINAL_GATE';
  race_control: Record<string, any>;
  energy_availability: Record<string, any>;
  model_identities: Record<string, any>;
  decision_snapshot_id?: string | null;
  health: RuntimeHealthSnapshot;
  latencies: LatencyMetrics;
}

export type ProvenanceType =
  | 'LIVE'
  | 'PUBLIC SOURCE'
  | 'DERIVED'
  | 'FROZEN MODEL'
  | 'SIMULATED ENERGY'
  | 'RULE CHECK'
  | 'FORECAST SIMULATION'
  | 'ORDINAL STABILITY'
  | 'HISTORICAL'
  | 'UNKNOWN'
  | 'CONFIG_ASSUMPTION';

export interface EvidenceInspectionTarget {
  title: string;
  value: string;
  status: 'VALID' | 'CAUTION' | 'BLOCKED' | 'UNKNOWN' | 'SIMULATED' | 'INFO';
  provenance: ProvenanceType;
  method?: string;
  version?: string;
  timestamp?: string;
  evidenceItems?: { label: string; value: string; note?: string }[];
  configIdentities?: Record<string, string>;
  reasonCodes?: string[];
  rawObject?: Record<string, any>;
}

