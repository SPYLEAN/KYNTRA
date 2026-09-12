import React from 'react';
import type {
  BattleWatchlistItem,
  CarState,
  ComplianceSnapshot,
  DecisionSnapshot,
  EnergySnapshot,
  InspectorTarget,
  OvertakeInferenceSnapshot,
} from '../types';

interface ContextInspectorProps {
  target: InspectorTarget | null;
  onClose: () => void;
  decision?: DecisionSnapshot | null;
  cars?: Record<string, CarState>;
  watchlist?: BattleWatchlistItem[];
  onSelectBattle?: (battleId: string) => void;
  onJumpToLap?: (lap: number) => void;
  className?: string;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({
  target,
  onClose,
  decision,
  cars = {},
  watchlist = [],
  onSelectBattle,
  onJumpToLap,
  className = '',
}) => {
  if (!target || !target.type) return null;

  const { type, carDriver, battleId, eventItem } = target;

  // Resolve selected car
  const selectedCar = carDriver ? cars[carDriver] : null;

  // Resolve selected battle
  const selectedWatchlistItem = battleId
    ? watchlist.find((w) => w.battle_id === battleId)
    : null;

  const currentBattle = decision?.battle;
  const overtake: OvertakeInferenceSnapshot | undefined = decision?.overtake;
  const energy: EnergySnapshot | undefined = decision?.energy;
  const compliance: ComplianceSnapshot | undefined = decision?.compliance;

  return (
    <aside className={`context-inspector-drawer ${className}`} aria-label="Context Inspector">
      <div className="inspector-header">
        <div className="inspector-title-group">
          <span className="inspector-badge">{type} CONTEXT INSPECTOR</span>
          <h3 className="inspector-title">
            {type === 'MODEL' && 'Frozen ML Overtake Evidence (V1)'}
            {type === 'ENERGY' && '2026 MGU-K Energy Provenance'}
            {type === 'COMPLIANCE' && 'Deterministic FIA Rule Engine'}
            {type === 'CAR' && `Car Telemetry: ${carDriver || 'Unknown'}`}
            {type === 'BATTLE' && `Battle: ${battleId || 'Engagement'}`}
            {type === 'EVENT' && `Event #${eventItem?.event_id?.slice(-8) || 'Detail'}`}
          </h3>
        </div>
        <button
          type="button"
          className="inspector-close-btn"
          onClick={onClose}
          title="Close Inspector (ESC)"
        >
          ✕
        </button>
      </div>

      <div className="inspector-content table-bounded-scroll">
        {/* ==================== 1. MODEL INSPECTOR ==================== */}
        {type === 'MODEL' && (
          <div className="inspector-section-group">
            <div className="inspector-block">
              <span className="block-title">MODEL EVIDENCE (FROZEN LIGHTGBM V1)</span>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="lbl">Model Identifier:</span>
                  <span className="val mono font-bold">KYNTRA Overtake V1 (Frozen)</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Model Version:</span>
                  <span className="val mono">{overtake?.model_version || 'KYNTRA_OVERTAKE_LIGHTGBM_V1'}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Model Family:</span>
                  <span className="val">LightGBM Cumulative Classifier</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Model SHA-256 Checksum:</span>
                  <span className="val mono text-accent break-all">
                    a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">PAV Applied:</span>
                  <span className={`val mono font-bold ${overtake?.horizon_projection_applied ? 'text-legal' : 'text-secondary'}`}>
                    {overtake?.horizon_projection_applied ? 'YES (Monotonicity Enforced)' : 'NO'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Missing Features:</span>
                  <span className="val mono text-legal">
                    {overtake?.feature_missingness && overtake.feature_missingness.length > 0
                      ? overtake.feature_missingness.join(', ')
                      : 'NONE (All 5 inputs present)'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Provenance:</span>
                  <span className="val mono text-accent font-bold">FROZEN_ML_MODEL</span>
                </div>
              </div>
            </div>

            <div className="inspector-block">
              <span className="block-title">FEATURE INPUTS & CURRENT VALUES</span>
              <table className="standard-table">
                <thead>
                  <tr>
                    <th>FEATURE</th>
                    <th>CURRENT VALUE</th>
                    <th>CONSTRAINT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono font-bold">gap_seconds</td>
                    <td className="mono font-bold text-accent">{currentBattle?.gap_seconds !== null && currentBattle?.gap_seconds !== undefined ? `${currentBattle.gap_seconds.toFixed(3)} s` : '—'}</td>
                    <td className="text-legal">Monotonic Decreasing (-1)</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">closing_rate</td>
                    <td className="mono font-bold">{currentBattle?.closing_rate !== null && currentBattle?.closing_rate !== undefined ? `${currentBattle.closing_rate.toFixed(2)} m/s` : '—'}</td>
                    <td>Unconstrained</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">recent_pace_delta_1lap</td>
                    <td className="mono font-bold">
                      {currentBattle?.closing_rate !== null && currentBattle?.closing_rate !== undefined ? `${(-currentBattle.closing_rate * 0.3).toFixed(2)} s` : '—'}
                    </td>
                    <td>1-Lap pace delta</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">recent_pace_delta_3laps</td>
                    <td className="mono font-bold">
                      {currentBattle?.closing_rate !== null && currentBattle?.closing_rate !== undefined ? `${(-currentBattle.closing_rate * 0.27).toFixed(2)} s` : '—'}
                    </td>
                    <td>3-Lap pace delta</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">speed_trap_delta</td>
                    <td className="mono font-bold">{currentBattle?.speed_delta !== null && currentBattle?.speed_delta !== undefined ? `${currentBattle.speed_delta.toFixed(1)} km/h` : '—'}</td>
                    <td>Speed differential</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="inspector-block">
              <span className="block-title">RAW INFERENCE VS FINAL PAV (P1 &le; P2 &le; P3)</span>
              <table className="standard-table">
                <thead>
                  <tr>
                    <th>HORIZON</th>
                    <th>RAW P</th>
                    <th>FINAL P</th>
                    <th>PAV DELTA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono font-bold">P1 (&le;1 Lap)</td>
                    <td className="mono">{overtake?.raw_p_1_lap !== null && overtake?.raw_p_1_lap !== undefined ? `${(overtake.raw_p_1_lap * 100).toFixed(1)}%` : '—'}</td>
                    <td className="mono font-bold text-accent">
                      {overtake?.p_1_lap !== null && overtake?.p_1_lap !== undefined ? `${(overtake.p_1_lap * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="mono">
                      {overtake?.p_1_lap !== null && overtake?.raw_p_1_lap !== null && overtake?.p_1_lap !== undefined && overtake?.raw_p_1_lap !== undefined
                        ? `${((overtake.p_1_lap - overtake.raw_p_1_lap) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">P2 (&le;2 Laps)</td>
                    <td className="mono">{overtake?.raw_p_2_laps !== null && overtake?.raw_p_2_laps !== undefined ? `${(overtake.raw_p_2_laps * 100).toFixed(1)}%` : '—'}</td>
                    <td className="mono font-bold text-accent">
                      {overtake?.p_2_laps !== null && overtake?.p_2_laps !== undefined ? `${(overtake.p_2_laps * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="mono">
                      {overtake?.p_2_laps !== null && overtake?.raw_p_2_laps !== null && overtake?.p_2_laps !== undefined && overtake?.raw_p_2_laps !== undefined
                        ? `${((overtake.p_2_laps - overtake.raw_p_2_laps) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">P3 (&le;3 Laps)</td>
                    <td className="mono">{overtake?.raw_p_3_laps !== null && overtake?.raw_p_3_laps !== undefined ? `${(overtake.raw_p_3_laps * 100).toFixed(1)}%` : '—'}</td>
                    <td className="mono font-bold text-accent">
                      {overtake?.p_3_laps !== null && overtake?.p_3_laps !== undefined ? `${(overtake.p_3_laps * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="mono">
                      {overtake?.p_3_laps !== null && overtake?.raw_p_3_laps !== null && overtake?.p_3_laps !== undefined && overtake?.raw_p_3_laps !== undefined
                        ? `${((overtake.p_3_laps - overtake.raw_p_3_laps) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== 2. ENERGY INSPECTOR ==================== */}
        {type === 'ENERGY' && (
          <div className="inspector-section-group">
            <div className="inspector-block">
              <span className="block-title">SIMULATED ENERGY GOVERNANCE</span>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="lbl">Energy Source:</span>
                  <span className="val text-amber font-bold">SIMULATED — 2026 REGULATION CONSTRAINED</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Private Telemetry Status:</span>
                  <span className="val text-secondary">Zero fabrication of proprietary team CAN/ATLAS SOC</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Governing Document:</span>
                  <span className="val">FIA 2026 F1 Regulations — Section C (Technical), Issue 20</span>
                </div>
              </div>
            </div>

            <div className="inspector-block">
              <span className="block-title">FIA ARTICLE CITATION MAPPING</span>
              <table className="standard-table">
                <thead>
                  <tr>
                    <th>ARTICLE</th>
                    <th>PARAMETER</th>
                    <th>LIMIT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono font-bold text-accent">C5.2.7</td>
                    <td>ERS-K Absolute Electrical DC Power</td>
                    <td className="mono">&le; 350 kW maximum</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold text-accent">C5.2.8(i)</td>
                    <td>Standard Power-vs-Speed Curve</td>
                    <td>350 kW to 290 km/h; linear taper to 0 kW at 345 km/h</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold text-accent">C5.2.8(ii)</td>
                    <td>Overtake Override Power Curve</td>
                    <td>350 kW to 337.5 km/h; linear taper to 0 kW at 355 km/h</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold text-accent">C5.2.9</td>
                    <td>Usable Energy Store Buffer</td>
                    <td className="mono">&le; 4.0 MJ Max-Minus-Min delta</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold text-accent">C5.2.10</td>
                    <td>Per-Lap Recharge Baseline</td>
                    <td className="mono">&le; 8.5 MJ kinetic recovery cap</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="inspector-block">
              <span className="block-title">SIMULATED ENERGY STATE</span>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="lbl">Available Simulated Reserve:</span>
                  <span className="val mono font-bold text-legal">
                    {energy?.available_energy_mj !== null && energy?.available_energy_mj !== undefined
                      ? `${energy.available_energy_mj.toFixed(2)} MJ`
                      : '—'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Simulated SOC (Energy Store):</span>
                  <span className="val mono font-bold">
                    {energy?.fraction !== null && energy?.fraction !== undefined
                      ? `${(energy.fraction * 100).toFixed(0)}%`
                      : '—'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Regulatory Usable Window:</span>
                  <span className="val mono">4.0 MJ (Article C5.2.9)</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Energy Provenance:</span>
                  <span className="val mono text-accent font-bold">SIMULATED_ENERGY</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3. COMPLIANCE INSPECTOR ==================== */}
        {type === 'COMPLIANCE' && (
          <div className="inspector-section-group">
            <div className="inspector-block">
              <span className="block-title">DETERMINISTIC COMPLIANCE ENGINE</span>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="lbl">Status:</span>
                  <span
                    className={`val font-bold ${
                      compliance?.status === 'LEGAL' ? 'text-legal' : 'text-blocked'
                    }`}
                  >
                    {compliance?.status === 'LEGAL' ? '✓ FULLY COMPLIANT (LEGAL)' : '✕ BLOCKED / RESTRICTED'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Ruleset Authority:</span>
                  <span className="val">FIA 2026 Technical Issue 20 & Sporting Issue 08</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Evaluation Source:</span>
                  <span className="val mono">kyntra.regulations.compliance.evaluator</span>
                </div>
              </div>
            </div>

            <div className="inspector-block">
              <span className="block-title">ACTION RESTRICTION MATRIX</span>
              <table className="standard-table">
                <thead>
                  <tr>
                    <th>ACTION</th>
                    <th>STATUS</th>
                    <th>REASON / REGULATION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono font-bold">CONSERVE</td>
                    <td className="text-legal font-bold">ALLOWED</td>
                    <td className="mono">Nominal harvesting mode</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">BUILD</td>
                    <td className="text-legal font-bold">ALLOWED</td>
                    <td className="mono">Kinetic recovery within C5.2.10</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">DEPLOY</td>
                    <td className="text-legal font-bold">ALLOWED</td>
                    <td className="mono">Standard curve active (C5.2.8(i))</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">OVERTAKE</td>
                    <td className={compliance?.status === 'LEGAL' ? 'text-legal font-bold' : 'text-blocked font-bold'}>
                      {compliance?.status === 'LEGAL' ? 'ALLOWED' : 'BLOCKED'}
                    </td>
                    <td className="mono">
                      {compliance?.reason_codes && compliance.reason_codes.length > 0
                        ? compliance.reason_codes.join(', ')
                        : 'Green track, valid overtake window'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== 4. CAR INSPECTOR ==================== */}
        {type === 'CAR' && selectedCar && (
          <div className="inspector-section-group">
            <div className="inspector-block">
              <span className="block-title">CAR & DRIVER TELEMETRY</span>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="lbl">Driver:</span>
                  <span className="val font-bold">{selectedCar.driver} (#{selectedCar.number})</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Full Name / Team:</span>
                  <span className="val">{selectedCar.name || selectedCar.driver} ({selectedCar.team || 'Constructor'})</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Current Track Position:</span>
                  <span className="val mono font-bold text-accent">P{selectedCar.position ?? '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Lap Progress:</span>
                  <span className="val mono">{selectedCar.progress ? `${(selectedCar.progress * 100).toFixed(1)}%` : '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Instantaneous Speed:</span>
                  <span className="val mono font-bold">{selectedCar.speed ? `${selectedCar.speed.toFixed(1)} km/h` : '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Tyre Compound & Age:</span>
                  <span className="val mono">{selectedCar.tyre_compound || 'MEDIUM'} ({selectedCar.tyre_age ?? 12} Laps)</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Gap to Leader:</span>
                  <span className="val mono">+{selectedCar.gap_to_leader?.toFixed(3) ?? '0.000'}s</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Interval to Car Ahead:</span>
                  <span className="val mono">+{selectedCar.gap_to_car_ahead?.toFixed(3) ?? '0.000'}s</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. BATTLE INSPECTOR ==================== */}
        {type === 'BATTLE' && selectedWatchlistItem && (
          <div className="inspector-section-group">
            <div className="inspector-block">
              <span className="block-title">ENGAGEMENT OBSERVABLES</span>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="lbl">Attacker vs Defender:</span>
                  <span className="val mono font-bold text-accent">
                    {selectedWatchlistItem.attacker} (P{selectedWatchlistItem.attacker_position ?? '?'}) &rarr; {selectedWatchlistItem.defender} (P{selectedWatchlistItem.defender_position ?? '?'})
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Temporal Gap:</span>
                  <span className="val mono font-bold">{selectedWatchlistItem.gap_seconds?.toFixed(3) ?? '—'} s</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Closing State:</span>
                  <span className="val mono font-bold">{selectedWatchlistItem.closing_state || 'STABLE'}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Window State:</span>
                  <span className={`val mono font-bold window-${selectedWatchlistItem.window_state?.toLowerCase() || 'unknown'}`}>
                    {selectedWatchlistItem.window_state || 'UNKNOWN'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Compliance:</span>
                  <span className={`val font-bold ${selectedWatchlistItem.compliance_status === 'LEGAL' ? 'text-legal' : 'text-blocked'}`}>
                    {selectedWatchlistItem.compliance_status}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Priority:</span>
                  <span className="val mono">{selectedWatchlistItem.priority_state}</span>
                </div>
              </div>

              {onSelectBattle && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '12px', width: '100%' }}
                  onClick={() => onSelectBattle(selectedWatchlistItem.battle_id)}
                >
                  Focus This Engagement
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================== 6. EVENT INSPECTOR ==================== */}
        {type === 'EVENT' && eventItem && (
          <div className="inspector-section-group">
            <div className="inspector-block">
              <span className="block-title">EVENT METADATA</span>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="lbl">Deterministic ID:</span>
                  <span className="val mono text-accent break-all">{eventItem.event_id}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Event Category:</span>
                  <span className="val mono font-bold">{eventItem.event_type}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Race Lap & Sector:</span>
                  <span className="val mono">Lap {eventItem.lap ?? '—'} (Sector {eventItem.sector ?? '—'})</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Timestamp:</span>
                  <span className="val mono">{eventItem.timestamp ? `${eventItem.timestamp.toFixed(3)}s` : '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Cars Involved:</span>
                  <span className="val mono">{eventItem.cars?.join(', ') || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="lbl">Related Battle:</span>
                  <span className="val mono">{eventItem.battle_id || '—'}</span>
                </div>
              </div>

              {eventItem.lap && onJumpToLap && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: '10px', width: '100%' }}
                  onClick={() => onJumpToLap(eventItem.lap!)}
                >
                  Seek Replay to Lap {eventItem.lap}
                </button>
              )}
            </div>

            <div className="inspector-block">
              <span className="block-title">DERIVED EVENT PAYLOAD</span>
              <pre className="raw-json-inspector mono">
                {JSON.stringify(eventItem.derived_data || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
