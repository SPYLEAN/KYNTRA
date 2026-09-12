import React from 'react';
import type { KyntraRuntimeSnapshot, RaceState } from '../../types';
import type { OperatingMode } from '../../domain/types';

interface TopCommandBarProps {
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  raceState: RaceState | null;
  isStreaming: boolean;
  operatingMode: OperatingMode;
  onSelectOperatingMode: (mode: OperatingMode) => void;
  onOpenSessionSwitcher: () => void;
  onOpenShortcuts: () => void;
  onOpenSystemInspector: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  runtimeSnapshot,
  raceState,
  isStreaming,
  operatingMode,
  onSelectOperatingMode,
  onOpenSessionSwitcher,
  onOpenShortcuts,
  onOpenSystemInspector,
}) => {
  const eventId = runtimeSnapshot?.event_id || raceState?.session.event_id || '2026_13_ITA';
  const eventName = raceState?.session.event_name || 'Italian Grand Prix';
  const circuitName = raceState?.session.circuit || 'Monza';
  const currentLap = runtimeSnapshot?.current_lap ?? raceState?.session.current_lap ?? null;
  const totalLaps = raceState?.session.total_laps ?? null;
  const sourceMode = runtimeSnapshot?.mode || (operatingMode === 'REPLAY' ? 'HISTORICAL_REPLAY' : 'LIVE_FEED');
  const systemHealth = runtimeSnapshot?.health.system_health || 'OPERATIONAL';
  const ruleVersion = runtimeSnapshot?.current_matrix?.rule_bundle_version || '2026_FIA_ISSUE_20';
  const latencyMs = runtimeSnapshot?.latencies?.total_cycle_ms;
  const dataAge = raceState?.session.data_age ?? (latencyMs ? (latencyMs / 1000).toFixed(1) : null);

  // FIA Flag State
  const trackStatus = runtimeSnapshot?.race_control?.['track_status'] || raceState?.track?.track_status || '1';
  let flagClass = 'flag-green';
  let flagLabel = 'GREEN';
  if (trackStatus === '2') {
    flagClass = 'flag-yellow';
    flagLabel = 'YELLOW';
  } else if (trackStatus === '4') {
    flagClass = 'flag-sc';
    flagLabel = 'SAFETY CAR';
  } else if (trackStatus === '6' || trackStatus === '7') {
    flagClass = 'flag-vsc';
    flagLabel = 'VSC';
  } else if (trackStatus === '5') {
    flagClass = 'flag-red';
    flagLabel = 'RED FLAG';
  }

  return (
    <header className="kyntra-top-command-bar" aria-label="Operational Command Bar">
      {/* Brand Wordmark & Tag */}
      <div className="command-brand-section">
        <span className="brand-wordmark font-bold">KYNTRA</span>
        <span className="brand-divider">/</span>
        <span className="brand-product mono">ENERGY &amp; OVERTAKE INTELLIGENCE</span>
      </div>

      {/* Mode Selector (LIVE, FORECAST, REPLAY) */}
      <div className="command-mode-selector mono">
        {(['LIVE', 'FORECAST', 'REPLAY'] as OperatingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`mode-btn ${operatingMode === m ? 'active' : ''}`}
            onClick={() => onSelectOperatingMode(m)}
            title={`Switch to ${m} Mode`}
          >
            {m === 'LIVE' && <span className="mode-live-dot pulse" />}
            <span>{m}</span>
          </button>
        ))}
      </div>

      {/* Segmented Operational Metadata Strip */}
      <div className="command-telemetry-strip mono">
        {/* Source Mode Truth */}
        <div className="telemetry-item item-source" title={`Backend Source Feed: ${sourceMode}`}>
          <span className="t-lbl">SRC:</span>
          <span className="t-val text-accent">{sourceMode}</span>
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
            {currentLap != null ? (totalLaps ? `${currentLap}/${totalLaps}` : `${currentLap}`) : '—'}
          </span>
        </div>

        {/* FIA Track Status */}
        <div className={`telemetry-item item-flag ${flagClass}`} title={`FIA Track Status: Flag Code ${trackStatus}`}>
          <span className="flag-bullet" />
          <span className="t-val font-bold">{flagLabel}</span>
        </div>

        {/* Telemetry Freshness */}
        <div className="telemetry-item item-freshness" title="Telemetry Ingestion Freshness">
          <span className="t-lbl">DATA:</span>
          <span className="t-val mono-num font-bold">
            {dataAge ? `${dataAge}s` : '—'}
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
          <span>{isStreaming ? 'LIVE STREAM' : 'POLLING'}</span>
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
