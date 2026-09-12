import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  BattleWatchlistItem,
  DecisionSnapshot,
  InspectorTarget,
  LiveUpdatePayload,
  RaceEvent,
  RaceState,
  SystemStatus,
  TimelineMarker,
  TrackGeometry,
  WindowState,
  OperatingMode,
  ContextWorkspace,
  LayoutPreset,
} from './types';
import { Header } from './components/Header';
import { TimelineScrubber } from './components/TimelineScrubber';
import { ContextInspector } from './components/ContextInspector';
import { SessionSwitcher } from './components/SessionSwitcher';
import { LiveWorkspace } from './components/workspaces/LiveWorkspace';
import { AnalysisWorkspace } from './components/workspaces/AnalysisWorkspace';
import { DemoWorkspace } from './components/workspaces/DemoWorkspace';
import { ReplayWorkspace } from './components/workspaces/ReplayWorkspace';
import { ForecastWorkspace } from './components/workspaces/ForecastWorkspace';
import { BattleWorkspace } from './components/workspaces/BattleWorkspace';
import { StrategyWorkspace } from './components/workspaces/StrategyWorkspace';
import { EventsWorkspace } from './components/workspaces/EventsWorkspace';
import { SystemWorkspace } from './components/workspaces/SystemWorkspace';

