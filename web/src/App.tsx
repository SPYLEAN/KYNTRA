import { useEffect, useState, useCallback } from 'react';
import type {
  DecisionSnapshot,
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
import { JUDGE_STEPS, JudgeModeTour } from './components/common/JudgeModeTour';
import { StructuredCopilot } from './components/common/StructuredCopilot';
import { sameBattle } from './domain/presentation';
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

  // Judge Mode & Structured Copilot State
  const [judgeModeActive, setJudgeModeActive] = useState<boolean>(false);
  const [judgeStepIndex, setJudgeStepIndex] = useState<number>(0);
  const [copilotActive, setCopilotActive] = useState<boolean>(false);

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

  const [observedHistory, setObservedHistory] = useState<DecisionSnapshot[]>([]);
  useEffect(() => {
    if (!decision || !decision.decision_id || operatingMode === 'LIVE' && runtimeSnapshot?.mode !== 'LIVE_FEED') return;
    setObservedHistory(prev => {
      const latest = prev[0];
      const reset = !sameBattle(decision, latest) || (latest?.race.lap != null && decision.race.lap != null && decision.race.lap < latest.race.lap) || (decision.race.replay_time != null && latest?.race.replay_time != null && decision.race.replay_time < latest.race.replay_time);
      if (reset) return [decision];
      if (latest?.decision_id === decision.decision_id) return prev;
      return [decision, ...prev].slice(0, 60);
    });
  }, [decision, operatingMode, runtimeSnapshot?.mode]);
  const previousDecision = observedHistory.find(d => d.decision_id !== decision?.decision_id && sameBattle(d, decision)) || null;
  const judgeFocus = judgeModeActive ? JUDGE_STEPS[judgeStepIndex]?.targetHighlight : undefined;
  const liveDisconnected = operatingMode === 'LIVE' && (runtimeSnapshot?.mode !== 'LIVE_FEED' || raceState?.session.source_mode !== 'LIVE_FEED' || decision?.provenance.source_mode !== 'LIVE_FEED' || runtimeSnapshot?.provider_status?.details?.status === 'LIVE_PROVIDER_NOT_CONNECTED');
  const eventId = runtimeSnapshot?.event_id || raceState?.session.event_id || activeEventId;

  // 2. Fetch Track Geometry when event changes
  useEffect(() => {
    let isMounted = true;
    setTrackGeometry(null);
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
    const refresh = () => KyntraApiClient.getRuntimeHistory(undefined, 60).then(hist => { if (isMounted) setDecisionHistory(hist); });
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [eventId]);

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
      setSessionSwitcherOpen(false);
      setIsSessionLoading(true);
      setActiveEventId(newEventId);
      try {
        const [_, geo] = await Promise.all([
          KyntraApiClient.sendRuntimeControl({ action: 'set_event', event_id: newEventId }),
          KyntraApiClient.getTrackGeometry(newEventId),
        ]);
        if (geo) setTrackGeometry(geo);
      } catch (err) {
        console.error('Session switch assets failed:', err);
      } finally {
        setIsSessionLoading(false);
      }
    },
    []
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable || (e.key !== 'Escape' && Boolean(target.closest('button, select, summary, [role="button"]'))))
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (operatingMode === 'REPLAY') sendCommand({ action: runtimeSnapshot?.is_paused ? 'resume' : 'pause' });
      } else if (e.code === 'ArrowRight' && !judgeModeActive && operatingMode === 'REPLAY') {
        e.preventDefault();
        sendCommand({ action: 'step' });
      } else if (e.code === 'Escape') {
        if (copilotActive) {
          setCopilotActive(false);
        } else if (judgeModeActive) {
          setJudgeModeActive(false);
        } else if (evidenceTarget) {
          setEvidenceTarget(null);
        } else if (sessionSwitcherOpen) {
          setSessionSwitcherOpen(false);
        } else if (shortcutsOpen) {
          setShortcutsOpen(false);
        }
      } else if (e.key === 'c' || e.key === 'C') {
        setCopilotActive((prev) => !prev);
      } else if (e.key === 'j' || e.key === 'J') {
        setJudgeModeActive((prev) => !prev);
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
            timestamp: decision.decision_time || undefined,
            evidenceItems: [
              { label: 'Snapshot ID', value: decision.decision_id || 'N/A' },
              { label: 'Lap', value: String(decision.race?.lap ?? 'UNKNOWN') },
              { label: 'Primary Basis', value: pub?.primary_reason || rec?.reason || 'Lexicographic Action Ranker' },
              { label: 'Robustness', value: pub?.robustness || (rec?.robust === true ? 'ROBUST' : rec?.robust === false ? 'SENSITIVE' : 'UNKNOWN') },
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
    copilotActive,
    judgeModeActive,
    sendCommand,
    decision,
    operatingMode,
    runtimeSnapshot?.is_paused,
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
      judgeModeActive={judgeModeActive}
      onToggleJudgeMode={() => setJudgeModeActive((prev) => !prev)}
      copilotActive={copilotActive}
      onToggleCopilot={() => setCopilotActive((prev) => !prev)}
      onSendCommand={sendCommand}
    >
      {/* 10-Step Guided Judge Mode Tour - Docked at the top of the workstation viewport */}
      <JudgeModeTour
        isActive={judgeModeActive}
        currentStepIndex={judgeStepIndex}
        onStepChange={setJudgeStepIndex}
        onClose={() => setJudgeModeActive(false)}
        onNavigateWorkspace={setCurrentContext}
      />

      {operatingMode === 'FORECAST' && <div className="astra-mode-notice"><b>FORECAST</b> Comparing futures from the retained observed DecisionSnapshot · no future telemetry generated</div>}
      {/* Dynamic Viewport Content */}
      {liveDisconnected ? <div className="astra-empty astra-live-disconnected"><span className="astra-eyebrow">LIVE / PROVIDER STATUS</span><h1>LIVE PROVIDER NOT CONNECTED</h1><p>Connect an authorized live provider to receive current race state.</p><p>Historical replay is available from the mode selector.</p></div> : currentContext === 'RACE' ? (
        <RaceWorkspace
          runtimeSnapshot={runtimeSnapshot}
          decision={decision}
          cars={raceState?.cars || {}}
          geometry={trackGeometry?.event_id === raceState?.session.event_id ? trackGeometry : null}
          watchlist={watchlist}
          activeBattles={activeBattles}
          selectedBattleId={selectedBattleId}
          decisionHistory={observedHistory}
          trackStatus={raceState?.track.track_status || 'UNKNOWN'}
          circuitName={trackGeometry?.circuit_name || raceState?.session.event_name || 'Awaiting session'}
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
          observedHistory={observedHistory}
          selectedBattleId={selectedBattleId}
          operatingMode={operatingMode}
          onJumpToLap={(lap) => sendCommand({ action: 'seek', lap })}
          onOpenEvidence={handleOpenEvidence}
        />
      ) : currentContext === 'ANALYSIS' ? (
        <AnalysisWorkspace
          previousDecision={previousDecision}
          judgeFocus={judgeFocus}
          decision={decision}
          selectedBattleId={selectedBattleId}
          watchlist={watchlist}
          onSelectBattle={selectBattle}
          currentWindow={selectedBattleId ? activeWindows[selectedBattleId] : null}
          onOpenEvidence={handleOpenEvidence}
          decisionHistory={decisionHistory}
        />
      ) : (
        /* SYSTEM Workspace */
        <SystemWorkspace
          systemStatus={systemStatus}
          wsConnected={connectionStatus === 'CONNECTED'}
          totalEventsCount={recentEvents.length}
          onOpenEvidence={handleOpenEvidence}
          operatingMode={operatingMode}
          transportType={transportType}
          latencyMs={latencyMs}
          connectionStatus={connectionStatus}
          runtimeSnapshot={runtimeSnapshot}
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
                    <td><kbd>C</kbd></td>
                    <td>Toggle Structured KYNTRA Copilot command HUD</td>
                  </tr>
                  <tr>
                    <td><kbd>J</kbd></td>
                    <td>Toggle Judge Mode (10-Step Guided Product Tour)</td>
                  </tr>
                  <tr>
                    <td><kbd>E</kbd></td>
                    <td>Toggle Universal Forensic Evidence Drawer</td>
                  </tr>
                  <tr>
                    <td><kbd>ESC</kbd></td>
                    <td>Close active Evidence Drawer, Copilot, or modal</td>
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

      {/* Structured KYNTRA Copilot */}
      <StructuredCopilot
        previousDecision={previousDecision}
        operatingMode={operatingMode}
        isOpen={copilotActive}
        onClose={() => setCopilotActive(false)}
        decision={decision}
        onOpenEvidence={handleOpenEvidence}
        onNavigateWorkspace={setCurrentContext}
        onSendCommand={sendCommand}
      />
    </AppShell>
  );
}
