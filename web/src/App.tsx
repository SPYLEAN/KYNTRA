import { useEffect, useState, useCallback } from 'react';
import type {
  ContextWorkspace,
  EvidenceInspectionTarget,
  TrackGeometry,
} from './types';
import { AppShell } from './components/shell/AppShell';
import { RaceWorkspace } from './components/race/RaceWorkspace';
import { StrategyWorkspace } from './components/workspaces/StrategyWorkspace';
import { EventsWorkspace } from './components/workspaces/EventsWorkspace';
import { AnalysisWorkspace } from './components/workspaces/AnalysisWorkspace';
import { SystemWorkspace } from './components/workspaces/SystemWorkspace';
import { SessionSwitcher } from './components/SessionSwitcher';
import { KyntraApiClient } from './api/client';
import { useRuntimeStream } from './hooks/useRuntimeStream';

export default function App() {
  // Navigation & Workspace State: 5 Workspaces (RACE, STRATEGY, EVENTS, ANALYSIS, SYSTEM)
  const [currentContext, setCurrentContext] = useState<ContextWorkspace>('RACE');

  // Active event ID & Track Geometry
  const [activeEventId, setActiveEventId] = useState<string>('2026_13_ITA');
  const [trackGeometry, setTrackGeometry] = useState<TrackGeometry | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<any[]>([]);

  // Right-Side Universal Evidence Drawer Target
  const [evidenceTarget, setEvidenceTarget] = useState<EvidenceInspectionTarget | null>(null);

  // Session Switcher State
  const [sessionSwitcherOpen, setSessionSwitcherOpen] = useState<boolean>(false);
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(false);

  // Keyboard Shortcuts Modal
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // 1. CANONICAL RUNTIME STATE OWNER (Phase 02 Architecture)
  const {
    runtimeSnapshot,
    raceState,
    decision,
    watchlist,
    activeBattles,
    activeWindows,
    recentEvents,
    systemStatus,
    operatingMode,
    selectedBattleId,
    connectionStatus,
    transportType,
    isStale,
    latencyMs,
    selectBattle,
    setOperatingMode,
    sendCommand,
  } = useRuntimeStream(activeEventId);

  const eventId = runtimeSnapshot?.event_id || raceState?.session.event_id || activeEventId;

  // 2. Fetch Track Geometry when event changes
  useEffect(() => {
    let isMounted = true;
    KyntraApiClient.getTrackGeometry(eventId).then((geo) => {
      if (isMounted && geo) setTrackGeometry(geo);
    });
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // 3. Historical decision logs for Timeline
  useEffect(() => {
    let isMounted = true;
    KyntraApiClient.getRuntimeHistory(undefined, 20).then((hist) => {
      if (isMounted && hist) setDecisionHistory(hist);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Evidence Drawer handlers
  const handleOpenEvidence = useCallback((target: EvidenceInspectionTarget) => {
    setEvidenceTarget(target);
  }, []);

  const handleCloseEvidence = useCallback(() => {
    setEvidenceTarget(null);
  }, []);

  // Session Switcher handler
  const handleSelectEvent = useCallback(
    async (newEventId: string) => {
      setIsSessionLoading(true);
      setActiveEventId(newEventId);
      sendCommand({ action: 'set_event', event_id: newEventId });

      try {
        const geo = await KyntraApiClient.getTrackGeometry(newEventId);
        if (geo) setTrackGeometry(geo);
      } catch (err) {
        console.error('Session switch assets failed:', err);
      } finally {
        setIsSessionLoading(false);
        setSessionSwitcherOpen(false);
      }
    },
    [sendCommand]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        sendCommand({ action: 'pause' });
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        sendCommand({ action: 'step' });
      } else if (e.code === 'Escape') {
        if (evidenceTarget) {
          setEvidenceTarget(null);
        } else if (sessionSwitcherOpen) {
          setSessionSwitcherOpen(false);
        } else if (shortcutsOpen) {
          setShortcutsOpen(false);
        }
      } else if (e.key === '1') {
        setCurrentContext('RACE');
      } else if (e.key === '2') {
        setCurrentContext('STRATEGY');
      } else if (e.key === '3') {
        setCurrentContext('EVENTS');
      } else if (e.key === '4') {
        setCurrentContext('ANALYSIS');
      } else if (e.key === '5') {
        setCurrentContext('SYSTEM');
      } else if (e.key === 'e' || e.key === 'E') {
        if (evidenceTarget) {
          setEvidenceTarget(null);
        } else if (decision) {
          const pub = (decision as any).published_call;
          const rec = (decision as any).recommendation;
          setEvidenceTarget({
            title: `DECISION PROVENANCE: ${decision.decision_id || 'SNAPSHOT'}`,
            value: pub?.ui_call || rec?.ui_label || 'ACTIVE RECOMMENDATION',
            status: pub?.lifecycle_state === 'VALID' ? 'VALID' : 'CAUTION',
            provenance: 'FROZEN MODEL',
            method: '7-Point Atomic Final Publication Gate V1',
            version: 'overtake_p123_v1.lgb',
            timestamp: new Date().toISOString(),
            evidenceItems: [
              { label: 'Snapshot ID', value: decision.decision_id || 'N/A' },
              { label: 'Lap', value: String(decision.race?.lap || 1) },
              { label: 'Primary Basis', value: pub?.primary_reason || rec?.reason || 'Lexicographic Action Ranker' },
              { label: 'Robustness', value: pub?.robustness || (rec?.robust ? 'ROBUST' : 'SENSITIVE') || 'UNKNOWN' },
            ],
            reasonCodes: pub?.reason_codes || [],
            rawObject: decision as any,
          });
        }
      } else if (e.key === '?') {
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    evidenceTarget,
    sessionSwitcherOpen,
    shortcutsOpen,
    sendCommand,
    decision,
  ]);

  return (
    <AppShell
      currentContext={currentContext}
      onSelectContext={setCurrentContext}
      runtimeSnapshot={runtimeSnapshot}
      raceState={raceState}
      isStreaming={connectionStatus === 'CONNECTED'}
      connectionStatus={connectionStatus}
      isStale={isStale}
      transportType={transportType}
      latencyMs={latencyMs}
      operatingMode={operatingMode}
      onSelectOperatingMode={setOperatingMode}
      evidenceTarget={evidenceTarget}
      onCloseEvidence={handleCloseEvidence}
      onOpenSessionSwitcher={() => setSessionSwitcherOpen(true)}
      onOpenShortcuts={() => setShortcutsOpen(true)}
      onSendCommand={sendCommand}
    >
      {/* Dynamic Viewport Content */}
      {currentContext === 'RACE' ? (
        <RaceWorkspace
          runtimeSnapshot={runtimeSnapshot}
          decision={decision}
          cars={raceState?.cars || {}}
          geometry={trackGeometry}
          watchlist={watchlist}
          activeBattles={activeBattles}
          selectedBattleId={selectedBattleId}
          decisionHistory={decisionHistory}
          trackStatus={raceState?.track.track_status || '1'}
          circuitName={trackGeometry?.circuit_name || raceState?.session.event_name || 'Monza'}
          isStale={isStale}
          connectionStatus={connectionStatus}
          onSelectBattle={selectBattle}
          onSelectCar={(drv) => {
            const match = watchlist.find((w) => w.attacker === drv || w.defender === drv);
            if (match) selectBattle(match.battle_id);
          }}
          onOpenEvidence={handleOpenEvidence}
        />
      ) : currentContext === 'STRATEGY' ? (
        <StrategyWorkspace
          decision={decision}
          onOpenEvidence={handleOpenEvidence}
        />
      ) : currentContext === 'EVENTS' ? (
        <EventsWorkspace
          events={recentEvents}
          runtimeSnapshot={runtimeSnapshot}
          decision={decision}
          decisionHistory={decisionHistory}
          selectedBattleId={selectedBattleId}
          operatingMode={operatingMode}
          onJumpToLap={(lap) => sendCommand({ action: 'seek', lap })}
          onOpenEvidence={handleOpenEvidence}
        />
      ) : currentContext === 'ANALYSIS' ? (
        <AnalysisWorkspace
          decision={decision}
          selectedBattleId={selectedBattleId}
          watchlist={watchlist}
          onSelectBattle={selectBattle}
          currentWindow={selectedBattleId ? activeWindows[selectedBattleId] : null}
        />
      ) : (
        /* SYSTEM Workspace */
        <SystemWorkspace
          systemStatus={systemStatus}
          wsConnected={connectionStatus === 'CONNECTED'}
          totalEventsCount={recentEvents.length}
        />
      )}

      {/* Session Switcher Dialog */}
      <SessionSwitcher
        isOpen={sessionSwitcherOpen}
        onClose={() => setSessionSwitcherOpen(false)}
        currentEventId={eventId}
        onSelectEvent={handleSelectEvent}
        isLoading={isSessionLoading}
      />

      {/* Keyboard Shortcuts Dialog */}
      {shortcutsOpen && (
        <div className="modal-backdrop" onClick={() => setShortcutsOpen(false)}>
          <div className="modal-dialog shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-badge">OPERATIONAL COMMANDS</span>
                <h3>PIT-WALL KEYBOARD SHORTCUTS</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShortcutsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <table className="shortcuts-table mono">
                <tbody>
                  <tr>
                    <td><kbd>SPACE</kbd></td>
                    <td>Play / Pause sequential replay stream</td>
                  </tr>
                  <tr>
                    <td><kbd>&rarr;</kbd></td>
                    <td>Step replay forward 1 cycle</td>
                  </tr>
                  <tr>
                    <td><kbd>1</kbd></td>
                    <td>RACE Command Center Workspace</td>
                  </tr>
                  <tr>
                    <td><kbd>2</kbd></td>
                    <td>STRATEGY Verification Workspace</td>
                  </tr>
                  <tr>
                    <td><kbd>3</kbd></td>
                    <td>EVENTS Chronology &amp; Incident Log</td>
                  </tr>
                  <tr>
                    <td><kbd>4</kbd></td>
                    <td>ANALYSIS Model Calibration &amp; Features</td>
                  </tr>
                  <tr>
                    <td><kbd>5</kbd></td>
                    <td>SYSTEM &amp; Module Diagnostics</td>
                  </tr>
                  <tr>
                    <td><kbd>E</kbd></td>
                    <td>Toggle Universal Forensic Evidence Drawer</td>
                  </tr>
                  <tr>
                    <td><kbd>ESC</kbd></td>
                    <td>Close active Evidence Drawer or modal</td>
                  </tr>
                  <tr>
                    <td><kbd>?</kbd></td>
                    <td>Toggle operational keyboard shortcut reference</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
