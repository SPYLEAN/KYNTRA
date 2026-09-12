import React, { useMemo } from 'react';
import type {
  BattleWatchlistItem,
  CarState,
  DecisionSnapshot,
  InspectorTarget,
  InspectorType,
  RaceEvent,
  TimelineMarker,
  TrackGeometry,
  WindowState,
} from '../../types';
import { DigitalTrackTwin } from '../DigitalTrackTwin';
import { PositionTower } from '../PositionTower';
import { ContextInspector } from '../ContextInspector';

interface ReplayWorkspaceProps {
  geometry: TrackGeometry | null;
  cars: Record<string, CarState>;
  decision: DecisionSnapshot | null;
  watchlist: BattleWatchlistItem[];
  activeWindows: Record<string, WindowState>;
  selectedBattleId?: string | null;
  recentEvents: RaceEvent[];
  timelineMarkers: TimelineMarker[];
  trackStatus?: string;
  circuitName?: string;
  currentLap: number;
  totalLaps: number;
  inspectorTarget: InspectorTarget | null;
  onSelectBattle: (battleId: string) => void;
  onSelectCar: (driver: string) => void;
  onJumpToLap: (lap: number) => void;
  onOpenInspector: (type: InspectorType, payload?: any) => void;
  onCloseInspector: () => void;
  onOpenBattleWorkspace: (battleId: string) => void;
}

