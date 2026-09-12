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

interface AppShellProps {
  currentContext: ContextWorkspace;
  onSelectContext: (ctx: ContextWorkspace) => void;
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  raceState: RaceState | null;
  isStreaming: boolean;
  evidenceTarget: EvidenceInspectionTarget | null;
  onCloseEvidence: () => void;
  onOpenSessionSwitcher: () => void;
  onOpenShortcuts: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentContext,
  onSelectContext,
  runtimeSnapshot,
  raceState,
  isStreaming,
  evidenceTarget,
  onCloseEvidence,
  onOpenSessionSwitcher,
  onOpenShortcuts,
  children,
}) => {
  const runtimeMode = runtimeSnapshot?.mode || raceState?.session.source_mode || 'LIVE_FEED';
  const sourceProvider =
    runtimeSnapshot?.provider_status?.['provider'] ||
    raceState?.session.provider ||
    'OPENF1';
  const systemHealth: SystemHealthStatus =
    runtimeSnapshot?.health.system_health || 'OPERATIONAL';

  return (
    <div className="kyntra-workstation-shell">
      {/* 1. Persistent Top Command Bar */}
      <TopCommandBar
        runtimeSnapshot={runtimeSnapshot}
        raceState={raceState}
        isStreaming={isStreaming}
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
