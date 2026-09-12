import React from 'react';
import type { RaceEvent } from '../types';

interface LiveEventStreamProps {
  events: RaceEvent[];
  onEventClick?: (event: RaceEvent) => void;
}

export const LiveEventStream: React.FC<LiveEventStreamProps> = ({ events, onEventClick }) => {
  const getEventBadgeClass = (eventType: string) => {
    switch (eventType) {
      case 'TRACK_STATUS_CHANGED':
        return 'ev-badge-status';
      case 'BATTLE_FORMED':
      case 'PASS_WINDOW_PEAKING':
      case 'PASS_WINDOW_FORMING':
        return 'ev-badge-battle';
      case 'POSITION_CHANGED':
      case 'OVERTAKE_SUCCESS':
        return 'ev-badge-overtake';
      case 'LAP_CHANGED':
        return 'ev-badge-lap';
      default:
        return 'ev-badge-generic';
    }
  };

  const formatEventText = (ev: RaceEvent) => {
    switch (ev.event_type) {
      case 'LAP_CHANGED':
        return `Lap ${ev.lap} started`;
      case 'TRACK_STATUS_CHANGED':
        return `Track status changed to ${ev.derived_data?.to || 'FLAG'}`;
      case 'BATTLE_FORMED':
        return `Battle formed: ${ev.cars.join(' vs ')} (gap: ${ev.derived_data?.gap ? `${ev.derived_data.gap}s` : 'close'})`;
      case 'BATTLE_ENDED':
        return `Battle subsided: ${ev.cars.join(' vs ')}`;
      case 'PASS_WINDOW_PEAKING':
        return `Pass opportunity window PEAKING for ${ev.cars[0] || 'attacker'}`;
      case 'PASS_WINDOW_FORMING':
        return `Pass window FORMING for ${ev.cars[0] || 'attacker'}`;
      case 'PASS_WINDOW_FADING':
        return `Pass window FADING for ${ev.cars[0] || 'attacker'}`;
      case 'POSITION_CHANGED':
        return `Position change: ${ev.derived_data?.driver || ev.cars[0]} moved to P${ev.derived_data?.to || 'ahead'}`;
      case 'SESSION_STARTED':
        return `Race session initialized (Replay Stream Active)`;
      default:
        return ev.event_type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="live-event-stream-card">
      <div className="stream-header">
        <div className="title-row">
          <span className="live-pulsing-dot" />
          <span className="title">Live Race Memory & Event Stream</span>
        </div>
        <span className="count-label">{events.length} LOGGED</span>
      </div>

      <div className="events-scroll-container">
        {events.length === 0 ? (
          <div className="empty-events-msg">Awaiting discrete race events...</div>
        ) : (
          events.slice(0, 15).map((ev) => (
            <div
              key={ev.event_id}
              className="event-item-row"
              onClick={() => onEventClick && onEventClick(ev)}
            >
              <div className="event-meta">
                <span className="event-lap">{ev.lap ? `L${ev.lap}` : 'PRE'}</span>
                <span className={`event-type-badge ${getEventBadgeClass(ev.event_type)}`}>
                  {ev.event_type.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="event-body">
                <span className="event-desc">{formatEventText(ev)}</span>
                {ev.cars && ev.cars.length > 0 && (
                  <div className="event-cars-tags">
                    {ev.cars.map((c) => (
                      <span key={c} className="car-tag">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="event-time mono">
                {ev.timestamp ? `${Math.floor(ev.timestamp / 60)}:${(Math.floor(ev.timestamp % 60)).toString().padStart(2, '0')}` : '0:00'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
