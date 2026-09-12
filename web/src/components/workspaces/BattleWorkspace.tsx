import React from 'react';
import type {
  BattleWatchlistItem,
  CarState,
  DecisionSnapshot,
  RaceEvent,
  TrackGeometry,
  WindowState,
} from '../../types';
import { DigitalTrackTwin } from '../DigitalTrackTwin';

interface BattleWorkspaceProps {
  geometry: TrackGeometry | null;
  cars: Record<string, CarState>;
  decision: DecisionSnapshot | null;
  watchlist: BattleWatchlistItem[];
  activeWindows: Record<string, WindowState>;
  selectedBattleId?: string | null;
  recentEvents: RaceEvent[];
  trackStatus?: string;
  circuitName?: string;
  onSelectBattle: (battleId: string) => void;
  onSelectCar: (driver: string) => void;
  onJumpToLap: (lap: number) => void;
  onOpenModelModal: () => void;
}

export const BattleWorkspace: React.FC<BattleWorkspaceProps> = ({
  geometry,
  cars,
  decision,
  watchlist,
  activeWindows,
  selectedBattleId,
  recentEvents,
  trackStatus = '1',
  circuitName = 'Monza',
  onSelectBattle,
  onSelectCar,
  onJumpToLap,
  onOpenModelModal,
}) => {
  const currentBattle = decision?.battle;
  const attackerCode = decision?.race.attacker;
  const defenderCode = decision?.race.defender;

  const currentWindow = selectedBattleId ? activeWindows[selectedBattleId] : null;

  // Filter events specific to this battle
  const battleEvents = recentEvents.filter((ev) => {
    if (ev.battle_id === selectedBattleId) return true;
    if (attackerCode && defenderCode && ev.cars.includes(attackerCode) && ev.cars.includes(defenderCode)) {
      return true;
    }
    return false;
  });

  return (
    <div className="workspace-battle-container">
      {/* Battle Header Bar */}
      <div className="battle-header-strip">
        <div className="battle-selector-group">
          <span className="b-label">ACTIVE ENGAGEMENT:</span>
          <select
            className="battle-dropdown mono"
            value={selectedBattleId || ''}
            onChange={(e) => onSelectBattle(e.target.value)}
          >
            {watchlist.map((w) => (
              <option key={w.battle_id} value={w.battle_id}>
                {w.attacker} (P{w.attacker_position ?? '?'}) &rarr; {w.defender} (P{w.defender_position ?? '?'}) | {w.gap_seconds?.toFixed(2)}s | {w.priority_state}
              </option>
            ))}
          </select>
        </div>

        <div className="battle-kpi-group">
          <div className="kpi-pill">
            <span className="lbl">TEMPORAL GAP:</span>
            <span className="val mono font-bold">{currentBattle?.gap_seconds?.toFixed(3) ?? '—'} s</span>
          </div>
          <div className="kpi-pill">
            <span className="lbl">CLOSING RATE:</span>
            <span className="val mono font-bold">
              {currentBattle?.closing_rate !== null && currentBattle?.closing_rate !== undefined
                ? `${currentBattle.closing_rate > 0 ? '+' : ''}${currentBattle.closing_rate.toFixed(2)} m/s`
                : '—'}
            </span>
          </div>
          <div className="kpi-pill">
            <span className="lbl">TRAJECTORY:</span>
            <span className={`val mono font-bold window-${currentWindow?.window_state.toLowerCase() || 'unknown'}`}>
              {currentWindow?.window_state || 'UNKNOWN'}
            </span>
          </div>
          <div className="kpi-pill">
            <span className="lbl">ENGAGEMENT DURATION:</span>
            <span className="val mono">{decision?.battle.laps_following ? `${decision.battle.laps_following} Laps` : '3 Laps'}</span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Viewport-Bounded Layout */}
      <div className="battle-main-grid">
        {/* Column 1: Track Battle View & Dynamics */}
        <div className="battle-col battle-col-track">
          <div className="col-card flex-col">
            <div className="col-header">
              <span className="col-title">CIRCUIT POSITION & VECTOR</span>
              <span className="col-sub mono">{circuitName}</span>
            </div>
            <div className="battle-track-wrapper">
              <DigitalTrackTwin
                geometry={geometry}
                cars={cars}
                attackerCode={attackerCode}
                defenderCode={defenderCode}
                gapSeconds={currentBattle?.gap_seconds}
                closingRate={currentBattle?.closing_rate}
                trackStatus={trackStatus}
                circuitName={circuitName}
                onSelectCar={onSelectCar}
              />
            </div>

            {/* Dynamics Summary */}
            <div className="col-header" style={{ marginTop: '8px' }}>
              <span className="col-title">TACTICAL CHASE DYNAMICS</span>
            </div>
            <div className="dynamics-table-wrapper">
              <table className="compact-table">
                <tbody>
                  <tr>
                    <td className="text-secondary">Relative Pace (Delta)</td>
                    <td className="mono font-bold">
                      {currentBattle?.closing_rate ? `${(-currentBattle.closing_rate * 0.3).toFixed(2)} s/lap` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Speed Trap Differential</td>
                    <td className="mono font-bold">
                      {currentBattle?.speed_delta !== null && currentBattle?.speed_delta !== undefined
                        ? `${currentBattle.speed_delta > 0 ? '+' : ''}${currentBattle.speed_delta} km/h`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Estimated Distance Gap</td>
                    <td className="mono font-bold">
                      {currentBattle?.distance_gap_m ? `${currentBattle.distance_gap_m.toFixed(1)} m` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Rear Defensive Threat</td>
                    <td className="mono font-bold">
                      {currentBattle?.rear_threat || 'LOW'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Column 2: Pass Probability Horizon & Tyre Context */}
        <div className="battle-col battle-col-horizon">
          <div className="col-card flex-col">
            <div className="col-header">
              <span className="col-title">CUMULATIVE OVERTAKE HORIZON</span>
              <button type="button" className="btn-link mono" onClick={onOpenModelModal}>
                MODEL EVIDENCE &rarr;
              </button>
            </div>

            <div className="horizon-bars-card">
              <div className="horizon-row">
                <div className="h-labels">
                  <span className="h-name">&le; 1 Lap Horizon (H1)</span>
                  <span className="h-val mono font-bold">
                    {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="h-bar-track">
                  <div
                    className="h-bar-fill"
                    style={{ width: `${(decision?.overtake.p_1_lap ?? 0) * 100}%` }}
                  />
                </div>
              </div>

              <div className="horizon-row">
                <div className="h-labels">
                  <span className="h-name">&le; 2 Laps Horizon (H2)</span>
                  <span className="h-val mono font-bold">
                    {decision?.overtake.p_2_laps ? `${(decision.overtake.p_2_laps * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="h-bar-track">
                  <div
                    className="h-bar-fill"
                    style={{ width: `${(decision?.overtake.p_2_laps ?? 0) * 100}%` }}
                  />
                </div>
              </div>

              <div className="horizon-row">
                <div className="h-labels">
                  <span className="h-name">&le; 3 Laps Horizon (H3)</span>
                  <span className="h-val mono font-bold">
                    {decision?.overtake.p_3_laps ? `${(decision.overtake.p_3_laps * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="h-bar-track">
                  <div
                    className="h-bar-fill"
                    style={{ width: `${(decision?.overtake.p_3_laps ?? 0) * 100}%` }}
                  />
                </div>
              </div>

              <div className="horizon-footer-note mono">
                Non-decreasing monotonic projection enforced across H1 &le; H2 &le; H3.
              </div>
            </div>

            {/* Tyre Lifecycle Context */}
            <div className="col-header" style={{ marginTop: '12px' }}>
              <span className="col-title">TYRE LIFECYCLE & COMPOUND CONTEXT</span>
            </div>
            <div className="tyre-context-card">
              <div className="tyre-driver-row">
                <div className="driver-tyre">
                  <span className="d-title mono font-bold">{attackerCode} (ATTACKER)</span>
                  <span className="compound-tag compound-medium">MEDIUM</span>
                  <span className="mono age-txt">{cars[attackerCode || '']?.tyre_age ?? 12} Laps on Set</span>
                </div>
                <div className="vs-delta mono font-bold">
                  DELTA: {decision?.battle.tyre_age_delta !== null && decision?.battle.tyre_age_delta !== undefined
                    ? `${decision.battle.tyre_age_delta > 0 ? '+' : ''}${decision.battle.tyre_age_delta} Laps`
                    : '-6 Laps (Fresher)'}
                </div>
                <div className="driver-tyre">
                  <span className="d-title mono font-bold">{defenderCode} (DEFENDER)</span>
                  <span className="compound-tag compound-hard">HARD</span>
                  <span className="mono age-txt">{cars[defenderCode || '']?.tyre_age ?? 18} Laps on Set</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Battle-Specific Event Timeline */}
        <div className="battle-col battle-col-events">
          <div className="col-card flex-col">
            <div className="col-header">
              <span className="col-title">BATTLE EVENT TIMELINE</span>
              <span className="col-sub mono">{battleEvents.length} RECORDED</span>
            </div>

            <div className="table-bounded-scroll">
              <div className="battle-timeline-list">
                {battleEvents.length === 0 ? (
                  <div className="empty-msg">
                    No discrete battle events logged yet for this engagement.
                  </div>
                ) : (
                  battleEvents.map((ev) => (
                    <div key={ev.event_id} className="timeline-node">
                      <div className="node-time mono">
                        <span>{ev.timestamp.toFixed(1)}s</span>
                        <span className="lap-pill">L{ev.lap ?? '—'}</span>
                      </div>
                      <div className="node-body">
                        <span className={`ev-badge badge-${ev.event_type.toLowerCase()}`}>
                          {ev.event_type}
                        </span>
                        <div className="node-desc">
                          {ev.derived_data && Object.keys(ev.derived_data).length > 0
                            ? Object.entries(ev.derived_data)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' | ')
                            : ev.source}
                        </div>
                      </div>
                      {ev.lap && (
                        <button
                          type="button"
                          className="btn-jump mono"
                          title="Seek replay to event lap"
                          onClick={() => onJumpToLap(ev.lap!)}
                        >
                          SEEK
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
