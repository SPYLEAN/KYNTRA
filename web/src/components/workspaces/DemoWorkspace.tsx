import React from 'react';
import type {
  BattleWatchlistItem,
  CarState,
  DecisionSnapshot,
  InspectorTarget,
  InspectorType,
  TrackGeometry,
  WindowState,
} from '../../types';
import { DigitalTrackTwin } from '../DigitalTrackTwin';
import { ContextInspector } from '../ContextInspector';

interface DemoWorkspaceProps {
  geometry: TrackGeometry | null;
  cars: Record<string, CarState>;
  decision: DecisionSnapshot | null;
  watchlist: BattleWatchlistItem[];
  activeWindows: Record<string, WindowState>;
  selectedBattleId?: string | null;
  trackStatus?: string;
  circuitName?: string;
  inspectorTarget: InspectorTarget | null;
  onSelectBattle: (battleId: string) => void;
  onSelectCar: (driver: string) => void;
  onJumpToLap: (lap: number) => void;
  onOpenInspector: (type: InspectorType, payload?: any) => void;
  onCloseInspector: () => void;
}

export const DemoWorkspace: React.FC<DemoWorkspaceProps> = ({
  geometry,
  cars,
  decision,
  watchlist,
  activeWindows,
  selectedBattleId,
  trackStatus = '1',
  circuitName = 'Monza',
  inspectorTarget,
  onSelectBattle,
  onSelectCar,
  onJumpToLap,
  onOpenInspector,
  onCloseInspector,
}) => {
  const currentBattle = decision?.battle;
  const attackerCode = decision?.race.attacker;
  const defenderCode = decision?.race.defender;

  const currentWindow = selectedBattleId ? activeWindows[selectedBattleId] : null;

  return (
    <div className="workspace-demo-container">
      {/* 1. Top Engagement & Horizon Ribbon Pane (Clean Docked Structural Header) */}
      <div className="demo-top-ribbon-pane">
        <div className="demo-ribbon-engagement">
          <span className="ribbon-lbl font-bold mono">ACTIVE ENGAGEMENT:</span>
          <div
            className="ribbon-driver-pill attacker interactive-row"
            onClick={() => attackerCode && onOpenInspector('CAR', { driver: attackerCode })}
          >
            <span className="mono font-bold">P{decision?.race.attacker_position ?? '—'}</span>
            <span className="mono font-bold text-accent">{attackerCode || '—'}</span>
            <span className="role-lbl">ATT</span>
          </div>
          <span className="ribbon-arrow">&rarr;</span>
          <div
            className="ribbon-driver-pill defender interactive-row"
            onClick={() => defenderCode && onOpenInspector('CAR', { driver: defenderCode })}
          >
            <span className="mono font-bold">P{decision?.race.defender_position ?? '—'}</span>
            <span className="mono font-bold">{defenderCode || '—'}</span>
            <span className="role-lbl">DEF</span>
          </div>
          <div className="ribbon-metrics mono">
            <span className="stat-pill">
              GAP: <strong className="text-accent">{currentBattle?.gap_seconds !== null && currentBattle?.gap_seconds !== undefined ? `${currentBattle.gap_seconds.toFixed(2)}s` : '—'}</strong>
            </span>
            <span className="stat-pill">
              RATE: <strong>{currentBattle?.closing_rate !== null && currentBattle?.closing_rate !== undefined ? `${currentBattle.closing_rate > 0 ? '+' : ''}${currentBattle.closing_rate.toFixed(1)} m/s` : '—'}</strong>
            </span>
          </div>
        </div>

        <div className="demo-ribbon-horizons mono">
          <span className="ribbon-lbl font-bold">PASS PROJECTION (LIGHTGBM V1):</span>
          <span className="stat-pill">
            P1 (&le;1L): <strong className="text-accent">{decision?.overtake.p_1_lap !== null && decision?.overtake.p_1_lap !== undefined ? `${(decision.overtake.p_1_lap * 100).toFixed(0)}%` : '—'}</strong>
          </span>
          <span className="stat-pill">
            P2 (&le;2L): <strong>{decision?.overtake.p_2_laps !== null && decision?.overtake.p_2_laps !== undefined ? `${(decision.overtake.p_2_laps * 100).toFixed(0)}%` : '—'}</strong>
          </span>
          <span className="stat-pill">
            P3 (&le;3L): <strong>{decision?.overtake.p_3_laps !== null && decision?.overtake.p_3_laps !== undefined ? `${(decision.overtake.p_3_laps * 100).toFixed(0)}%` : '—'}</strong>
          </span>
          <span className={`window-tag window-${currentWindow?.window_state.toLowerCase() || 'unknown'}`}>
            {currentWindow?.window_state || 'STABLE'}
          </span>
        </div>

        <div className="demo-ribbon-actions">
          <button
            type="button"
            className="btn-demo-evidence mono font-bold"
            onClick={() => onOpenInspector('MODEL')}
          >
            MODEL EVIDENCE &rarr;
          </button>
        </div>
      </div>

      {/* 2. Center Hero Track Twin Pane (~76% Height, 85-90% Track Bounds) */}
      <div className="demo-center-track-pane">
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

      {/* 3. Bottom Continuous Decision Framework Pane (~16% Height) */}
      <div className="demo-bottom-decision-pane">
        <div className="decision-bar-header">
          <span className="label-title font-bold">DECISION FRAMEWORK</span>
          <span className="label-sub mono">CONTINUOUS TECHNICAL BASIS</span>
        </div>

        <div className="demo-decision-cards-grid">
          {/* Card 01: CAN I PASS? */}
          <div
            className="decision-card interactive-row"
            onClick={() => onOpenInspector('MODEL')}
            title="Inspect LightGBM V1 Pass Model Evidence"
          >
            <div className="card-top">
              <span className="card-num mono">01</span>
              <span className="card-lbl font-bold">CAN I PASS?</span>
              <span className={`card-tag mono window-${currentWindow?.window_state.toLowerCase() || 'unknown'}`}>
                {currentWindow?.window_state || 'STABLE'}
              </span>
            </div>
            <div className="card-metric mono font-bold text-accent">
              {decision?.overtake.p_1_lap !== null && decision?.overtake.p_1_lap !== undefined ? `${(decision.overtake.p_1_lap * 100).toFixed(0)}% P1` : '—'}
            </div>
            <div className="card-sub mono text-muted">
              P2: {decision?.overtake.p_2_laps ? `${(decision.overtake.p_2_laps * 100).toFixed(0)}%` : '—'} | P3: {decision?.overtake.p_3_laps ? `${(decision.overtake.p_3_laps * 100).toFixed(0)}%` : '—'}
            </div>
          </div>

          {/* Card 02: CAN I AFFORD IT? */}
          <div
            className="decision-card interactive-row"
            onClick={() => onOpenInspector('ENERGY')}
            title="Inspect FIA 2026 4.0MJ Usable Energy Store Buffer"
          >
            <div className="card-top">
              <span className="card-num mono">02</span>
              <span className="card-lbl font-bold">CAN I AFFORD IT?</span>
              <span className="card-tag mono tag-sim">SIMULATED</span>
            </div>
            <div className="card-metric mono font-bold text-legal">
              {decision?.energy.available_energy_mj !== null && decision?.energy.available_energy_mj !== undefined ? `${decision.energy.available_energy_mj.toFixed(2)} MJ` : '—'}
            </div>
            <div className="card-sub mono text-muted">
              4.0 MJ Buffer | FIA C5.2.9
            </div>
          </div>

          {/* Card 03: CAN I KEEP IT? */}
          <div
            className="decision-card"
            title="Post-pass position durability pending ruleset verification"
          >
            <div className="card-top">
              <span className="card-num mono">03</span>
              <span className="card-lbl font-bold">CAN I KEEP IT?</span>
              <span className="card-tag mono tag-pending">PENDING</span>
            </div>
            <div className="card-metric mono font-bold text-amber">
              UNKNOWN
            </div>
            <div className="card-sub mono text-muted">
              Retention Unmodeled
            </div>
          </div>

          {/* Card 04: AM I ALLOWED? */}
          <div
            className="decision-card interactive-row"
            onClick={() => onOpenInspector('COMPLIANCE')}
            title="Inspect Deterministic FIA Sporting & Technical Legality"
          >
            <div className="card-top">
              <span className="card-num mono">04</span>
              <span className="card-lbl font-bold">AM I ALLOWED?</span>
              <span className="card-tag mono tag-green">FIA C5.2.7</span>
            </div>
            <div className={`card-metric mono font-bold ${decision?.compliance.status === 'LEGAL' ? 'text-legal' : 'text-blocked'}`}>
              {decision?.compliance.status === 'LEGAL' ? '✓ LEGAL' : decision?.compliance.status === 'BLOCKED' ? '✕ BLOCKED' : 'UNKNOWN'}
            </div>
            <div className="card-sub mono text-muted">
              Deterministic Ruleset
            </div>
          </div>
        </div>
      </div>

      {/* In-Rail or Modal Inspector if open */}
      {inspectorTarget && inspectorTarget.type && (
        <ContextInspector
          target={inspectorTarget}
          onClose={onCloseInspector}
          decision={decision}
          cars={cars}
          watchlist={watchlist}
          onSelectBattle={onSelectBattle}
          onJumpToLap={onJumpToLap}
        />
      )}
    </div>
  );
};
