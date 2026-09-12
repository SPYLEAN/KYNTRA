import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  ActiveBattleTracker,
  BattleWatchlistItem,
  ContextWorkspace,
  DecisionSnapshot,
  EvidenceInspectionTarget,
  KyntraRuntimeSnapshot,
  LiveUpdatePayload,
  RaceEvent,
  RaceState,
  SystemStatus,
  TrackGeometry,
  WindowState,
} from './types';
import { AppShell } from './components/shell/AppShell';
import { RaceWorkspace } from './components/race/RaceWorkspace';
import { StrategyWorkspace } from './components/workspaces/StrategyWorkspace';
import { EventsWorkspace } from './components/workspaces/EventsWorkspace';
import { AnalysisWorkspace } from './components/workspaces/AnalysisWorkspace';
import { SystemWorkspace } from './components/workspaces/SystemWorkspace';
import { SessionSwitcher } from './components/SessionSwitcher';
import { KyntraApiClient } from './api/client';
import type { OperatingMode } from './domain/types';

export default function App() {
  // Navigation & Workspace State: 5 Workspaces (RACE, STRATEGY, EVENTS, ANALYSIS, SYSTEM)
  const [currentContext, setCurrentContext] = useState<ContextWorkspace>('RACE');
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('LIVE');
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);

  // Right-Side Universal Evidence Drawer Target
  const [evidenceTarget, setEvidenceTarget] = useState<EvidenceInspectionTarget | null>(null);

  // Session Switcher State
  const [sessionSwitcherOpen, setSessionSwitcherOpen] = useState<boolean>(false);
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(false);

  // Keyboard Shortcuts Modal
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Operational State
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<KyntraRuntimeSnapshot | null>(null);
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [decision, setDecision] = useState<DecisionSnapshot | null>(null);
  const [watchlist, setWatchlist] = useState<BattleWatchlistItem[]>([]);
  const [activeBattles, setActiveBattles] = useState<ActiveBattleTracker[]>([]);
  const [activeWindows, setActiveWindows] = useState<Record<string, WindowState>>({});
  const [recentEvents, setRecentEvents] = useState<RaceEvent[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [trackGeometry, setTrackGeometry] = useState<TrackGeometry | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<any[]>([]);

  // Active event ID
  const [activeEventId, setActiveEventId] = useState<string>('2026_13_ITA');
  const eventId = runtimeSnapshot?.event_id || raceState?.session.event_id || activeEventId;

  // Transport Control State
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch Track Geometry when event changes
  useEffect(() => {
    let isMounted = true;
    KyntraApiClient.getTrackGeometry(eventId).then((geo) => {
      if (isMounted && geo) setTrackGeometry(geo);
    });

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // 2. Initial System Status & Events History
  useEffect(() => {
    let isMounted = true;
    KyntraApiClient.getSystemStatus().then((status) => {
      if (isMounted && status) setSystemStatus(status);
    });

    KyntraApiClient.getRecentEvents(50).then((evts) => {
      if (isMounted && evts) setRecentEvents(evts);
    });

    KyntraApiClient.getRuntimeHistory(undefined, 20).then((hist) => {
      if (isMounted && hist) setDecisionHistory(hist);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. WebSocket Streaming Ingress with Auto-Reconnect
  useEffect(() => {
    let ws: WebSocket;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data: LiveUpdatePayload = JSON.parse(event.data);
            if (data.race_state) setRaceState(data.race_state);
            if (data.decision) setDecision(data.decision);
            if (data.watchlist) {
              setWatchlist(data.watchlist);
              if (!selectedBattleId && data.watchlist.length > 0) {
                setSelectedBattleId(data.watchlist[0].battle_id);
              }
            }
            if (data.active_windows) setActiveWindows(data.active_windows);
            if (data.recent_events && data.recent_events.length > 0) {
              setRecentEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.event_id));
                const newItems = data.recent_events.filter((e) => !existingIds.has(e.event_id));
                return [...newItems, ...prev].slice(0, 100);
              });
            }
          } catch (e) {
            console.error('Error parsing live update:', e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        console.warn('WebSocket connection attempt failed:', err);
        setWsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [selectedBattleId]);

  // 4. Canonical Runtime Orchestrator Polling (/api/runtime)
  // Ensures full Strategy Matrix, Ranking, Published Call, and Health are continuously fresh
  useEffect(() => {
    const fetchRuntime = async () => {
      const snap = await KyntraApiClient.getRuntimeSnapshot();
      if (snap) {
        setRuntimeSnapshot(snap);
        // Contradiction A1: align operatingMode if backend is HISTORICAL_REPLAY
        if (snap.mode === 'HISTORICAL_REPLAY' && operatingMode === 'LIVE') {
          setOperatingMode('REPLAY');
        } else if (snap.mode === 'LIVE_FEED' && operatingMode === 'REPLAY') {
          setOperatingMode('LIVE');
        }
        if (snap.active_battles && snap.active_battles.length > 0) {
          setActiveBattles(snap.active_battles);
          if (!selectedBattleId) {
            setSelectedBattleId(snap.selected_battle_id || snap.active_battles[0].battle_id);
          }
        }
      }
    };

    fetchRuntime();
    const interval = setInterval(fetchRuntime, 1000);
    return () => clearInterval(interval);
  }, [selectedBattleId, operatingMode]);

  // Fallback REST polling if WebSocket is offline
  useEffect(() => {
    if (wsConnected) return;

    const pollInterval = setInterval(async () => {
      try {
        const [stateRes, decRes] = await Promise.all([
          fetch('/api/live/state'),
          fetch('/api/live/decision'),
        ]);

        if (stateRes.ok) {
          const stateData: RaceState = await stateRes.json();
          setRaceState(stateData);
        }
        if (decRes.ok) {
          const decData: DecisionSnapshot = await decRes.json();
          setDecision(decData);
        }
      } catch (err) {
        console.warn('REST fallback poll failed:', err);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [wsConnected]);

  // Control Actions (WebSocket / REST)
  const sendControl = useCallback(
    (payload: Record<string, any>) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      } else {
        KyntraApiClient.sendRuntimeControl(payload as any).catch((err) =>
          console.error('Control command failed:', err)
        );
      }
    },
    []
  );

  const handleSelectBattle = useCallback(
    (battleId: string) => {
      setSelectedBattleId(battleId);
      sendControl({ action: 'select_battle', battle_id: battleId });
    },
    [sendControl]
  );

  const handleOpenEvidence = useCallback(
    (target: EvidenceInspectionTarget) => {
      setEvidenceTarget(target);
    },
    []
  );

  const handleCloseEvidence = useCallback(() => {
    setEvidenceTarget(null);
  }, []);

  const handleSelectEvent = useCallback(
    async (newEventId: string) => {
      setIsSessionLoading(true);
      setActiveEventId(newEventId);
      setSelectedBattleId(null);
      sendControl({ action: 'set_event', event_id: newEventId });

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
    [sendControl]
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
        sendControl({ action: 'pause' });
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        sendControl({ action: 'step' });
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
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    evidenceTarget,
    sessionSwitcherOpen,
    shortcutsOpen,
    sendControl,
  ]);

  return (
    <AppShell
      currentContext={currentContext}
      onSelectContext={setCurrentContext}
      runtimeSnapshot={runtimeSnapshot}
      raceState={raceState}
      isStreaming={wsConnected}
      operatingMode={operatingMode}
      onSelectOperatingMode={setOperatingMode}
      evidenceTarget={evidenceTarget}
      onCloseEvidence={handleCloseEvidence}
      onOpenSessionSwitcher={() => setSessionSwitcherOpen(true)}
      onOpenShortcuts={() => setShortcutsOpen(true)}
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
          onSelectBattle={handleSelectBattle}
          onSelectCar={(drv) => {
            const match = watchlist.find((w) => w.attacker === drv || w.defender === drv);
            if (match) handleSelectBattle(match.battle_id);
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
          onJumpToLap={(lap) => sendControl({ action: 'seek', lap })}
        />
      ) : currentContext === 'ANALYSIS' ? (
        <AnalysisWorkspace
          decision={decision}
          selectedBattleId={selectedBattleId}
          watchlist={watchlist}
          onSelectBattle={handleSelectBattle}
          currentWindow={selectedBattleId ? activeWindows[selectedBattleId] : null}
        />
      ) : (
        /* SYSTEM Workspace */
        <SystemWorkspace
          systemStatus={systemStatus}
          wsConnected={wsConnected}
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
