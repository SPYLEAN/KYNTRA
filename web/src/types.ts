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
export type ContextWorkspace = 'RACE' | 'BATTLE' | 'STRATEGY' | 'EVENTS' | 'SYSTEM';

export type WorkspaceId = 'LIVE' | 'REPLAY' | 'FORECAST' | 'RACE' | 'BATTLE' | 'STRATEGY' | 'COUNTERFACTUALS' | 'EVENTS' | 'SYSTEM';

export type SystemTabId = 'OVERVIEW' | 'DATA' | 'MODEL' | 'ENERGY' | 'FIA' | 'PROVIDERS' | 'LIMITATIONS';

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

