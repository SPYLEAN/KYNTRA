/**
 * KYNTRA Unified Typed API & Streaming Client Layer.
 * Strictly binds to backend routes without fabricating fields.
 */

import type {
  DecisionSnapshot,
  EventInfo,
  KyntraRuntimeSnapshot,
  RaceEvent,
  RuntimeHealthSnapshot,
  SystemStatus,
  TimelineMarker,
  TrackGeometry,
} from '../types';

export class KyntraApiClient {
  private static baseUri = '';

  static async getDecisionSnapshot(id: string): Promise<DecisionSnapshot | null> {
    try {
      const res = await fetch(this.baseUri + '/api/decision/' + encodeURIComponent(id));
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  /**
   * 1. Get canonical runtime snapshot from Phase 10 orchestrator.
   */
  static async getRuntimeSnapshot(): Promise<KyntraRuntimeSnapshot | null> {
    try {
      const res = await fetch(`${this.baseUri}/api/runtime`);
      if (!res.ok) {
        console.warn(`[KYNTRA API] /api/runtime returned HTTP ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn('[KYNTRA API] Failed to fetch /api/runtime:', err);
      return null;
    }
  }

  /**
   * 2. Get composite platform and module health status.
   */
  static async getRuntimeHealth(): Promise<RuntimeHealthSnapshot | null> {
    try {
      const res = await fetch(`${this.baseUri}/api/runtime/health`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[KYNTRA API] Failed to fetch /api/runtime/health:', err);
      return null;
    }
  }

  /**
   * 3. Get tracked active battles from runtime orchestrator.
   */
  static async getRuntimeBattles(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUri}/api/runtime/battles`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('[KYNTRA API] Failed to fetch /api/runtime/battles:', err);
      return [];
    }
  }

  /**
   * 4. Get chronological decision history.
   */
  static async getRuntimeHistory(battleId?: string, limit: number = 50): Promise<any[]> {
    try {
      const url = battleId
        ? `${this.baseUri}/api/runtime/history?battle_id=${encodeURIComponent(battleId)}&limit=${limit}`
        : `${this.baseUri}/api/runtime/history?limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('[KYNTRA API] Failed to fetch /api/runtime/history:', err);
      return [];
    }
  }

  /**
   * 5. Send runtime playback / battle selection control commands.
   */
  static async sendRuntimeControl(payload: {
    action: string;
    lap?: number;
    speed?: number;
    battle_id?: string;
    event_id?: string;
    mode?: string;
  }): Promise<{ status: string; [key: string]: any }> {
    try {
      const res = await fetch(`${this.baseUri}/api/runtime/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const result = await res.json();
      // These routes own separate providers: runtime decisions and spatial replay.
      // set_event already updates both on the server; dispatch it only once.
      if (result.status === 'SUCCESS' && ['pause','resume','seek','speed','select_battle','step'].includes(payload.action)) {
        const timing = await fetch(this.baseUri + '/api/replay/control', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload),
        });
        if (!timing.ok) throw new Error('Timing replay control failed: HTTP ' + timing.status);
      }
      return result;
    } catch (err) {
      console.error('[KYNTRA API] Control command failed:', err);
      return { status: 'ERROR', message: String(err) };
    }
  }

  /**
   * 6. Get Track Geometry vector data for circuit twin.
   */
  static async getTrackGeometry(eventId: string): Promise<TrackGeometry | null> {
    try {
      const res = await fetch(`${this.baseUri}/api/track/${encodeURIComponent(eventId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[KYNTRA API] Failed to fetch track geometry for ${eventId}:`, err);
      return null;
    }
  }

  /**
   * 7. Get system status & model metadata.
   */
  static async getSystemStatus(): Promise<SystemStatus | null> {
    try {
      const res = await fetch(`${this.baseUri}/api/system`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[KYNTRA API] Failed to fetch /api/system:', err);
      return null;
    }
  }

  /**
   * 8. Get demo events list.
   */
  static async getEvents(): Promise<EventInfo[]> {
    try {
      const res = await fetch(`${this.baseUri}/api/events`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('[KYNTRA API] Failed to fetch /api/events:', err);
      return [];
    }
  }

  /**
   * 9. Get replay lap decision snapshot.
   */
  static async getReplayLap(
    eventId: string,
    lap: number,
    attacker?: string,
    defender?: string
  ): Promise<DecisionSnapshot | null> {
    try {
      let url = `${this.baseUri}/api/replay/${encodeURIComponent(eventId)}/lap/${lap}`;
      const params = new URLSearchParams();
      if (attacker) params.append('attacker', attacker);
      if (defender) params.append('defender', defender);
      const query = params.toString();
      if (query) url += `?${query}`;

      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[KYNTRA API] Failed to fetch replay lap ${lap}:`, err);
      return null;
    }
  }

  /**
   * 10. Get timeline event markers.
   */
  static async getTimelineMarkers(raceId: string): Promise<TimelineMarker[]> {
    try {
      const res = await fetch(`${this.baseUri}/api/events/markers?race_id=${encodeURIComponent(raceId)}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('[KYNTRA API] Failed to fetch markers:', err);
      return [];
    }
  }

  /**
   * 11. Get recent discrete race memory events.
   */
  static async getRecentEvents(limit: number = 50): Promise<RaceEvent[]> {
    try {
      const res = await fetch(`${this.baseUri}/api/events/history?limit=${limit}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('[KYNTRA API] Failed to fetch recent events:', err);
      return [];
    }
  }
}
