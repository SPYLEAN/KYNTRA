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

  // Build SVG path points for P1, P2, P3 if genuine history exists
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

  const p1 = decision?.overtake.p_1_lap;
  const p2 = decision?.overtake.p_2_laps;
  const p3 = decision?.overtake.p_3_laps;
  const gap = currentBattle?.gap_seconds;
  const closingRate = currentBattle?.closing_rate;
  const speedDelta = currentBattle?.speed_delta;

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
                {p1 != null
                  ? `CURRENT HORIZON: P1=${(p1 * 100).toFixed(0)}%, P2=${p2 != null ? (p2 * 100).toFixed(0) : '—'}%, P3=${p3 != null ? (p3 * 100).toFixed(0) : '—'}%`
                  : 'BUILDING WINDOW HISTORY (Awaiting rolling observations)'}
              </div>
            )}

            <div className="strip-footer-stats mono">
              <span className="stat-item">
                P1 (&le;1L): <strong className="text-accent">{p1 != null ? `${(p1 * 100).toFixed(0)}%` : '—'}</strong>
              </span>
              <span className="stat-item">
                P2 (&le;2L): <strong>{p2 != null ? `${(p2 * 100).toFixed(0)}%` : '—'}</strong>
              </span>
              <span className="stat-item">
                P3 (&le;3L): <strong>{p3 != null ? `${(p3 * 100).toFixed(0)}%` : '—'}</strong>
              </span>
              <span className="stat-item text-muted">
                PAV: <strong>MONOTONIC</strong>
              </span>
              <span className="stat-item">
                TREND: <strong>{currentWindow?.trend_direction || 'STABLE'}</strong>
              </span>
            </div>
          </div>
        ) : (
          /* TELEMETRY TRACES VIEW (STRICT TRUTH: NO SYNTHETIC SINE WAVES) */
          <div className="trace-view-container">
            <div className="building-window-notice mono text-muted">
              {speedDelta != null
                ? `LIVE SPEED DELTA: ${speedDelta > 0 ? '+' : ''}${speedDelta.toFixed(1)} km/h | GAP: ${gap != null ? `${gap.toFixed(2)}s` : '—'} | CLOSING: ${closingRate != null ? `${closingRate.toFixed(2)} m/s` : '—'}`
                : 'HIGH-FREQUENCY TIME-SERIES TRACES UNAVAILABLE (Telemetry batch mode)'}
            </div>

            <div className="strip-footer-stats mono">
              <span className="stat-item">
                {attackerCode} vs {defenderCode} SPEED DELTA:{' '}
                <strong className="text-accent">
                  {speedDelta != null ? `${speedDelta > 0 ? '+' : ''}${speedDelta.toFixed(1)} km/h` : '—'}
                </strong>
              </span>
              <span className="stat-item">
                GAP: <strong>{gap != null ? `${gap.toFixed(2)}s` : '—'}</strong>
              </span>
              <span className="stat-item">
                CLOSING:{' '}
                <strong>
                  {closingRate != null
                    ? `${closingRate > 0 ? '+' : ''}${closingRate.toFixed(2)} m/s`
                    : '—'}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
