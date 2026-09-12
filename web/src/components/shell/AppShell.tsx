import React from 'react';
import type {
  ContextWorkspace,
  EvidenceInspectionTarget,
  KyntraRuntimeSnapshot,
  RaceState,
  SystemHealthStatus,
} from '../../types';
import { NavigationRail } from './NavigationRail';
import { TopCommandBar } from './TopCommandBar';
import { EvidenceDrawer } from '../evidence/EvidenceDrawer';
import { ReplayControlBar } from '../common/ReplayControlBar';

import type { OperatingMode } from '../../domain/types';

import type { StreamConnectionStatus } from '../../hooks/useRuntimeStream';

interface AppShellProps {
  currentContext: ContextWorkspace;
  onSelectContext: (ctx: ContextWorkspace) => void;
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  raceState: RaceState | null;
  isStreaming: boolean;
  connectionStatus?: StreamConnectionStatus;
  isStale?: boolean;
  transportType?: 'WS_STREAM' | 'HTTP_POLL';
  latencyMs?: number | null;
  operatingMode: OperatingMode;
  onSelectOperatingMode: (mode: OperatingMode) => void;
  evidenceTarget: EvidenceInspectionTarget | null;
  onCloseEvidence: () => void;
  onOpenSessionSwitcher: () => void;
  onOpenShortcuts: () => void;
  onSendCommand?: (payload: any) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentContext,
  onSelectContext,
  runtimeSnapshot,
  raceState,
  isStreaming,
  connectionStatus,
  isStale,
  transportType,
  latencyMs,
  operatingMode,
  onSelectOperatingMode,
  evidenceTarget,
  onCloseEvidence,
  onOpenSessionSwitcher,
  onOpenShortcuts,
  onSendCommand,
  children,
}) => {
  const runtimeMode = runtimeSnapshot?.mode || (operatingMode === 'REPLAY' ? 'HISTORICAL_REPLAY' : 'LIVE_FEED');

  const sourceProvider =
    runtimeSnapshot?.provider_status?.['provider'] ||
    raceState?.session.provider ||
    'OPENF1';
  const systemHealth: SystemHealthStatus =
    runtimeSnapshot?.health.system_health || 'OPERATIONAL';

  const currentLap = runtimeSnapshot?.current_lap ?? raceState?.session.current_lap ?? 15;
  const totalLaps = raceState?.session.total_laps ?? 53;

  return (
    <div className="kyntra-workstation-shell">
      {/* 1. Persistent Top Command Bar */}
      <TopCommandBar
        runtimeSnapshot={runtimeSnapshot}
        raceState={raceState}
        isStreaming={isStreaming}
        connectionStatus={connectionStatus}
        isStale={isStale}
        transportType={transportType}
        latencyMs={latencyMs}
        operatingMode={operatingMode}
        onSelectOperatingMode={onSelectOperatingMode}
        onOpenSessionSwitcher={onOpenSessionSwitcher}
        onOpenShortcuts={onOpenShortcuts}
        onOpenSystemInspector={() => onSelectContext('SYSTEM')}
      />

      {/* 2. Main Workstation Body (Left Rail + Central Viewport + Right Evidence Drawer) */}
      <div className="workstation-body-container">
        {/* Left Navigation Rail */}
        <NavigationRail
          currentContext={currentContext}
          onSelectContext={onSelectContext}
          runtimeMode={runtimeMode}
          sourceProvider={sourceProvider}
          systemHealth={systemHealth}
          onOpenSystemModal={() => onSelectContext('SYSTEM')}
        />

        {/* Dynamic Workspace Viewport */}
        <main className="workstation-primary-viewport" id="primary-viewport">
          {children}

          {/* Replay Operating Mode HUD Scrubber (Visible in any workspace when REPLAY is selected) */}
          {operatingMode === 'REPLAY' && (
            <ReplayControlBar
              currentLap={currentLap}
              totalLaps={totalLaps}
              sessionTime={(raceState?.session as any)?.elapsed_time ?? (currentLap * 82.5)}
              isPaused={false}
              playbackSpeed={1.0}
              eventId={runtimeSnapshot?.event_id || raceState?.session.event_id || '2026_13_ITA'}
              sourceMode="HISTORICAL_REPLAY"
              onPlayPause={() => onSendCommand && onSendCommand({ action: 'pause' })}
              onStepForward={() => onSendCommand && onSendCommand({ action: 'step' })}
              onStepBack={() => onSendCommand && onSendCommand({ action: 'seek', lap: Math.max(1, currentLap - 1) })}
              onSeekLap={(lap) => onSendCommand && onSendCommand({ action: 'seek', lap })}
              onSpeedChange={(speed) => onSendCommand && onSendCommand({ action: 'speed', speed })}
            />
          )}
        </main>

        {/* Right-Side Universal Evidence Drawer */}
        {evidenceTarget && (
          <EvidenceDrawer
            target={evidenceTarget}
            onClose={onCloseEvidence}
          />
        )}
      </div>
    </div>
  );
};
