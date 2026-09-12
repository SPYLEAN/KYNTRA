import React from 'react';
import type { KyntraRuntimeSnapshot, RaceState } from '../../types';

interface TopCommandBarProps {
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  raceState: RaceState | null;
  isStreaming: boolean;
  onOpenSessionSwitcher: () => void;
  onOpenShortcuts: () => void;
  onOpenSystemInspector: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  runtimeSnapshot,
  raceState,
  isStreaming,
  onOpenSessionSwitcher,
  onOpenShortcuts,
  onOpenSystemInspector,
}) => {
  const eventId = runtimeSnapshot?.event_id || raceState?.session.event_id || '2026_13_ITA';
  const eventName = raceState?.session.event_name || 'Italian Grand Prix';
  const circuitName = raceState?.session.circuit || 'Monza';
  const currentLap = runtimeSnapshot?.current_lap ?? raceState?.session.current_lap ?? 0;
  const totalLaps = raceState?.session.total_laps ?? 53;
  const mode = (runtimeSnapshot?.mode || 'LIVE_FEED').replace('_FEED', '').replace('HISTORICAL_', '');
  const systemHealth = runtimeSnapshot?.health.system_health || 'OPERATIONAL';
  const ruleVersion = runtimeSnapshot?.current_matrix?.rule_bundle_version || '2026_FIA_ISSUE_20';
  const latencyMs = runtimeSnapshot?.latencies?.total_cycle_ms;
  const dataAge = raceState?.session.data_age ?? (latencyMs ? (latencyMs / 1000).toFixed(1) : '0.4');

  return (
    <header className="kyntra-top-command-bar" aria-label="Operational Command Bar">
      {/* Brand Wordmark & Tag */}
      <div className="command-brand-section">
        <span className="brand-wordmark font-bold">KYNTRA</span>
        <span className="brand-divider">/</span>
        <span className="brand-product mono">TACTICAL DECISION WORKSTATION</span>
      </div>

      {/* Segmented Operational Metadata Strip */}
      <div className="command-telemetry-strip mono">
        {/* Mode Indicator */}
        <div className="telemetry-item item-mode">
          <span className="t-dot pulse" />
          <span className="t-val font-bold text-accent">{mode}</span>
        </div>

        {/* Event & Circuit Switcher Trigger */}
        <div
          className="telemetry-item item-event clickable"
          onClick={onOpenSessionSwitcher}
          title={`Click to switch race session: ${eventName}`}
        >
          <span className="t-lbl">EVENT:</span>
          <span className="t-val font-bold text-primary">{circuitName}</span>
          <span className="t-sub text-muted">[{eventId}]</span>
          <span className="t-caret">&#9662;</span>
        </div>

        {/* Lap Counter */}
        <div className="telemetry-item item-lap">
          <span className="t-lbl">LAP:</span>
          <span className="t-val font-bold mono-num">
            {currentLap > 0 ? `${currentLap}/${totalLaps}` : '—'}
          </span>
        </div>

        {/* Telemetry Freshness */}
        <div className="telemetry-item item-freshness" title="Telemetry Ingestion Freshness">
          <span className="t-lbl">DATA:</span>
          <span className="t-val mono-num font-bold">
            {dataAge ? `${dataAge}s` : 'UNKNOWN'}
          </span>
        </div>

        {/* Active FIA Rule Bundle */}
        <div className="telemetry-item item-rules" title="Active FIA Sporting & Technical Rule Bundle">
          <span className="t-lbl">FIA:</span>
          <span className="t-val text-secondary">{ruleVersion.replace('2026_FIA_', '')}</span>
        </div>

        {/* Platform Health Status */}
        <div
          className={`telemetry-item item-health clickable ${
            systemHealth === 'OPERATIONAL' ? 'health-ok' : 'health-warn'
          }`}
          onClick={onOpenSystemInspector}
          title="Platform Operational Health Status. Click for module diagnostics."
        >
          <span className="health-badge-dot" />
          <span className="t-val font-bold">{systemHealth}</span>
        </div>
      </div>

      {/* Right Stream & Utility Actions */}
      <div className="command-utilities-section">
        {/* Stream Status Badge */}
        <div
          className={`stream-badge mono font-bold ${
            isStreaming ? 'stream-live' : 'stream-polling'
          }`}
          title={
            isStreaming
              ? 'Real-Time Bidirectional WebSocket Stream Active'
              : 'Polling REST Fallback Active (1000ms Interval)'
          }
        >
          <span className="stream-dot" />
          <span>{isStreaming ? 'LIVE STREAM' : 'POLLING FALLBACK'}</span>
        </div>

        {/* Keyboard Shortcuts Trigger */}
        <button
          type="button"
          className="utility-btn mono"
          onClick={onOpenShortcuts}
          title="Operational Keyboard Shortcuts [?]"
        >
          [?]
        </button>
      </div>
    </header>
  );
};
