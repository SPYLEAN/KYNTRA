import React, { useMemo, useState } from 'react';
import type {
  BattleWatchlistItem,
  CarState,
  DecisionSnapshot,
  InspectorTarget,
  InspectorType,
  RaceEvent,
  TrackGeometry,
  WindowState,
} from '../../types';
import { DigitalTrackTwin } from '../DigitalTrackTwin';
import { PositionTower } from '../PositionTower';
import { ContextInspector } from '../ContextInspector';
import { TelemetryStrip } from '../TelemetryStrip';
import { RaceControlFeed } from '../RaceControlFeed';

interface LiveWorkspaceProps {
  geometry: TrackGeometry | null;
  cars: Record<string, CarState>;
  decision: DecisionSnapshot | null;
  watchlist: BattleWatchlistItem[];
  activeWindows: Record<string, WindowState>;
  selectedBattleId?: string | null;
  recentEvents: RaceEvent[];
  trackStatus?: string;
  circuitName?: string;
  inspectorTarget: InspectorTarget | null;
  onSelectBattle: (battleId: string) => void;
  onSelectCar: (driver: string) => void;
  onJumpToLap: (lap: number) => void;
  onOpenInspector: (type: InspectorType, payload?: any) => void;
  onCloseInspector: () => void;
  onOpenBattleWorkspace: (battleId: string) => void;
}

