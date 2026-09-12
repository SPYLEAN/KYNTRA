import React from 'react';
import type { KyntraRuntimeSnapshot, RaceState, SystemHealthStatus } from '../../types';
import { resolveSystemHealthDisplay, type OperatingMode } from '../../domain/types';

import type { StreamConnectionStatus } from '../../hooks/useRuntimeStream';

interface TopCommandBarProps {
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  raceState: RaceState | null;
  isStreaming: boolean;
  connectionStatus?: StreamConnectionStatus;
  isStale?: boolean;
  transportType?: 'WS_STREAM' | 'HTTP_POLL';
  latencyMs?: number | null;
  operatingMode: OperatingMode;
  onSelectOperatingMode: (mode: OperatingMode) => void;
  onOpenSessionSwitcher: () => void;
  onOpenShortcuts: () => void;
  onOpenSystemInspector: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  runtimeSnapshot,
  raceState,
  isStreaming: _isStreaming,
  connectionStatus = 'CONNECTED',
  isStale = false,
  transportType = 'WS_STREAM',
  latencyMs: rawLatencyMs,
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

  // Canonical Source Mode
  const sourceMode = runtimeSnapshot?.mode || (operatingMode === 'REPLAY' ? 'HISTORICAL_REPLAY' : 'LIVE_FEED');

  // Contradiction A1 Fix: Canonical Operating Mode alignment
  // If backend source is HISTORICAL_REPLAY and user has not forced FORECAST, mode is canonically REPLAY
  const canonicalMode: OperatingMode =
    operatingMode === 'FORECAST'
      ? 'FORECAST'
      : sourceMode === 'HISTORICAL_REPLAY'
      ? 'REPLAY'
      : 'LIVE';

  // Contradiction A4 Fix: System Health Resolution (handling coarse DEGRADED -> NON-BLOCKING)
  const rawHealth: SystemHealthStatus = (runtimeSnapshot?.health?.system_health as any) || 'OPERATIONAL';
  const resolvedHealth = resolveSystemHealthDisplay(rawHealth, runtimeSnapshot?.health?.modules);

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
      {/* 1. LEFT ZONE: Brand Wordmark & Product Title */}
      <div className="command-brand-section">
        <span className="brand-wordmark font-bold">KYNTRA</span>
        <span className="brand-divider">/</span>
        <span className="brand-product">ENERGY &amp; OVERTAKE INTELLIGENCE</span>
      </div>

      {/* 2. CENTER ZONE: Mode Selector + Session Context */}
      <div className="command-center-section">
        {/* Operating Mode Buttons (LIVE, FORECAST, REPLAY) */}
        <div className="command-mode-selector">
          {(['LIVE', 'FORECAST', 'REPLAY'] as OperatingMode[]).map((m) => {
            const isActive = canonicalMode === m;
            return (
              <button
                key={m}
                type="button"
                className={`mode-btn ${isActive ? 'active' : ''}`}
                onClick={() => onSelectOperatingMode(m)}
                title={`Switch to ${m} Mode`}
              >
                {m === 'LIVE' && isActive && <span className="mode-live-dot" />}
                <span>{m}</span>
              </button>
            );
          })}
        </div>

        {/* Session Telemetry Context */}
        <div className="session-context-group">
          {/* Circuit Switcher */}
          <div
            className="session-context-item session-event clickable"
            onClick={onOpenSessionSwitcher}
            title={`Active Circuit: ${circuitName} (${eventName}). Click to switch session.`}
          >
            <span className="ctx-label text-muted">CIRCUIT:</span>
            <span className="ctx-val font-bold text-primary">{circuitName}</span>
            <span className="ctx-sub text-muted">[{eventId}]</span>
            <span className="ctx-caret">&#9662;</span>
          </div>

          {/* Lap Counter */}
          <div className="session-context-item session-lap">
            <span className="ctx-label text-muted">LAP:</span>
            <span className="ctx-val font-bold mono-num text-primary">
              {currentLap != null ? (totalLaps ? `${currentLap}/${totalLaps}` : `${currentLap}`) : '—'}
            </span>
          </div>

          {/* FIA Track Status */}
          <div className={`session-context-item session-flag ${flagClass}`} title={`FIA Track Status: ${flagLabel}`}>
            <span className="flag-bullet" />
            <span className="ctx-val font-bold">{flagLabel}</span>
          </div>
        </div>
      </div>

      {/* 3. RIGHT ZONE: Connection Status, Latency, Data Freshness, System Health, Stream Indicator */}
      <div className="command-right-section">
        {/* Explicit Connection Status Badge */}
        <div
          className={`telemetry-compact-item item-conn-status conn-${connectionStatus.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
          title={`Active Connection State: ${connectionStatus}`}
        >
          <span className="conn-dot" />
          <span className="c-val font-bold">{connectionStatus}</span>
        </div>

        {/* Stale Alert or Latency */}
        {isStale ? (
          <div className="telemetry-compact-item item-stale-alert" title="Telemetry stream paused or delayed > 4s">
            <span className="c-val font-bold text-stale">DATA STALE</span>
          </div>
        ) : (
          <div className="telemetry-compact-item item-freshness" title="Telemetry round-trip latency & data age">
            <span className="c-lbl text-muted">LAT:</span>
            <span className="c-val mono-num font-bold text-secondary">
              {rawLatencyMs != null ? `${rawLatencyMs}ms` : dataAge ? `${dataAge}s` : '—'}
            </span>
          </div>
        )}

        {/* System Health Status */}
        <div
          className={`telemetry-compact-item item-health clickable health-status-${resolvedHealth.toLowerCase().replace(/[^a-z]/g, '-')}`}
          onClick={onOpenSystemInspector}
          title={`Platform Health: ${resolvedHealth}. Click for full module diagnostics.`}
        >
          <span className="health-dot" />
          <span className="c-val font-bold">{resolvedHealth}</span>
        </div>

        {/* Live Stream Transport Indicator */}
        <div
          className={`stream-badge font-bold ${transportType === 'WS_STREAM' ? 'stream-live' : 'stream-polling'} ${isStale ? 'stream-stale' : ''}`}
          title={transportType === 'WS_STREAM' ? 'Bidirectional WebSocket Streaming' : 'Polling REST Fallback Active'}
        >
          <span className="stream-dot" />
          <span>{transportType === 'WS_STREAM' ? 'WS STREAM' : 'HTTP POLL'}</span>
        </div>

        {/* Shortcuts Trigger */}
        <button
          type="button"
          className="utility-btn"
          onClick={onOpenShortcuts}
          title="Operational Keyboard Shortcuts [?]"
        >
          ?
        </button>
      </div>
    </header>
  );
};
