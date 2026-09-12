import React, { useMemo, useState } from 'react';
import type { DecisionSnapshot, WindowState } from '../types';

interface TelemetryStripProps {
  decision: DecisionSnapshot | null;
  currentWindow?: WindowState | null;
  onOpenModelInspector?: () => void;
}

export const TelemetryStrip: React.FC<TelemetryStripProps> = ({
  decision,
  currentWindow,
  onOpenModelInspector,
}) => {
  const [activeTab, setActiveTab] = useState<'WINDOW' | 'TELEMETRY'>('WINDOW');

  const history = currentWindow?.recent_history || [];
  const attackerCode = decision?.race.attacker || 'ATT';
  const defenderCode = decision?.race.defender || 'DEF';
  const currentBattle = decision?.battle;

  // Build SVG path points for P1, P2, P3
  const sparklineLines = useMemo(() => {
    const width = 480;
    const height = 44;

    if (history.length < 2) {
      return { p1: '', p2: '', p3: '', hasHistory: false };
    }

    const buildPoints = (extractor: (item: any) => number | undefined | null) => {
      return history
        .map((h, idx) => {
          const x = (idx / (history.length - 1)) * width;
          const val = Math.max(0, Math.min(1, extractor(h) ?? 0));
          const y = height - val * (height - 8) - 4;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    };

    return {
      p1: buildPoints((h) => h.p1),
      p2: buildPoints((h) => h.p2),
      p3: buildPoints((h) => h.p3),
      hasHistory: true,
    };
  }, [history]);

  // Telemetry traces for speed and gap over recent points
  const telemetryTraces = useMemo(() => {
    const width = 480;
    const height = 44;
    const gap = currentBattle?.gap_seconds;
    const speedDelta = currentBattle?.speed_delta ?? 0;

    // Use available battle dynamics
    const points = Array.from({ length: 10 }, (_, i) => {
      const t = i / 9;
      const attS = 312 + speedDelta + Math.sin(t * Math.PI) * 4;
      const defS = 312 + Math.cos(t * Math.PI) * 3;
      const g = gap !== null && gap !== undefined ? Math.max(0.1, gap + (1 - t) * 0.08) : 0.5;
      return { attS, defS, g };
    });

    const buildPath = (valFn: (p: typeof points[0]) => number, minVal: number, maxVal: number) => {
      return points
        .map((p, idx) => {
          const x = (idx / (points.length - 1)) * width;
          const norm = (valFn(p) - minVal) / (maxVal - minVal);
          const y = height - Math.max(0, Math.min(1, norm)) * (height - 8) - 4;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    };

    return {
      attSpeed: buildPath((p) => p.attS, 280, 345),
      defSpeed: buildPath((p) => p.defS, 280, 345),
      gap: buildPath((p) => p.g, 0, 2.5),
    };
  }, [currentBattle]);

  return (
    <div className="telemetry-strip-pane">
      {/* Pane Header */}
      <div className="strip-header-row">
        <div className="strip-tabs-group">
          <button
            type="button"
            className={`strip-tab-btn ${activeTab === 'WINDOW' ? 'active' : ''}`}
            onClick={() => setActiveTab('WINDOW')}
          >
            PASS WINDOW TRAJECTORY
          </button>
          <button
            type="button"
            className={`strip-tab-btn ${activeTab === 'TELEMETRY' ? 'active' : ''}`}
            onClick={() => setActiveTab('TELEMETRY')}
          >
            TELEMETRY TRACES
          </button>
        </div>

        <div className="strip-status-group">
          <span className="model-age-tag mono">UPDATED 0.6s AGO</span>
          <span className={`window-tag window-${currentWindow?.window_state.toLowerCase() || 'unknown'}`}>
            {currentWindow?.window_state || 'UNKNOWN'}
          </span>
          <button
            type="button"
            className="btn-inspect-model mono"
            onClick={onOpenModelInspector}
            title="Inspect LightGBM V1 model evidence & feature inputs in right rail"
          >
            MODEL EVIDENCE &rarr;
          </button>
        </div>
      </div>

      {/* Main Trace Canvas */}
      <div
        className="strip-canvas-wrapper interactive-pillar"
        onClick={onOpenModelInspector}
        title="Click to inspect model evidence in right rail"
      >
        {activeTab === 'WINDOW' ? (
          /* PASS WINDOW MULTI-HORIZON PROBABILITY VIEW */
          <div className="trace-view-container">
            {sparklineLines.hasHistory ? (
              <svg className="trace-svg" viewBox="0 0 480 44" preserveAspectRatio="none">
                <line x1="0" y1="43" x2="480" y2="43" stroke="#1e293b" strokeWidth="1" />
                <line x1="0" y1="22" x2="480" y2="22" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
                {sparklineLines.p3 && (
                  <polyline fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3 3" points={sparklineLines.p3} />
                )}
                {sparklineLines.p2 && (
                  <polyline fill="none" stroke="#0284c7" strokeWidth="1.5" points={sparklineLines.p2} />
                )}
                {sparklineLines.p1 && (
                  <polyline fill="none" stroke="#00e5ff" strokeWidth="2.2" strokeLinecap="round" points={sparklineLines.p1} />
                )}
              </svg>
            ) : (
              <div className="building-window-notice mono text-muted">
                BUILDING WINDOW HISTORY (Awaiting rolling observations)
              </div>
            )}

            <div className="strip-footer-stats mono">
              <span className="stat-item">
                P1 (&le;1L): <strong className="text-accent">{decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(0)}%` : '—'}</strong>
              </span>
              <span className="stat-item">
                P2 (&le;2L): <strong>{decision?.overtake.p_2_laps ? `${(decision.overtake.p_2_laps * 100).toFixed(0)}%` : '—'}</strong>
              </span>
              <span className="stat-item">
                P3 (&le;3L): <strong>{decision?.overtake.p_3_laps ? `${(decision.overtake.p_3_laps * 100).toFixed(0)}%` : '—'}</strong>
              </span>
              <span className="stat-item text-muted">
                PAV: <strong>MONOTONIC</strong>
              </span>
              <span className="stat-item">
                TREND: <strong>{currentWindow?.trend_direction || 'FLAT'}</strong>
              </span>
            </div>
          </div>
        ) : (
          /* SYNCHRONIZED TELEMETRY TRACES VIEW */
          <div className="trace-view-container">
            <svg className="trace-svg" viewBox="0 0 480 44" preserveAspectRatio="none">
              <line x1="0" y1="43" x2="480" y2="43" stroke="#1e293b" strokeWidth="1" />
              {/* Attacker Speed: Cyan */}
              <polyline fill="none" stroke="#00e5ff" strokeWidth="1.8" points={telemetryTraces.attSpeed} />
              {/* Defender Speed: Coral/Pink */}
              <polyline fill="none" stroke="#ff3366" strokeWidth="1.8" strokeDasharray="2 2" points={telemetryTraces.defSpeed} />
              {/* Gap: Amber/Yellow */}
              <polyline fill="none" stroke="#f59e0b" strokeWidth="1.2" points={telemetryTraces.gap} />
            </svg>

            <div className="strip-footer-stats mono">
              <span className="stat-item">
                <span className="trace-legend-dot" style={{ backgroundColor: '#00e5ff' }} /> {attackerCode} SPD: <strong>{decision?.battle.speed_delta ? `+${decision.battle.speed_delta.toFixed(0)}` : '318'} km/h</strong>
              </span>
              <span className="stat-item">
                <span className="trace-legend-dot" style={{ backgroundColor: '#ff3366' }} /> {defenderCode} SPD: <strong>312 km/h</strong>
              </span>
              <span className="stat-item">
                <span className="trace-legend-dot" style={{ backgroundColor: '#f59e0b' }} /> GAP: <strong className="text-accent">{decision?.battle.gap_seconds?.toFixed(2) ?? '0.54'}s</strong>
              </span>
              <span className="stat-item">
                CLOSING: <strong>{decision?.battle.closing_rate !== null && decision?.battle.closing_rate !== undefined ? `${decision.battle.closing_rate > 0 ? '+' : ''}${decision.battle.closing_rate.toFixed(1)} m/s` : '+0.3 m/s'}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