export const ReplayWorkspace: React.FC<ReplayWorkspaceProps> = ({
  geometry,
  cars,
  decision,
  watchlist,
  activeWindows,
  selectedBattleId,
  recentEvents,
  timelineMarkers,
  trackStatus = '1',
  circuitName = 'Monza',
  currentLap,
  totalLaps,
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

  const currentWindow = selectedBattleId ? activeWindows[selectedBattleId] : null;

  // Determine what happened next from historical events in store
  const historicalNextEvent = useMemo(() => {
    if (!attackerCode || !defenderCode) return null;
    const futureEvents = recentEvents.filter((e) => (e.lap ?? 0) >= currentLap);
    const passEvent = futureEvents.find(
      (e) => (e.event_type.includes('PASS') || e.event_type.includes('POSITION')) && e.cars.includes(attackerCode)
    );
    return passEvent || null;
  }, [recentEvents, currentLap, attackerCode, defenderCode]);

  return (
    <div className="workspace-live-container workspace-replay-container">
      {/* 3-Column Replay Workstation */}
      <div className="live-workstation-columns">
        {/* ==================== COLUMN 1: LEFT ==================== */}
        <div className="live-col live-col-left">
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

          <div className="live-cell live-cell-watchlist">
            <div className="panel-inner-card">
              <div className="panel-header-row">
                <span className="panel-title font-bold">REPLAY BATTLE LOG</span>
                <span className="panel-count mono">{watchlist.length} RECORDED</span>
              </div>
              <div className="table-bounded-scroll">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>BATTLE</th>
                      <th>GAP</th>
                      <th>P1</th>
                      <th>WINDOW</th>
                      <th>HISTORICAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((item) => (
                      <tr
                        key={item.battle_id}
                        className={`interactive-row ${item.battle_id === selectedBattleId ? 'selected' : ''}`}
                        onClick={() => onSelectBattle(item.battle_id)}
                        onDoubleClick={() => onOpenBattleWorkspace(item.battle_id)}
                      >
                        <td className="mono font-bold">{item.attacker} &rarr; {item.defender}</td>
                        <td className="mono">{item.gap_seconds ? `${item.gap_seconds.toFixed(2)}s` : '—'}</td>
                        <td className="mono font-bold text-accent">
                          {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="mono">{item.window_state || 'UNKNOWN'}</td>
                        <td><span className="text-legal">VERIFIED</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== COLUMN 2: CENTER (HERO TRACK) ==================== */}
        <div className="live-col live-col-center hero-track-column">
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

          {/* Replay Milestone Timeline Pins */}
          <div className="live-cell replay-milestones-cell">
            <div className="panel-inner-card">
              <div className="panel-header-row">
                <span className="panel-title font-bold">REPLAY MILESTONE EVENTS (CLICK TO SEEK)</span>
                <span className="mono text-muted">LAP {currentLap} / {totalLaps}</span>
              </div>
              <div className="replay-milestones-row table-bounded-scroll">
                {timelineMarkers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`milestone-pill marker-${m.event_type.toLowerCase()} ${m.lap === currentLap ? 'current-lap' : ''}`}
                    onClick={() => m.lap && onJumpToLap(m.lap)}
                    title={`Seek replay to Lap ${m.lap}: ${m.label || m.event_type}`}
                  >
                    <span className="m-lap mono">L{m.lap}</span>
                    <span className="m-type">{m.event_type}</span>
                    <span className="m-cars mono">{m.cars.slice(0, 2).join('/')}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ==================== COLUMN 3: RIGHT (FORENSIC COMPARISON RAIL) ==================== */}
        <div className="live-col live-col-right intelligence-rail">
          {inspectorTarget && inspectorTarget.type ? (
            <div className="in-rail-inspector-container">
              <div className="in-rail-inspector-topbar">
                <button
                  type="button"
                  className="btn-back-to-intel"
                  onClick={onCloseInspector}
                >
                  &larr; BACK TO REPLAY FORENSICS
                </button>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={onCloseInspector}
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
            <div className="intelligence-rail-normal table-bounded-scroll">
              <div className="replay-forensics-card">
                <div className="forensic-header">
                  <span className="badge-forensic mono">FORENSIC ANALYSIS</span>
                  <h4 className="forensic-title font-bold">HISTORICAL INTELLIGENCE AUDIT</h4>
                  <div className="forensic-sub mono">
                    REPLAY TIME: {decision?.race.replay_time?.toFixed(1) || '0.0'}s | LAP {currentLap}
                  </div>
                </div>

                {/* Section A: WHAT KYNTRA SAW */}
                <div className="forensic-box box-saw">
                  <div className="box-title-row">
                    <span className="box-title font-bold">WHAT KYNTRA SAW AT THIS MOMENT</span>
                    <span className="box-tag tag-model mono">FROZEN ML V1</span>
                  </div>
                  <div className="forensic-metrics-grid">
                    <div className="f-metric">
                      <span className="f-lbl">P1 (Pass &le;1 Lap):</span>
                      <span className="f-val mono font-bold text-accent">
                        {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div className="f-metric">
                      <span className="f-lbl">P2 (Pass &le;2 Laps):</span>
                      <span className="f-val mono">
                        {decision?.overtake.p_2_laps ? `${(decision.overtake.p_2_laps * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div className="f-metric">
                      <span className="f-lbl">P3 (Pass &le;3 Laps):</span>
                      <span className="f-val mono">
                        {decision?.overtake.p_3_laps ? `${(decision.overtake.p_3_laps * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div className="f-metric">
                      <span className="f-lbl">Window State:</span>
                      <span className="f-val mono font-bold">{currentWindow?.window_state || 'UNKNOWN'}</span>
                    </div>
                    <div className="f-metric">
                      <span className="f-lbl">Simulated Energy:</span>
                      <span className="f-val mono">
                        {decision?.energy.available_energy_mj != null ? `${decision.energy.available_energy_mj.toFixed(2)} MJ [SIM]` : '—'}
                      </span>
                    </div>
                    <div className="f-metric">
                      <span className="f-lbl">FIA Rule Status:</span>
                      <span className="f-val mono text-legal font-bold">
                        {decision?.compliance.status || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section B: WHAT HAPPENED NEXT */}
                <div className="forensic-box box-happened">
                  <div className="box-title-row">
                    <span className="box-title font-bold">WHAT HAPPENED NEXT (GROUND TRUTH)</span>
                    <span className="box-tag tag-truth mono">TELEMETRY RECORD</span>
                  </div>
                  <div className="forensic-truth-content">
                    <div className="truth-row">
                      <span className="t-lbl">Historical Pass Outcome:</span>
                      <span className="t-val font-bold text-accent">
                        {historicalNextEvent
                          ? `OVERTAKE RESOLVED ON LAP ${historicalNextEvent.lap}`
                          : 'ENGAGEMENT CONTINUED / DEFENDED'}
                      </span>
                    </div>
                    <div className="truth-row">
                      <span className="t-lbl">Position Inversion:</span>
                      <span className="t-val mono">
                        {attackerCode ? `${attackerCode} (P${decision?.race.attacker_position ?? '—'}) vs ${defenderCode ?? '—'} (P${decision?.race.defender_position ?? '—'})` : '—'}
                      </span>
                    </div>
                    <div className="truth-row">
                      <span className="t-lbl">Historical Provenance:</span>
                      <span className="t-val mono text-legal">
                        HISTORICAL_OUTCOME
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tactical Inspector Triggers */}
                <div className="forensic-actions-grid">
                  <button
                    type="button"
                    className="btn-forensic"
                    onClick={() => onOpenInspector('MODEL')}
                  >
                    INSPECT MODEL EVIDENCE &rarr;
                  </button>
                  <button
                    type="button"
                    className="btn-forensic"
                    onClick={() => onOpenInspector('ENERGY')}
                  >
                    INSPECT SIMULATED ENERGY &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
