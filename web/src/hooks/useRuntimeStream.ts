/**
 * KYNTRA Canonical Runtime Stream State Owner.
 *
 * Implements real-time WebSocket connection to /api/live with:
 * - Explicit connection states: CONNECTED, RECONNECTING, STALE, OFFLINE, POLLING_FALLBACK, CAPTURED_LIVE, HISTORICAL_REPLAY
 * - Bounded exponential backoff (1s, 2s, 4s, 8s, max 10s)
 * - Dual-timer stale detection (F1-StratLab pattern: 4.0s freshness threshold)
 * - Transparent fallback to HTTP polling of /api/runtime when WebSocket is unavailable
 * - Unified single source of truth for all workspace consumers
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ActiveBattleTracker,
  BattleWatchlistItem,
  DecisionSnapshot,
  KyntraRuntimeSnapshot,
  LiveUpdatePayload,
  RaceEvent,
  RaceState,
  SystemStatus,
  WindowState,
} from '../types';
import { KyntraApiClient } from '../api/client';
import type { OperatingMode } from '../domain/types';

export type StreamConnectionStatus =
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'STALE'
  | 'OFFLINE'
  | 'POLLING_FALLBACK'
  | 'CAPTURED_LIVE'
  | 'HISTORICAL_REPLAY';

export interface DiagnosticLog {
  timestamp: number;
  type: 'INFO' | 'WARN' | 'ERROR' | 'RECONNECT';
  message: string;
}

export interface UseRuntimeStreamResult {
  // Canonical state
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  raceState: RaceState | null;
  decision: DecisionSnapshot | null;
  watchlist: BattleWatchlistItem[];
  activeBattles: ActiveBattleTracker[];
  activeWindows: Record<string, WindowState>;
  recentEvents: RaceEvent[];
  systemStatus: SystemStatus | null;
  operatingMode: OperatingMode;
  selectedBattleId: string | null;

  // Connection & Health
  connectionStatus: StreamConnectionStatus;
  transportType: 'WS_STREAM' | 'HTTP_POLL';
  isStale: boolean;
  latencyMs: number | null;
  reconnectCount: number;
  lastUpdateTimestamp: number | null;
  diagnosticLogs: DiagnosticLog[];

  // Actions
  selectBattle: (battleId: string) => void;
  setOperatingMode: (mode: OperatingMode) => void;
  sendCommand: (payload: any) => void;
  forceReconnect: () => void;
}

const STALE_THRESHOLD_MS = 4000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;
const POLLING_INTERVAL_MS = 1000;

export function useRuntimeStream(_initialEventId: string = '2026_13_ITA'): UseRuntimeStreamResult {
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<KyntraRuntimeSnapshot | null>(null);
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [decision, setDecision] = useState<DecisionSnapshot | null>(null);
  const [watchlist, setWatchlist] = useState<BattleWatchlistItem[]>([]);
  const [activeBattles, setActiveBattles] = useState<ActiveBattleTracker[]>([]);
  const [activeWindows, setActiveWindows] = useState<Record<string, WindowState>>({});
  const [recentEvents, setRecentEvents] = useState<RaceEvent[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [operatingMode, setOperatingModeState] = useState<OperatingMode>('REPLAY');
  const userExplicitModeRef = useRef<OperatingMode | null>(null);
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);

  // Connection & Diagnostics
  const [rawConnectionStatus, setRawConnectionStatus] = useState<StreamConnectionStatus>('RECONNECTING');
  const [transportType, setTransportType] = useState<'WS_STREAM' | 'HTTP_POLL'>('WS_STREAM');
  const [isStale, setIsStale] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLog[]>([]);

  // Refs for network lifecycle
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef<number>(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgTimeRef = useRef<number>(Date.now());
  const isMountedRef = useRef<boolean>(true);

  // Append diagnostic event
  const addLog = useCallback((type: DiagnosticLog['type'], message: string) => {
    if (!isMountedRef.current) return;
    setDiagnosticLogs((prev) => [
      { timestamp: Date.now(), type, message },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // Compute effective display connection status (e.g. HISTORICAL_REPLAY if mode says so)
  const effectiveStatus: StreamConnectionStatus = (() => {
    if (isStale) return 'STALE';
    if (runtimeSnapshot?.mode === 'HISTORICAL_REPLAY') {
      return rawConnectionStatus === 'CONNECTED' ? 'HISTORICAL_REPLAY' : rawConnectionStatus;
    }
    if (runtimeSnapshot?.mode === 'CAPTURED_LIVE') {
      return rawConnectionStatus === 'CONNECTED' ? 'CAPTURED_LIVE' : rawConnectionStatus;
    }
    return rawConnectionStatus;
  })();

  // Synchronous command sender via WebSocket with guaranteed REST dispatch
  const sendCommand = useCallback((payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
      } catch (e) {
        // ws write failed
      }
    }
    KyntraApiClient.sendRuntimeControl(payload).catch(() => {
      // REST dispatch handled
    });
  }, []);

  // Mode selection handler
  const setOperatingMode = useCallback(
    (mode: OperatingMode) => {
      userExplicitModeRef.current = mode;
      setOperatingModeState(mode);
      sendCommand({ action: 'set_mode', mode });
    },
    [sendCommand]
  );

  // Battle selection handler
  const selectBattle = useCallback(
    (battleId: string) => {
      setSelectedBattleId(battleId);
      sendCommand({ action: 'select_battle', battle_id: battleId });
    },
    [sendCommand]
  );

  // Ingest canonical payload from WebSocket or Polling
  const ingestPayload = useCallback(
    (data: any) => {
      if (!isMountedRef.current) return;
      const now = Date.now();
      lastMsgTimeRef.current = now;
      setLastUpdateTimestamp(now);
      setIsStale(false);

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
          const newItems = data.recent_events.filter((e: any) => !existingIds.has(e.event_id));
          return [...newItems, ...prev].slice(0, 100);
        });
      }
    },
    [selectedBattleId]
  );

  // Ingest canonical runtime snapshot from HTTP /api/runtime
  const ingestRuntimeSnapshot = useCallback(
    (snap: KyntraRuntimeSnapshot, responseTimeMs?: number) => {
      if (!isMountedRef.current) return;
      const now = Date.now();
      lastMsgTimeRef.current = now;
      setLastUpdateTimestamp(now);
      setIsStale(false);
      setRuntimeSnapshot(snap);

      if (responseTimeMs !== undefined) {
        setLatencyMs(responseTimeMs);
      }

      if (!userExplicitModeRef.current) {
        if (snap.mode === 'HISTORICAL_REPLAY') {
          setOperatingModeState('REPLAY');
        } else if (snap.mode === 'LIVE_FEED') {
          setOperatingModeState('LIVE');
        }
      }

      if (snap.active_battles && snap.active_battles.length > 0) {
        setActiveBattles(snap.active_battles);
        if (!selectedBattleId) {
          setSelectedBattleId(snap.selected_battle_id || snap.active_battles[0].battle_id);
        }
      }

      if (snap.health) {
        setSystemStatus((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: snap.health.system_health,
          };
        });
      }
    },
    [selectedBattleId]
  );

  // Connect WebSocket stream with bounded exponential backoff
  const connectWs = useCallback(() => {
    if (!isMountedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultWsUrl = `${protocol}//${window.location.host}/api/live`;
    const wsUrl = (import.meta as any).env?.VITE_WS_URL || defaultWsUrl;

    setRawConnectionStatus('RECONNECTING');
    addLog('RECONNECT', `Connecting to WebSocket stream at ${wsUrl}...`);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setRawConnectionStatus('CONNECTED');
        setTransportType('WS_STREAM');
        backoffRef.current = INITIAL_BACKOFF_MS; // reset backoff on success
        addLog('INFO', 'WebSocket live race stream connected successfully.');
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const payload: LiveUpdatePayload = JSON.parse(event.data);
          ingestPayload(payload);
        } catch (e) {
          addLog('WARN', 'Failed to parse stream packet');
        }
      };

      ws.onclose = (ev) => {
        if (!isMountedRef.current) return;
        setRawConnectionStatus('RECONNECTING');
        setReconnectCount((c) => c + 1);

        const nextDelay = backoffRef.current;
        backoffRef.current = Math.min(MAX_BACKOFF_MS, backoffRef.current * 2);

        addLog('WARN', `Stream disconnected (code: ${ev.code}). Reconnecting in ${nextDelay}ms...`);

        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          connectWs();
        }, nextDelay);
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        addLog('ERROR', 'WebSocket network transport error. Enabling polling fallback.');
        setRawConnectionStatus('POLLING_FALLBACK');
        setTransportType('HTTP_POLL');
      };
    } catch (err) {
      if (!isMountedRef.current) return;
      setRawConnectionStatus('POLLING_FALLBACK');
      setTransportType('HTTP_POLL');
      addLog('ERROR', 'WebSocket initialization failed. Using polling fallback.');
    }
  }, [addLog, ingestPayload]);

  // Force manual reconnect
  const forceReconnect = useCallback(() => {
    backoffRef.current = INITIAL_BACKOFF_MS;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    connectWs();
  }, [connectWs]);

  // Main lifecycle effect
  useEffect(() => {
    isMountedRef.current = true;

    // 1. Initial HTTP fetch of runtime snapshot and system status
    const fetchInitial = async () => {
      const t0 = performance.now();
      const snap = await KyntraApiClient.getRuntimeSnapshot();
      const t1 = performance.now();
      if (snap) {
        ingestRuntimeSnapshot(snap, Math.round(t1 - t0));
      }
      const status = await KyntraApiClient.getSystemStatus();
      if (status && isMountedRef.current) {
        setSystemStatus(status);
      }
    };
    fetchInitial();

    // 2. Connect WebSocket stream
    connectWs();

    // 3. Dual-Timer Heartbeat for Stale Detection (runs every 1000ms)
    heartbeatTimerRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const elapsed = Date.now() - lastMsgTimeRef.current;
      if (elapsed > STALE_THRESHOLD_MS) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
    }, 1000);

    // 4. Background HTTP Sync Poller (ensures strategy matrix & ranking are fresh)
    pollTimerRef.current = setInterval(async () => {
      if (!isMountedRef.current) return;
      const t0 = performance.now();
      const snap = await KyntraApiClient.getRuntimeSnapshot();
      const t1 = performance.now();
      if (snap && isMountedRef.current) {
        ingestRuntimeSnapshot(snap, Math.round(t1 - t0));
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [connectWs, ingestRuntimeSnapshot]);

  return {
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
    connectionStatus: effectiveStatus,
    transportType,
    isStale,
    latencyMs,
    reconnectCount,
    lastUpdateTimestamp,
    diagnosticLogs,
    selectBattle,
    setOperatingMode,
    sendCommand,
    forceReconnect,
  };
}
