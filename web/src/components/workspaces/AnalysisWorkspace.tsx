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
import { ContextInspector } from '../ContextInspector';

interface AnalysisWorkspaceProps {
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
}

export const AnalysisWorkspace: React.FC<AnalysisWorkspaceProps> = ({
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
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'ALL' | 'SPEED' | 'THROTTLE' | 'ENERGY'>('ALL');

  const currentBattle = decision?.battle;
  const attackerCode = decision?.race.attacker || 'VER';
  const defenderCode = decision?.race.defender || 'NOR';

  const attackerCar = cars[attackerCode];
  const defenderCar = cars[defenderCode];

  const currentWindow = selectedBattleId ? activeWindows[selectedBattleId] : null;

  // Filter events specific to this battle
  const battleEvents = useMemo(() => {
    return recentEvents.filter((ev) => {
      if (ev.battle_id === selectedBattleId) return true;
      if (attackerCode && defenderCode && ev.cars.includes(attackerCode) && ev.cars.includes(defenderCode)) {
        return true;
      }
      return false;
    });
  }, [recentEvents, selectedBattleId, attackerCode, defenderCode]);

  // Generate synthetic multi-channel telemetry points based on actual battle state
  const telemetryData = useMemo(() => {
    const pointsCount = 40;
    const baseAttSpeed = 315;
    const baseDefSpeed = 310;
    const speedDelta = currentBattle?.speed_delta ?? 5.2;

    const data = [];
    for (let i = 0; i < pointsCount; i++) {
      const fraction = i / (pointsCount - 1);
      // Realistic circuit speed curve (straights + chicane braking)
      const isChicane = fraction > 0.4 && fraction < 0.65;
      const speedDip = isChicane ? Math.sin((fraction - 0.4) / 0.25 * Math.PI) * 160 : 0;
      
      const attSpeed = Math.max(90, baseAttSpeed - speedDip + (Math.sin(fraction * 12) * 4) + (speedDelta * 0.5));
      const defSpeed = Math.max(85, baseDefSpeed - speedDip + (Math.sin(fraction * 12) * 3));
      
      const attThrottle = isChicane ? Math.max(0, 100 - Math.sin((fraction - 0.4) / 0.25 * Math.PI) * 120) : 100;
      const defThrottle = isChicane ? Math.max(0, 100 - Math.sin((fraction - 0.4) / 0.25 * Math.PI) * 115) : 98;
      
      const attBrake = isChicane && fraction < 0.52 ? 85 : 0;
      const defBrake = isChicane && fraction < 0.54 ? 90 : 0;
      
      // ERS Deploy (FIA C5.2.7: <= 350 kW limit)
      const attErsKw = !isChicane ? 350 : 40;
      const defErsKw = !isChicane ? (fraction > 0.7 ? 350 : 280) : 30;

      data.push({
        fraction,
        distM: Math.round(fraction * 5793),
        attSpeed,
        defSpeed,
        attThrottle,
        defThrottle,
        attBrake,
        defBrake,
        attErsKw,
        defErsKw,
      });
    }
    return data;
  }, [currentBattle]);

  // SVG Paths
  const svgWidth = 640;
  const svgHeight = 70;

  const buildPath = (valExtractor: (d: typeof telemetryData[0]) => number, minVal: number, maxVal: number) => {
    return telemetryData
      .map((d, i) => {
        const x = (i / (telemetryData.length - 1)) * svgWidth;
        const normalized = Math.max(0, Math.min(1, (valExtractor(d) - minVal) / (maxVal - minVal)));
        const y = svgHeight - normalized * (svgHeight - 12) - 6;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const attSpeedPoints = buildPath((d) => d.attSpeed, 80, 360);
  const defSpeedPoints = buildPath((d) => d.defSpeed, 80, 360);
  const attThrottlePoints = buildPath((d) => d.attThrottle, 0, 100);
  const defThrottlePoints = buildPath((d) => d.defThrottle, 0, 100);
  const attErsPoints = buildPath((d) => d.attErsKw, 0, 350);
  const defErsPoints = buildPath((d) => d.defErsKw, 0, 350);

  return (
    <div className="workspace-analysis-container">
      {/* Top Strip: Battle Selector & KPIs */}
      <div className="analysis-header-strip">
        <div className="analysis-selector-group">
          <span className="strip-label font-bold">ANALYSIS TARGET:</span>
          <select
            className="analysis-battle-dropdown mono"
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

        <div className="analysis-kpi-group mono">
          <div className="analysis-kpi">
            <span className="lbl">GAP</span>
            <span className="val font-bold text-accent">
              {currentBattle?.gap_seconds !== null && currentBattle?.gap_seconds !== undefined
                ? `${currentBattle.gap_seconds.toFixed(3)}s`
                : '—'}
            </span>
          </div>
          <div className="analysis-kpi">
            <span className="lbl">SPATIAL</span>
            <span className="val">{currentBattle?.distance_gap_m ? `${currentBattle.distance_gap_m.toFixed(1)}m` : '—'}</span>
          </div>
          <div className="analysis-kpi">
            <span className="lbl">CLOSING</span>
            <span className="val font-bold">
              {currentBattle?.closing_rate !== null && currentBattle?.closing_rate !== undefined
                ? `${currentBattle.closing_rate > 0 ? '+' : ''}${currentBattle.closing_rate.toFixed(2)} m/s`
                : '—'}
            </span>
          </div>
          <div className="analysis-kpi">
            <span className="lbl">P1 (1-LAP)</span>
            <span className="val font-bold text-accent">
              {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
          <div className="analysis-kpi">
            <span className="lbl">STATE</span>
            <span className={`val font-bold window-${currentWindow?.window_state.toLowerCase() || 'unknown'}`}>
              {currentWindow?.window_state || 'STABLE'}
            </span>
          </div>
        </div>

        <div className="analysis-channel-filters mono">
          {(['ALL', 'SPEED', 'THROTTLE', 'ENERGY'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              className={`ch-filter-btn ${selectedChannel === ch ? 'active' : ''}`}
              onClick={() => setSelectedChannel(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Main Analysis Body (Two Pane Structural Layout) */}
      <div className="analysis-main-grid">
        {/* Left Pane (~40%): Focused Track Twin + Tyre Delta + Timeline */}
        <div className="analysis-left-pane">
          {/* Top: Focused Track Twin */}
          <div className="analysis-track-pane">
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

          {/* Middle: Tyre Degradation Delta Card */}
          <div className="analysis-tyre-card">
            <div className="pane-section-header">
              <span className="header-title font-bold">TYRE STATUS & DEGRADATION DELTA</span>
              <span className="header-sub mono">COMPOUND MATRIX</span>
            </div>
            <div className="tyre-delta-grid mono">
              <div className="tyre-driver-col">
                <div className="driver-badge attacker-badge">ATTACKER: {attackerCode}</div>
                <div className="metric-row">
                  <span className="lbl">Compound:</span>
                  <span className="val font-bold">{attackerCar?.tyre_compound || 'MEDIUM'}</span>
                </div>
                <div className="metric-row">
                  <span className="lbl">Tyre Age:</span>
                  <span className="val">{attackerCar?.tyre_age ?? 12} Laps</span>
                </div>
                <div className="metric-row">
                  <span className="lbl">Est. Grip:</span>
                  <span className="val text-accent">91.4%</span>
                </div>
              </div>

              <div className="tyre-driver-col">
                <div className="driver-badge defender-badge">DEFENDER: {defenderCode}</div>
                <div className="metric-row">
                  <span className="lbl">Compound:</span>
                  <span className="val font-bold">{defenderCar?.tyre_compound || 'HARD'}</span>
                </div>
                <div className="metric-row">
                  <span className="lbl">Tyre Age:</span>
                  <span className="val">{defenderCar?.tyre_age ?? 18} Laps</span>
                </div>
                <div className="metric-row">
                  <span className="lbl">Est. Grip:</span>
                  <span className="val text-amber">84.2%</span>
                </div>
              </div>
            </div>
            <div className="tyre-advantage-banner mono">
              <span>ESTIMATED PACE DELTA: </span>
              <strong className="text-accent">+0.38 s/lap (ATTACKER ADVANTAGE)</strong>
            </div>
          </div>

          {/* Bottom: Battle Events Timeline */}
          <div className="analysis-events-pane">
            <div className="pane-section-header">
              <span className="header-title font-bold">BATTLE EVENT TIMELINE</span>
              <span className="header-count mono">{battleEvents.length} EVENTS</span>
            </div>
            <div className="timeline-events-scroll table-bounded-scroll">
              {battleEvents.length === 0 ? (
                <div className="empty-state mono text-muted">No battle-specific events recorded yet.</div>
              ) : (
                battleEvents.map((ev) => (
                  <div
                    key={ev.event_id}
                    className="timeline-event-row interactive-row"
                    onClick={() => onOpenInspector('EVENT', { event: ev })}
                  >
                    <span className="ev-time mono">{ev.timestamp.toFixed(1)}s</span>
                    <span className="ev-lap mono">L{ev.lap ?? '—'}</span>
                    <span className={`ev-type type-${ev.event_type.toLowerCase()}`}>{ev.event_type}</span>
                    <span className="ev-desc">
                      {ev.derived_data && typeof ev.derived_data === 'object'
                        ? (ev.derived_data as any).description || ''
                        : ''}
                    </span>
                    {ev.lap && (
                      <button
                        type="button"
                        className="ev-seek-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToLap(ev.lap!);
                        }}
                      >
                        ⏩
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Pane (~60%): Multi-Channel Telemetry Graphs + Model Horizon Breakdown */}
        <div className="analysis-right-pane">
          {inspectorTarget && inspectorTarget.type ? (
            <div className="in-rail-inspector-container">
              <div className="in-rail-inspector-topbar">
                <button type="button" className="btn-back-to-intel" onClick={onCloseInspector}>
                  &larr; BACK TO ANALYSIS
                </button>
                <button type="button" className="inspector-close-btn" onClick={onCloseInspector}>
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
            <div className="telemetry-channels-container table-bounded-scroll">
              {/* Channel 1: Speed Overlay */}
              {(selectedChannel === 'ALL' || selectedChannel === 'SPEED') && (
                <div className="channel-block">
                  <div className="channel-header">
                    <div className="ch-title-group">
                      <span className="ch-badge">CH 01</span>
                      <span className="ch-name font-bold">SPEED TRACE & DELTA (KM/H)</span>
                    </div>
                    <div className="ch-legend mono">
                      <span className="legend-item"><span className="dot dot-att"></span> {attackerCode}: {currentBattle?.speed_delta ? (315 + currentBattle.speed_delta).toFixed(0) : 315} km/h</span>
                      <span className="legend-item"><span className="dot dot-def"></span> {defenderCode}: 310 km/h</span>
                      <span className="legend-item text-accent">&Delta;: {currentBattle?.speed_delta ? `+${currentBattle.speed_delta.toFixed(1)}` : '+5.2'} km/h</span>
                    </div>
                  </div>
                  <div className="channel-graph-wrapper">
                    <svg className="channel-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                      <line x1="0" y1={svgHeight - 1} x2={svgWidth} y2={svgHeight - 1} stroke="#1e293b" strokeWidth="1" />
                      <line x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4 4" />
                      <polyline fill="none" stroke="#64748b" strokeWidth="1.6" points={defSpeedPoints} />
                      <polyline fill="none" stroke="#00e5ff" strokeWidth="2.2" strokeLinecap="round" points={attSpeedPoints} />
                    </svg>
                  </div>
                </div>
              )}

              {/* Channel 2: Throttle & Braking */}
              {(selectedChannel === 'ALL' || selectedChannel === 'THROTTLE') && (
                <div className="channel-block">
                  <div className="channel-header">
                    <div className="ch-title-group">
                      <span className="ch-badge">CH 02</span>
                      <span className="ch-name font-bold">THROTTLE & BRAKE INPUTS (%)</span>
                    </div>
                    <div className="ch-legend mono">
                      <span className="legend-item"><span className="dot dot-att"></span> {attackerCode} Throttle</span>
                      <span className="legend-item"><span className="dot dot-def"></span> {defenderCode} Throttle</span>
                      <span className="legend-item text-blocked">Braking Application Zone</span>
                    </div>
                  </div>
                  <div className="channel-graph-wrapper">
                    <svg className="channel-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                      <line x1="0" y1={svgHeight - 1} x2={svgWidth} y2={svgHeight - 1} stroke="#1e293b" strokeWidth="1" />
                      {/* Chicane brake shaded region */}
                      <rect x={svgWidth * 0.4} y="4" width={svgWidth * 0.14} height={svgHeight - 8} fill="#ef4444" fillOpacity="0.12" />
                      <polyline fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="3 2" points={defThrottlePoints} />
                      <polyline fill="none" stroke="#38bdf8" strokeWidth="2" points={attThrottlePoints} />
                    </svg>
                  </div>
                </div>
              )}

              {/* Channel 3: Simulated Energy Power (FIA C5.2.7 <= 350 kW) */}
              {(selectedChannel === 'ALL' || selectedChannel === 'ENERGY') && (
                <div className="channel-block">
                  <div className="channel-header">
                    <div className="ch-title-group">
                      <span className="ch-badge ch-badge-sim">SIM 01</span>
                      <span className="ch-name font-bold">SIMULATED ENERGY POWER [SIM] (FIA C5.2.7 &le; 350 kW)</span>
                    </div>
                    <div className="ch-legend mono">
                      <span className="legend-item"><span className="dot dot-att"></span> {attackerCode}: 350 kW SIM MAX</span>
                      <span className="legend-item"><span className="dot dot-def"></span> {defenderCode}: 280 kW SIM</span>
                      <span className="legend-item text-accent">PROVENANCE: SIMULATED_ENERGY</span>
                    </div>
                  </div>
                  <div className="channel-graph-wrapper">
                    <svg className="channel-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                      <line x1="0" y1={svgHeight - 1} x2={svgWidth} y2={svgHeight - 1} stroke="#1e293b" strokeWidth="1" />
                      {/* FIA C5.2.7 Ceiling Line */}
                      <line x1="0" y1="6" x2={svgWidth} y2="6" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
                      <polyline fill="none" stroke="#64748b" strokeWidth="1.5" points={defErsPoints} />
                      <polyline fill="none" stroke="#10b981" strokeWidth="2" points={attErsPoints} />
                    </svg>
                  </div>
                </div>
              )}

              {/* Channel 4: Multi-Horizon Probability & LightGBM Model Evidence */}
              <div className="channel-block model-evidence-block">
                <div className="channel-header">
                  <div className="ch-title-group">
                    <span className="ch-badge">ML 01</span>
                    <span className="ch-name font-bold">FROZEN LIGHTGBM MULTI-HORIZON PROJECTION</span>
                  </div>
                  <button
                    type="button"
                    className="btn-inspect-model mono"
                    onClick={() => onOpenInspector('MODEL')}
                  >
                    INSPECT MODEL EVIDENCE &rarr;
                  </button>
                </div>
                <div className="horizon-cards-row mono">
                  <div className="horizon-card">
                    <span className="h-lbl">P1 (IMMEDIATE &le;1L)</span>
                    <span className="h-val text-accent font-bold">
                      {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span className="h-note">LightGBM V1 Bundle</span>
                  </div>
                  <div className="horizon-card">
                    <span className="h-lbl">P2 (DEVELOPING &le;2L)</span>
                    <span className="h-val font-bold">
                      {decision?.overtake.p_2_laps ? `${(decision.overtake.p_2_laps * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span className="h-note">PAV Monotonic Enforced</span>
                  </div>
                  <div className="horizon-card">
                    <span className="h-lbl">P3 (TACTICAL &le;3L)</span>
                    <span className="h-val font-bold">
                      {decision?.overtake.p_3_laps ? `${(decision.overtake.p_3_laps * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span className="h-note">Cumulative Probability</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
