import React, { useMemo, useState } from 'react';
import type { RaceEvent } from '../types';

interface RaceControlFeedProps {
  events: RaceEvent[];
  onOpenEventInspector?: (event: RaceEvent) => void;
  onJumpToLap?: (lap: number) => void;
}

export const RaceControlFeed: React.FC<RaceControlFeedProps> = ({
  events,
  onOpenEventInspector,
  onJumpToLap,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const filteredEvents = useMemo(() => {
    if (filterCategory === 'ALL') return events.slice(0, 30);
    return events
      .filter((ev) => {
        const type = ev.event_type.toUpperCase();
        if (filterCategory === 'TRACK' && type.includes('TRACK')) return true;
        if (filterCategory === 'BATTLE' && type.includes('BATTLE')) return true;
        if (filterCategory === 'POSITION' && (type.includes('POSITION') || type.includes('OVERTAKE'))) return true;
        if (filterCategory === 'WINDOW' && type.includes('WINDOW')) return true;
        if (filterCategory === 'COMPLIANCE' && type.includes('COMPLIANCE')) return true;
        return false;
      })
      .slice(0, 30);
  }, [events, filterCategory]);

  return (
    <div className="race-control-pane">
      <div className="pane-header">
        <div className="pane-title-group">
          <span className="pane-label font-bold">RACE CONTROL</span>
          <span className="pane-count-badge mono">{events.length} EVENTS</span>
        </div>

        {/* Category Filter Pills */}
        <div className="control-filter-pills mono">
          {['ALL', 'BATTLE', 'WINDOW', 'POSITION', 'TRACK'].map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill ${filterCategory === cat ? 'active' : ''}`}
              onClick={() => setFilterCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="race-control-table-wrapper table-bounded-scroll">
        <table className="standard-table race-control-table">
          <thead>
            <tr>
              <th className="th-time">TIME</th>
              <th className="th-lap">LAP</th>
              <th className="th-cat">CATEGORY</th>
              <th className="th-cars">CARS</th>
              <th className="th-msg">OPERATIONAL MESSAGE</th>
              <th className="th-act">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted" style={{ padding: '12px' }}>
                  NO RECENT RACE CONTROL MESSAGES
                </td>
              </tr>
            ) : (
              filteredEvents.map((ev) => {
                const desc =
                  ev.derived_data && typeof ev.derived_data === 'object'
                    ? (ev.derived_data as any).description || ev.event_type.replace(/_/g, ' ')
                    : ev.event_type.replace(/_/g, ' ');

                return (
                  <tr
                    key={ev.event_id}
                    className="rc-row interactive-row"
                    onClick={() => onOpenEventInspector && onOpenEventInspector(ev)}
                    title="Click to inspect event provenance in Context Inspector"
                  >
                    <td className="mono text-muted">{ev.timestamp.toFixed(1)}s</td>
                    <td className="mono font-bold text-accent">L{ev.lap ?? '—'}</td>
                    <td>
                      <span className={`rc-tag tag-${ev.event_type.toLowerCase()}`}>
                        {ev.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="mono font-bold">
                      {ev.cars.length > 0 ? ev.cars.join(' & ') : '—'}
                    </td>
                    <td className="rc-desc-cell">{desc}</td>
                    <td>
                      {ev.lap && onJumpToLap && (
                        <button
                          type="button"
                          className="btn-rc-seek mono"
                          onClick={(e) => {
                            e.stopPropagation();
                            onJumpToLap(ev.lap!);
                          }}
                          title={`Seek to lap ${ev.lap}`}
                        >
                          SEEK
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
