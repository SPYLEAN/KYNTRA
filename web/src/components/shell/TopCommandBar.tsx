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
  judgeModeActive?: boolean;
  onToggleJudgeMode?: () => void;
  copilotActive?: boolean;
  onToggleCopilot?: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = (props) => {
  const { runtimeSnapshot: snap, raceState: race, operatingMode: mode, onSelectOperatingMode, onOpenSessionSwitcher, onOpenSystemInspector, onOpenShortcuts, onToggleJudgeMode, onToggleCopilot, judgeModeActive, copilotActive, connectionStatus, isStale } = props;
  const disconnected = mode === 'LIVE' && (snap?.mode !== 'LIVE_FEED' || race?.session.source_mode !== 'LIVE_FEED' || snap?.provider_status?.details?.status === 'LIVE_PROVIDER_NOT_CONNECTED');
  const rawHealth: SystemHealthStatus = snap?.health?.system_health || 'OFFLINE';
  const health = isStale || connectionStatus === 'OFFLINE' ? 'OFFLINE' : resolveSystemHealthDisplay(rawHealth, snap?.health?.modules);
  const track = disconnected ? null : snap?.race_control?.track_status || race?.track.track_status;
  const flag = ({ '1': 'GREEN', '2': 'YELLOW', '4': 'SAFETY CAR', '5': 'RED FLAG', '6': 'VSC', '7': 'VSC ENDING' } as Record<string,string>)[track || ''] || 'UNKNOWN';
  const circuit = disconnected ? 'Awaiting live session' : race?.session.circuit || snap?.provider_status?.details?.circuit || 'Select session';
  return <header className="astra-command-bar">
    <div className="astra-brand"><strong>KYNTRA<span> / </span></strong><small>PREDICTIVE RACECRAFT<br/>INTELLIGENCE</small></div>
    <div className="astra-modes" aria-label="Operating mode">{(['LIVE','FORECAST','REPLAY'] as OperatingMode[]).map(m => <button key={m} aria-pressed={mode === m} className={mode === m ? 'active' : ''} onClick={() => onSelectOperatingMode(m)}>{m}</button>)}</div>
    <button className="astra-session-button" onClick={onOpenSessionSwitcher} title={circuit}><span>{circuit}</span><b>⌄</b></button>
    <span className="astra-lap">LAP <strong>{disconnected ? '—' : snap?.current_lap ?? race?.session.current_lap ?? '—'}</strong><small> / {disconnected ? '—' : race?.session.total_laps ?? snap?.provider_status?.details?.total_laps ?? '—'}</small></span>
    <span className={`astra-flag ${flag === 'GREEN' ? 'clear' : ''}`}>{flag}</span>
    <button className={`astra-health ${health === 'OPERATIONAL' ? 'clear' : ''}`} onClick={onOpenSystemInspector} title={disconnected ? 'LIVE PROVIDER NOT CONNECTED' : health}>{disconnected ? 'LIVE DISCONNECTED' : health === 'DEGRADED — NON-BLOCKING' ? 'DEGRADED' : health}</button>
    <div className="astra-command-actions"><button aria-pressed={judgeModeActive} onClick={onToggleJudgeMode}>Judge Mode</button><button aria-pressed={copilotActive} onClick={onToggleCopilot}>Copilot ↗</button><button aria-label="Keyboard shortcuts" onClick={onOpenShortcuts}>?</button></div>
  </header>;
};