export default function App() {
  // Navigation & Workspace State: 3 Operating Modes + Contextual Workspaces + 3 Layout Presets
  const [currentMode, setCurrentMode] = useState<OperatingMode>('LIVE');
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('PIT_WALL');
  const [currentContext, setCurrentContext] = useState<ContextWorkspace>('RACE');
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);

  // Right-Side Unified Context Inspector State
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget | null>(null);

  // Session Switcher State
  const [sessionSwitcherOpen, setSessionSwitcherOpen] = useState<boolean>(false);
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(false);

  // Keyboard Shortcuts Modal
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Timeline Markers State
  const [timelineMarkers, setTimelineMarkers] = useState<TimelineMarker[]>([]);

  // Live Intelligence Data State
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [decision, setDecision] = useState<DecisionSnapshot | null>(null);
  const [watchlist, setWatchlist] = useState<BattleWatchlistItem[]>([]);
  const [activeWindows, setActiveWindows] = useState<Record<string, WindowState>>({});
  const [recentEvents, setRecentEvents] = useState<RaceEvent[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [trackGeometry, setTrackGeometry] = useState<TrackGeometry | null>(null);

  // Active event ID
  const [activeEventId, setActiveEventId] = useState<string>('2026_13_ITA');
  const eventId = raceState?.session.event_id || activeEventId;

  // Transport Control State
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch Track Geometry when event changes
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/track/${eventId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TrackGeometry) => {
        if (isMounted) setTrackGeometry(data);
      })
      .catch((err) => console.warn('Failed to load track geometry:', err));

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // 2. Fetch System Status
  useEffect(() => {
    let isMounted = true;
    fetch('/api/system/status')
      .then((res) => res.json())
      .then((data: SystemStatus) => {
        if (isMounted) setSystemStatus(data);
      })
      .catch((err) => console.warn('Failed to load system status:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Initial Events History & Timeline Markers
  useEffect(() => {
    let isMounted = true;
    fetch('/api/events/history?limit=100')
      .then((res) => res.json())
      .then((data: RaceEvent[]) => {
        if (isMounted) setRecentEvents(data);
      })
      .catch((err) => console.warn('Failed to load events history:', err));

    fetch(`/api/events/markers?race_id=${eventId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TimelineMarker[]) => {
        if (isMounted) setTimelineMarkers(data);
      })
      .catch((err) => console.warn('Failed to load markers:', err));

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // 4. WebSocket Streaming Ingress with Auto-Reconnect
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
              // Default to top priority battle if none selected
              if (!selectedBattleId && data.watchlist.length > 0) {
                setSelectedBattleId(data.watchlist[0].battle_id);
              }
            }
            if (data.active_windows) setActiveWindows(data.active_windows);
            if (data.recent_events && data.recent_events.length > 0) {
              setRecentEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.event_id));
                const newItems = data.recent_events.filter((e) => !existingIds.has(e.event_id));
                return [...newItems, ...prev].slice(0, 200);
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

  // Fallback REST polling if WebSocket is unavailable
  useEffect(() => {
    if (wsConnected) return;

    const pollInterval = setInterval(async () => {
      try {
        const [stateRes, decRes, battlesRes] = await Promise.all([
          fetch('/api/live/state'),
          fetch('/api/live/decision'),
          fetch('/api/live/battles'),
        ]);

        if (stateRes.ok) {
          const stateData: RaceState = await stateRes.json();
          setRaceState(stateData);
        }
        if (decRes.ok) {
          const decData: DecisionSnapshot = await decRes.json();
          setDecision(decData);
        }
        if (battlesRes.ok) {
          const battlesData = await battlesRes.json();
          if (Array.isArray(battlesData)) {
            const items: BattleWatchlistItem[] = battlesData.map((b: any) => ({
              battle_id: b.battle_id,
              attacker: b.attacker,
              defender: b.defender,
              attacker_position: b.attacker_position,
              defender_position: b.defender_position,
              gap_seconds: b.gap_seconds,
              gap_trend: 'STABLE',
              closing_state: 'STABLE',
              window_state: 'UNKNOWN',
              model_available: true,
              compliance_status: 'LEGAL',
              priority_state: 'ACTIVE',
            }));
            setWatchlist(items);
            if (!selectedBattleId && items.length > 0) {
              setSelectedBattleId(items[0].battle_id);
            }
          }
        }
      } catch (err) {
        console.warn('REST fallback poll failed:', err);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [wsConnected, selectedBattleId]);

  // Send control action via WebSocket or fallback REST
  const sendControl = useCallback(
    (payload: Record<string, any>) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      } else {
        fetch('/api/replay/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch((err) => console.error('Control command failed:', err));
      }
    },
    []
  );

  // Playback Control Handlers
  const handlePlayPause = useCallback(() => {
    setIsPaused((prev) => {
      const nextState = !prev;
      sendControl({ action: nextState ? 'pause' : 'resume' });
      return nextState;
    });
  }, [sendControl]);

  const handleSeekLap = useCallback(
    (lap: number) => {
      sendControl({ action: 'seek', lap });
    },
    [sendControl]
  );

  const handleSpeedChange = useCallback(
    (speed: number) => {
      setPlaybackSpeed(speed);
      sendControl({ action: 'speed', speed });
    },
    [sendControl]
  );

  const handleStep = useCallback(() => {
    sendControl({ action: 'step' });
  }, [sendControl]);

  const handleSelectBattle = useCallback(
    (battleId: string) => {
      setSelectedBattleId(battleId);
      sendControl({ action: 'select_battle', battle_id: battleId });
    },
    [sendControl]
  );

  const handleCloseInspector = useCallback(() => {
    setInspectorTarget(null);
  }, []);

  const handleOpenBattleWorkspace = useCallback(
    (battleId: string) => {
      handleSelectBattle(battleId);
      setCurrentContext('BATTLE');
    },
    [handleSelectBattle]
  );

  const handleSelectCar = useCallback(
    (driver: string) => {
      const match = watchlist.find((w) => w.attacker === driver || w.defender === driver);
      if (match) {
        handleSelectBattle(match.battle_id);
      } else {
        setInspectorTarget({ type: 'CAR', carDriver: driver });
      }
    },
    [watchlist, handleSelectBattle]
  );

  // Context Inspector Opener
  const handleOpenInspector = useCallback(
    (type: InspectorTarget['type'], payload?: any) => {
      setInspectorTarget({
        type,
        carDriver: payload?.driver,
        battleId: payload?.battleId || selectedBattleId || undefined,
        eventItem: payload?.event,
      });
    },
    [selectedBattleId]
  );

  // Event / Session Switch Handler
  const handleSelectEvent = useCallback(
    async (newEventId: string) => {
      setIsSessionLoading(true);
      setActiveEventId(newEventId);
      setSelectedBattleId(null);
      sendControl({ action: 'set_event', event_id: newEventId });

      try {
        const [geoRes, markRes] = await Promise.all([
          fetch(`/api/track/${newEventId}`),
          fetch(`/api/events/markers?race_id=${newEventId}`),
        ]);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          setTrackGeometry(geoData);
        }
        if (markRes.ok) {
          const markData = await markRes.json();
          setTimelineMarkers(markData);
        }
      } catch (err) {
        console.error('Session switch assets failed:', err);
      } finally {
        setIsSessionLoading(false);
        setSessionSwitcherOpen(false);
      }
    },
    [sendControl]
  );

  // Global Keyboard Operations Listener
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
        handlePlayPause();
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStep();
      } else if (e.code === 'Escape') {
        if (inspectorTarget) {
          setInspectorTarget(null);
        } else if (sessionSwitcherOpen) {
          setSessionSwitcherOpen(false);
        } else if (shortcutsOpen) {
          setShortcutsOpen(false);
        }
      } else if (e.key === '1') {
        setCurrentMode('LIVE');
        setCurrentContext('RACE');
      } else if (e.key === '2') {
        setCurrentMode('REPLAY');
        setCurrentContext('RACE');
      } else if (e.key === '3') {
        setCurrentMode('FORECAST');
        setCurrentContext('RACE');
      } else if (e.key === '4') {
        setCurrentContext('BATTLE');
      } else if (e.key === '5') {
        setCurrentContext('STRATEGY');
      } else if (e.key === '6') {
        setCurrentContext('EVENTS');
      } else if (e.key === '7') {
        setCurrentContext('SYSTEM');
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePlayPause,
    handleStep,
    inspectorTarget,
    sessionSwitcherOpen,
    shortcutsOpen,
  ]);

  return (
    <div className="app-pitwall-shell">
      {/* 1. Official Header Bar */}
      <Header
        currentMode={currentMode}
        onSelectMode={(mode) => {
          setCurrentMode(mode);
          setCurrentContext('RACE');
        }}
        layoutPreset={layoutPreset}
        onSelectLayoutPreset={(preset) => setLayoutPreset(preset)}
        currentContext={currentContext}
        onSelectContext={(ctx) => setCurrentContext(ctx)}
        raceState={raceState}
        wsConnected={wsConnected}
        onOpenSessionSwitcher={() => setSessionSwitcherOpen(true)}
        onOpenInspector={(type) => handleOpenInspector(type)}
        onOpenSystem={() => setCurrentContext('SYSTEM')}
        onToggleShortcuts={() => setShortcutsOpen((prev) => !prev)}
      />

      {/* 2. Primary Workstation Viewport with In-Place Rail Context Inspector */}
      <div className="workstation-viewport-wrapper">
        <main className="workspace-main-viewport">
          {currentContext === 'SYSTEM' ? (
            <SystemWorkspace
              systemStatus={systemStatus}
              wsConnected={wsConnected}
              totalEventsCount={recentEvents.length}
            />
          ) : currentContext === 'BATTLE' ? (
            <BattleWorkspace
              geometry={trackGeometry}
              cars={raceState?.cars || {}}
              decision={decision}
              watchlist={watchlist}
              activeWindows={activeWindows}
              selectedBattleId={selectedBattleId}
              recentEvents={recentEvents}
              trackStatus={raceState?.track.track_status || '1'}
              circuitName={trackGeometry?.circuit_name || 'Autodromo Nazionale Monza'}
              onSelectBattle={handleSelectBattle}
              onSelectCar={handleSelectCar}
              onJumpToLap={handleSeekLap}
              onOpenModelModal={() => handleOpenInspector('MODEL')}
            />
          ) : currentContext === 'STRATEGY' ? (
            <StrategyWorkspace
              decision={decision}
              onOpenModelModal={() => handleOpenInspector('MODEL')}
              onOpenEnergyModal={() => handleOpenInspector('ENERGY')}
            />
          ) : currentContext === 'EVENTS' ? (
            <EventsWorkspace
              events={recentEvents}
              onJumpToLap={handleSeekLap}
            />
          ) : currentMode === 'REPLAY' ? (
            <ReplayWorkspace
              geometry={trackGeometry}
              cars={raceState?.cars || {}}
              decision={decision}
              watchlist={watchlist}
              activeWindows={activeWindows}
              selectedBattleId={selectedBattleId}
              recentEvents={recentEvents}
              timelineMarkers={timelineMarkers}
              trackStatus={raceState?.track.track_status || '1'}
              circuitName={trackGeometry?.circuit_name || raceState?.session.event_name || '—'}
              currentLap={raceState?.session.current_lap ?? 0}
              totalLaps={raceState?.session.total_laps ?? 0}
              inspectorTarget={inspectorTarget}
              onSelectBattle={handleSelectBattle}
              onSelectCar={handleSelectCar}
              onJumpToLap={handleSeekLap}
              onOpenInspector={handleOpenInspector}
              onCloseInspector={handleCloseInspector}
              onOpenBattleWorkspace={handleOpenBattleWorkspace}
            />
          ) : currentMode === 'FORECAST' ? (
            <ForecastWorkspace
              decision={decision}
              watchlist={watchlist}
              currentLap={raceState?.session.current_lap ?? 0}
              circuitName={trackGeometry?.circuit_name || raceState?.session.event_name || '—'}
              eventId={eventId}
              onSelectBattle={handleSelectBattle}
            />
          ) : layoutPreset === 'ANALYSIS' ? (
            <AnalysisWorkspace
              geometry={trackGeometry}
              cars={raceState?.cars || {}}
              decision={decision}
              watchlist={watchlist}
              activeWindows={activeWindows}
              selectedBattleId={selectedBattleId}
              recentEvents={recentEvents}
              trackStatus={raceState?.track.track_status || '1'}
              circuitName={trackGeometry?.circuit_name || raceState?.session.event_name || '—'}
              inspectorTarget={inspectorTarget}
              onSelectBattle={handleSelectBattle}
              onSelectCar={handleSelectCar}
              onJumpToLap={handleSeekLap}
              onOpenInspector={handleOpenInspector}
              onCloseInspector={handleCloseInspector}
            />
          ) : layoutPreset === 'DEMO' ? (
            <DemoWorkspace
              geometry={trackGeometry}
              cars={raceState?.cars || {}}
              decision={decision}
              watchlist={watchlist}
              activeWindows={activeWindows}
              selectedBattleId={selectedBattleId}
              trackStatus={raceState?.track.track_status || '1'}
              circuitName={trackGeometry?.circuit_name || raceState?.session.event_name || '—'}
              inspectorTarget={inspectorTarget}
              onSelectBattle={handleSelectBattle}
              onSelectCar={handleSelectCar}
              onJumpToLap={handleSeekLap}
              onOpenInspector={handleOpenInspector}
              onCloseInspector={handleCloseInspector}
            />
          ) : (
            /* Default: PIT_WALL preset */
            <LiveWorkspace
              geometry={trackGeometry}
              cars={raceState?.cars || {}}
              decision={decision}
              watchlist={watchlist}
              activeWindows={activeWindows}
              selectedBattleId={selectedBattleId}
              recentEvents={recentEvents}
              trackStatus={raceState?.track.track_status || '1'}
              circuitName={trackGeometry?.circuit_name || raceState?.session.event_name || '—'}
              inspectorTarget={inspectorTarget}
              onSelectBattle={handleSelectBattle}
              onSelectCar={handleSelectCar}
              onJumpToLap={handleSeekLap}
              onOpenInspector={handleOpenInspector}
              onCloseInspector={handleCloseInspector}
              onOpenBattleWorkspace={handleOpenBattleWorkspace}
            />
          )}
        </main>

        {/* Floating Context Inspector for Secondary Workspaces (Live and Replay have In-Rail Inspectors) */}
        {inspectorTarget && currentContext !== 'RACE' && (
          <ContextInspector
            target={inspectorTarget}
            onClose={() => setInspectorTarget(null)}
            decision={decision}
            cars={raceState?.cars || {}}
            watchlist={watchlist}
            onSelectBattle={handleSelectBattle}
            onJumpToLap={handleSeekLap}
          />
        )}
      </div>

      {/* 3. Sticky Local Bottom Rail: Replay & Session Controls (Rendered on LIVE and contextual views) */}
      {currentMode !== 'REPLAY' && (
        <footer className="pitwall-bottom-rail">
          <TimelineScrubber
            currentLap={raceState?.session.current_lap ?? 0}
            totalLaps={raceState?.session.total_laps ?? 0}
            sessionTime={raceState?.session.session_time || raceState?.timestamp}
            isPaused={isPaused}
            playbackSpeed={playbackSpeed}
            onPlayPause={handlePlayPause}
            onSeekLap={handleSeekLap}
            onSpeedChange={handleSpeedChange}
            onStep={handleStep}
            markers={timelineMarkers}
          />
        </footer>
      )}

      {/* 4. Session Switcher Dialog */}
      <SessionSwitcher
        isOpen={sessionSwitcherOpen}
        onClose={() => setSessionSwitcherOpen(false)}
        currentEventId={eventId}
        onSelectEvent={handleSelectEvent}
        isLoading={isSessionLoading}
      />

      {/* 5. Keyboard Shortcuts Help Modal */}
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
              <table className="shortcuts-table">
                <tbody>
                  <tr>
                    <td><kbd className="mono">SPACE</kbd></td>
                    <td>Play / Pause sequential replay stream</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">&larr;</kbd> / <kbd className="mono">&rarr;</kbd></td>
                    <td>Step replay forward / backward 1 frame</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">1</kbd></td>
                    <td>Switch to LIVE Operating Mode</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">2</kbd></td>
                    <td>Switch to REPLAY Mode</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">3</kbd></td>
                    <td>Switch to FORECAST Mode</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">4</kbd></td>
                    <td>Switch to BATTLE Investigation Workspace</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">5</kbd></td>
                    <td>Switch to STRATEGY Verification Workspace</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">6</kbd></td>
                    <td>Switch to EVENTS Race Memory Workspace</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">7</kbd></td>
                    <td>Switch to SYSTEM Provenance Workspace</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">ESC</kbd></td>
                    <td>Close active Context Inspector / Modal</td>
                  </tr>
                  <tr>
                    <td><kbd className="mono">?</kbd></td>
                    <td>Toggle this operational shortcut reference</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