export const LiveWorkspace: React.FC<LiveWorkspaceProps> = ({
  geometry,
  cars,
  decision,
  watchlist,
  activeWindows,
  selectedBattleId,
  recentEvents,
  trackStatus = '1',
  circuitName = 'Monza',
  inspectorTarget,
  onSelectBattle,
  onSelectCar,
  onJumpToLap,
  onOpenInspector,
  onCloseInspector,
  onOpenBattleWorkspace,
}) => {
  const currentBattle = decision?.battle;
  const attackerCode = decision?.race.attacker;
  const defenderCode = decision?.race.defender;

  // Watchlist sorting
  const [watchlistSort, setWatchlistSort] = useState<'PRIORITY' | 'GAP' | 'WINDOW'>('PRIORITY');

  const sortedWatchlist = useMemo(() => {
    const list = [...watchlist];
    if (watchlistSort === 'GAP') {
      return list.sort((a, b) => (a.gap_seconds ?? 99) - (b.gap_seconds ?? 99));
    }
    if (watchlistSort === 'WINDOW') {
      return list.sort((a, b) => (a.window_state || '').localeCompare(b.window_state || ''));
    }
    const order: Record<string, number> = { CRITICAL: 0, ACTIVE: 1, FORMING: 2, WATCH: 3, UNKNOWN: 4 };
    return list.sort((a, b) => (order[a.priority_state] ?? 5) - (order[b.priority_state] ?? 5));
  }, [watchlist, watchlistSort]);

  // Find window state for active battle
  const currentWindow = selectedBattleId ? activeWindows[selectedBattleId] : null;

  return (
    <div className="workspace-live-container">
      {/* 3-Column Structural Pane Grid */}
      <div className="live-workstation-columns">
        {/* ==================== COLUMN 1: LEFT (~18%) ==================== */}
        <div className="live-col live-col-left structural-pane">
          {/* Top: Compact Position Tower */}
          <div className="live-cell live-cell-tower">
            <PositionTower
              cars={cars}
              attackerCode={attackerCode}
              defenderCode={defenderCode}
              onSelectCar={(drv) => {
                if (onSelectCar) onSelectCar(drv);
                onOpenInspector('CAR', { driver: drv });
              }}
              onSelectBattle={onSelectBattle}
              selectedBattleId={selectedBattleId}
            />
          </div>

          {/* Bottom: Battle Watchlist */}
          <div className="live-cell live-cell-watchlist">
            <div className="panel-inner-card">
              <div className="panel-header-row">
                <span className="panel-title font-bold">BATTLE WATCHLIST</span>
                <div className="watchlist-sort-pills">
                  <button
                    type="button"
                    className={`sort-pill ${watchlistSort === 'PRIORITY' ? 'active' : ''}`}
                    onClick={() => setWatchlistSort('PRIORITY')}
                  >
                    PRIO
                  </button>
                  <button
                    type="button"
                    className={`sort-pill ${watchlistSort === 'GAP' ? 'active' : ''}`}
                    onClick={() => setWatchlistSort('GAP')}
                  >
                    GAP
                  </button>
                  <button
                    type="button"
                    className={`sort-pill ${watchlistSort === 'WINDOW' ? 'active' : ''}`}
                    onClick={() => setWatchlistSort('WINDOW')}
                  >
                    WIN
                  </button>
                </div>
              </div>

              <div className="table-bounded-scroll">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>PRIO</th>
                      <th>BATTLE</th>
                      <th>GAP</th>
                      <th>CLOSING</th>
                      <th>P1</th>
                      <th>RULES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWatchlist.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-cell mono text-muted">
                          No active battles (&le; 2.5s)
                        </td>
                      </tr>
                    ) : (
                      sortedWatchlist.map((item) => {
                        const isSelected = item.battle_id === selectedBattleId;
                        return (
                          <tr
                            key={item.battle_id}
                            className={`interactive-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => onSelectBattle(item.battle_id)}
                            onDoubleClick={() => onOpenBattleWorkspace(item.battle_id)}
                            title="Click to select battle, double-click for battle analysis"
                          >
                            <td>
                              <span className={`priority-pill priority-${item.priority_state.toLowerCase()}`}>
                                {item.priority_state.slice(0, 3)}
                              </span>
                            </td>
                            <td className="mono font-bold">
                              {item.attacker} &rarr; {item.defender}
                            </td>
                            <td className="mono">
                              {item.gap_seconds !== null && item.gap_seconds !== undefined
                                ? `${item.gap_seconds.toFixed(2)}s`
                                : '—'}
                            </td>
                            <td>
                              <span className={`trend-text trend-${item.closing_state?.toLowerCase() || 'unknown'}`}>
                                {item.closing_state || 'STABLE'}
                              </span>
                            </td>
                            <td className="mono font-bold text-accent">
                              {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(0)}%` : '—'}
                            </td>
                            <td>
                              <span className={item.compliance_status === 'LEGAL' ? 'text-legal' : 'text-blocked'}>
                                {item.compliance_status === 'LEGAL' ? 'LEGAL' : 'BLK'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== COLUMN 2: CENTER (~52%) — HERO ==================== */}
        <div className="live-col live-col-center hero-track-column structural-pane">
          {/* Top Hero: Digital Track Twin */}
          <div className="live-cell live-cell-track hero-track-cell">
            <DigitalTrackTwin
              geometry={geometry}
              cars={cars}
              attackerCode={attackerCode}
              defenderCode={defenderCode}
              gapSeconds={currentBattle?.gap_seconds}
              closingRate={currentBattle?.closing_rate}
              trackStatus={trackStatus}
              circuitName={circuitName}
              onSelectCar={(drv) => {
                if (onSelectCar) onSelectCar(drv);
                onOpenInspector('CAR', { driver: drv });
              }}
              spatialGapMeters={currentBattle?.distance_gap_m}
            />
          </div>

          {/* Bottom Center: Synchronized Telemetry & Pass Window Strip */}
          <div className="live-cell live-cell-telemetry-strip">
            <TelemetryStrip
              decision={decision}
              currentWindow={currentWindow}
              onOpenModelInspector={() => onOpenInspector('MODEL')}
            />
          </div>
        </div>

        {/* ==================== COLUMN 3: RIGHT (~30%) — INTELLIGENCE RAIL ==================== */}
        <div className="live-col live-col-right intelligence-rail structural-pane">
          {inspectorTarget && inspectorTarget.type ? (
            /* In-Place Context Inspector Transformation (Center Track Twin width never shifts!) */
            <div className="in-rail-inspector-container">
              <div className="in-rail-inspector-topbar">
                <button
                  type="button"
                  className="btn-back-to-intel font-bold mono"
                  onClick={onCloseInspector}
                  title="Return to KYNTRA Intelligence Rail (ESC)"
                >
                  &larr; BACK TO INTELLIGENCE
                </button>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={onCloseInspector}
                  title="Close Inspector (ESC)"
                >
                  ✕
                </button>
              </div>
              <ContextInspector
                target={inspectorTarget}
                onClose={onCloseInspector}
                decision={decision}
                cars={cars}
                watchlist={watchlist}
                onSelectBattle={onSelectBattle}
                onJumpToLap={onJumpToLap}
                className="in-rail-drawer"
              />
            </div>
          ) : (
            /* Default KYNTRA Intelligence Rail + Continuous Framework + Race Control Feed */
            <div className="intelligence-rail-normal table-bounded-scroll">
              {/* 1. KYNTRA Call Card */}
              <div className="kyntra-call-card">
                <div className="call-header">
                  <div className="call-badge-group">
                    <img
                      src="/brand/kyntra-symbol-ui.png"
                      alt="KYNTRA"
                      className="call-brand-symbol"
                    />
                    <span className="call-badge font-bold">KYNTRA CALL</span>
                  </div>
                  <span className="call-status-indicator mono">PENDING STRATEGY ENGINE</span>
                </div>
                <div className="call-action-text font-bold">
                  AWAITING STRATEGY ENGINE
                </div>
                <div className="call-rationale">
                  Tactical recommendation policies remain unactivated pending verified multi-horizon game-theoretic optimization.
                </div>

                {/* Readiness Status Sub-Matrix */}
                <div className="call-readiness-pills mono">
                  <span className="pill-ready" title="LightGBM Cumulative Horizon Classifier V1">PASS: READY</span>
                  <span className="pill-sim" title="FIA Article C5.2.9 (4.0MJ Buffer)">PU: 4.0MJ SIM</span>
                  <span className="pill-pending" title="Post-pass retention unmodeled">STAB: PENDING</span>
                  <span className="pill-ready" title="Deterministic FIA Issue 20">RULES: READY</span>
                  <span className="pill-pending" title="Strategy engine unactivated">STRAT: PENDING</span>
                </div>
              </div>

              {/* 2. Active Engagement Card */}
              <div className="active-battle-summary-card">
                <div className="summary-header">
                  <span className="summary-title font-bold">ACTIVE ENGAGEMENT</span>
                  {selectedBattleId && (
                    <button
                      type="button"
                      className="btn-link mono"
                      onClick={() => onOpenBattleWorkspace(selectedBattleId)}
                    >
                      BATTLE WORKSPACE &rarr;
                    </button>
                  )}
                </div>

                <div className="battle-pair-display">
                  <div className="driver-box attacker-box" onClick={() => attackerCode && onOpenInspector('CAR', { driver: attackerCode })}>
                    <span className="role-lbl">ATTACKER</span>
                    <span className="driver-code mono font-bold">{attackerCode || '—'}</span>
                    <span className="driver-pos mono">P{decision?.race.attacker_position ?? '—'}</span>
                  </div>
                  <div className="versus-box">
                    <span className="versus-arrow">&rarr;</span>
                    <span className="versus-gap mono font-bold text-accent">
                      {currentBattle?.gap_seconds !== null && currentBattle?.gap_seconds !== undefined
                        ? `${currentBattle.gap_seconds.toFixed(2)}s`
                        : '—'}
                    </span>
                    <span className="versus-closing mono">
                      {currentBattle?.closing_rate !== null && currentBattle?.closing_rate !== undefined
                        ? `${currentBattle.closing_rate > 0 ? '+' : ''}${currentBattle.closing_rate.toFixed(1)} m/s`
                        : ''}
                    </span>
                  </div>
                  <div className="driver-box defender-box" onClick={() => defenderCode && onOpenInspector('CAR', { driver: defenderCode })}>
                    <span className="role-lbl">DEFENDER</span>
                    <span className="driver-code mono font-bold">{defenderCode || '—'}</span>
                    <span className="driver-pos mono">P{decision?.race.defender_position ?? '—'}</span>
                  </div>
                </div>

                {/* Compact Tactical Deltas */}
                <div className="battle-tactical-deltas mono">
                  <div className="delta-item">
                    <span className="d-lbl">Spatial:</span>
                    <span className="d-val">{currentBattle?.distance_gap_m ? `${currentBattle.distance_gap_m.toFixed(1)}m` : '—'}</span>
                  </div>
                  <div className="delta-item">
                    <span className="d-lbl">Speed:</span>
                    <span className="d-val">{currentBattle?.speed_delta ? `${currentBattle.speed_delta > 0 ? '+' : ''}${currentBattle.speed_delta.toFixed(1)} km/h` : '—'}</span>
                  </div>
                  <div className="delta-item">
                    <span className="d-lbl">Attacker Tyre:</span>
                    <span className="d-val">{cars[attackerCode || '']?.tyre_compound || 'MED'} ({cars[attackerCode || '']?.tyre_age ?? 12}L)</span>
                  </div>
                  <div className="delta-item">
                    <span className="d-lbl">Threat:</span>
                    <span className="d-val font-bold">{currentBattle?.rear_threat || 'LOW'}</span>
                  </div>
                </div>
              </div>

              {/* 3. Decision Basis: Continuous 4-Row Operational Surface */}
              <div className="decision-basis-surface">
                <div className="basis-header">
                  <span className="basis-title font-bold">DECISION BASIS</span>
                  <span className="basis-sub mono">CONTINUOUS FRAMEWORK</span>
                </div>

                <div className="decision-basis-rows">
                  {/* Row 01: CAN I PASS? */}
                  <div
                    className="basis-row interactive-row"
                    onClick={() => onOpenInspector('MODEL')}
                    title="Click to inspect frozen ML evidence in right rail"
                  >
                    <span className="b-num mono">01</span>
                    <span className="b-label font-bold">CAN I PASS?</span>
                    <span className="b-metric mono font-bold text-accent">
                      {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(0)}% P1` : '—'}
                    </span>
                    <span className={`b-tag mono window-${currentWindow?.window_state.toLowerCase() || 'unknown'}`}>
                      {currentWindow?.window_state || 'UNKNOWN'}
                    </span>
                    <span className="b-arrow">&rarr;</span>
                  </div>

                  {/* Row 02: CAN I AFFORD IT? */}
                  <div
                    className="basis-row interactive-row"
                    onClick={() => onOpenInspector('ENERGY')}
                    title="Click to inspect 2026 MGU-K energy provenance in right rail"
                  >
                    <span className="b-num mono">02</span>
                    <span className="b-label font-bold">CAN I AFFORD IT?</span>
                    <span className="b-metric mono font-bold">
                      {decision?.energy.available_energy_mj ? `${decision.energy.available_energy_mj.toFixed(2)} MJ` : '3.20 MJ'}
                    </span>
                    <span className="b-tag mono tag-sim">SIMULATED</span>
                    <span className="b-arrow">&rarr;</span>
                  </div>

                  {/* Row 03: CAN I KEEP IT? */}
                  <div className="basis-row">
                    <span className="b-num mono">03</span>
                    <span className="b-label font-bold">CAN I KEEP IT?</span>
                    <span className="b-metric mono font-bold text-amber">UNKNOWN</span>
                    <span className="b-tag mono tag-pending">PENDING RULESET</span>
                    <span className="b-arrow" style={{ opacity: 0.3 }}>&rarr;</span>
                  </div>

                  {/* Row 04: AM I ALLOWED? */}
                  <div
                    className="basis-row interactive-row"
                    onClick={() => onOpenInspector('COMPLIANCE')}
                    title="Click to inspect deterministic FIA compliance in right rail"
                  >
                    <span className="b-num mono">04</span>
                    <span className="b-label font-bold">AM I ALLOWED?</span>
                    <span className={`b-metric mono font-bold ${decision?.compliance.status === 'LEGAL' ? 'text-legal' : 'text-blocked'}`}>
                      {decision?.compliance.status === 'LEGAL' ? '✓ LEGAL' : '✕ BLOCKED'}
                    </span>
                    <span className="b-tag mono tag-green">GREEN TRACK</span>
                    <span className="b-arrow">&rarr;</span>
                  </div>
                </div>
              </div>

              {/* 4. Integrated Race Control Feed */}
              <div className="intelligence-race-control-container">
                <RaceControlFeed
                  events={recentEvents}
                  onOpenEventInspector={(ev) => onOpenInspector('EVENT', { event: ev })}
                  onJumpToLap={onJumpToLap}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== BOTTOM STRIP: RACE MEMORY TICKER ==================== */}
      <div className="live-bottom-memory-strip">
        <div className="memory-strip-label mono font-bold">RACE MEMORY:</div>
        <div className="memory-ticker-items">
          {recentEvents.slice(0, 8).map((ev) => (
            <div
              key={ev.event_id}
              className="ticker-item interactive-row"
              onClick={() => onOpenInspector('EVENT', { event: ev })}
              title="Click to inspect this event in Context Inspector"
            >
              <span className="tick-time mono">{ev.timestamp.toFixed(1)}s</span>
              <span className="tick-lap mono">L{ev.lap ?? '—'}</span>
              <span className={`tick-tag type-${ev.event_type.toLowerCase()}`}>{ev.event_type}</span>
              <span className="tick-cars mono">{ev.cars.join(' & ')}</span>
              <span className="tick-desc">
                {ev.derived_data && typeof ev.derived_data === 'object'
                  ? (ev.derived_data as any).description || ''
                  : ''}
              </span>
              {ev.lap && (
                <button
                  type="button"
                  className="tick-jump"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJumpToLap(ev.lap!);
                  }}
                  title={`Seek replay to lap ${ev.lap}`}
                >
                  ⏩
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
