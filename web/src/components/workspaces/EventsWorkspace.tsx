import React, { useState } from 'react';
import type { RaceEvent } from '../../types';

interface EventsWorkspaceProps {
  events: RaceEvent[];
  onJumpToLap: (lap: number) => void;
}

export const EventsWorkspace: React.FC<EventsWorkspaceProps> = ({ events, onJumpToLap }) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    events.length > 0 ? events[0].event_id : null
  );
  const [filterType, setFilterType] = useState<string>('ALL');
  const [driverFilter, setDriverFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Extract unique drivers present in events
  const uniqueDrivers = React.useMemo(() => {
    const drivers = new Set<string>();
    events.forEach((e) => e.cars.forEach((c) => drivers.add(c)));
    return Array.from(drivers).sort();
  }, [events]);

  // Filtered events
  const filteredEvents = React.useMemo(() => {
    return events.filter((e) => {
      // Type filter
      if (filterType !== 'ALL') {
        if (filterType === 'BATTLE' && !e.event_type.includes('BATTLE')) return false;
        if (filterType === 'WINDOW' && !e.event_type.includes('WINDOW')) return false;
        if (filterType === 'LAP' && e.event_type !== 'LAP_CHANGED') return false;
        if (filterType === 'TRACK' && e.event_type !== 'TRACK_STATUS_CHANGED') return false;
        if (filterType === 'POSITION' && e.event_type !== 'POSITION_CHANGED') return false;
      }

      // Driver filter
      if (driverFilter !== 'ALL' && !e.cars.includes(driverFilter)) {
        return false;
      }

      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesType = e.event_type.toLowerCase().includes(query);
        const matchesCars = e.cars.some((c) => c.toLowerCase().includes(query));
        const matchesId = e.event_id.toLowerCase().includes(query);
        const matchesSource = e.source.toLowerCase().includes(query);
        if (!matchesType && !matchesCars && !matchesId && !matchesSource) {
          return false;
        }
      }

      return true;
    });
  }, [events, filterType, driverFilter, searchTerm]);

  // Currently inspected event
  const inspectedEvent = React.useMemo(() => {
    if (!selectedEventId) return filteredEvents[0] || null;
    return events.find((e) => e.event_id === selectedEventId) || filteredEvents[0] || null;
  }, [selectedEventId, events, filteredEvents]);

  return (
    <div className="workspace-events-container">
      {/* Pane 1 (Left): Filters & Scope */}
      <aside className="events-pane events-pane-filters">
        <div className="pane-header">
          <span className="pane-title">FILTER RACE MEMORY</span>
        </div>

        <div className="filter-group">
          <label className="filter-lbl">SEARCH QUERY</label>
          <input
            type="text"
            className="filter-input mono"
            placeholder="Filter by driver, ID, type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="filter-lbl">EVENT CATEGORY</label>
          <div className="category-pill-list">
            {['ALL', 'BATTLE', 'WINDOW', 'POSITION', 'LAP', 'TRACK'].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cat-pill-btn ${filterType === cat ? 'active' : ''}`}
                onClick={() => setFilterType(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-lbl">INVOLVED DRIVER</label>
          <select
            className="filter-select mono"
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
          >
            <option value="ALL">ALL DRIVERS ({uniqueDrivers.length})</option>
            {uniqueDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="events-stat-box mono">
          <div>TOTAL RECORDED: {events.length}</div>
          <div>MATCHING SCOPE: {filteredEvents.length}</div>
          <div>PERSISTENCE: SQLITE WAL</div>
        </div>
      </aside>

      {/* Pane 2 (Center): Chronological Event Timeline (Only this pane scrolls internally) */}
      <section className="events-pane events-pane-timeline">
        <div className="pane-header">
          <span className="pane-title">RACE EVENT TIMELINE</span>
          <span className="pane-meta mono">{filteredEvents.length} EVENTS SHOWN</span>
        </div>

        <div className="timeline-scroll-container">
          {filteredEvents.length === 0 ? (
            <div className="empty-msg">No events match the active filter criteria.</div>
          ) : (
            filteredEvents.map((ev) => {
              const isSelected = ev.event_id === inspectedEvent?.event_id;
              return (
                <div
                  key={ev.event_id}
                  className={`event-row-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedEventId(ev.event_id)}
                  onDoubleClick={() => ev.lap && onJumpToLap(ev.lap)}
                  title="Click to inspect, double-click to seek replay"
                >
                  <div className="ev-time-col mono">
                    <span className="ev-session-time">{ev.timestamp.toFixed(1)}s</span>
                    <span className="ev-lap-tag">L{ev.lap ?? '—'}</span>
                  </div>

                  <div className="ev-content-col">
                    <div className="ev-title-line">
                      <span className={`ev-type-pill pill-${ev.event_type.toLowerCase()}`}>
                        {ev.event_type}
                      </span>
                      {ev.cars.length > 0 && (
                        <span className="ev-cars-tag mono font-bold">
                          {ev.cars.join(' & ')}
                        </span>
                      )}
                    </div>
                    <div className="ev-details-line mono">
                      {ev.derived_data && Object.keys(ev.derived_data).length > 0
                        ? Object.entries(ev.derived_data)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ')
                        : ev.source}
                    </div>
                  </div>

                  <div className="ev-action-col">
                    {ev.lap && (
                      <button
                        type="button"
                        className="btn-jump-mini mono"
                        title={`Jump replay to lap ${ev.lap}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToLap(ev.lap!);
                        }}
                      >
                        SEEK
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Pane 3 (Right): Deep Event Inspector */}
      <aside className="events-pane events-pane-inspector">
        <div className="pane-header">
          <span className="pane-title">EVENT INSPECTOR</span>
          <span className="pane-meta mono">METADATA AUDIT</span>
        </div>

        {inspectedEvent ? (
          <div className="inspector-content table-bounded-scroll">
            <div className="inspector-field">
              <span className="f-lbl">DETERMINISTIC EVENT ID:</span>
              <span className="f-val mono text-accent break-all">{inspectedEvent.event_id}</span>
            </div>

            <div className="inspector-field">
              <span className="f-lbl">CLASSIFICATION TYPE:</span>
              <span className="f-val mono font-bold">{inspectedEvent.event_type}</span>
            </div>

            <div className="inspector-field-row">
              <div className="inspector-field">
                <span className="f-lbl">SESSION TIME:</span>
                <span className="f-val mono">{inspectedEvent.timestamp.toFixed(2)}s</span>
              </div>
              <div className="inspector-field">
                <span className="f-lbl">LAP:</span>
                <span className="f-val mono">Lap {inspectedEvent.lap ?? '—'}</span>
              </div>
            </div>

            {/* State Transition: Before & After */}
            <div className="event-state-diff-box">
              <span className="diff-header">STATE TRANSITION</span>
              <div className="diff-row">
                <div className="diff-col before">
                  <span className="diff-lbl">STATE BEFORE</span>
                  <span className="diff-val mono">
                    {inspectedEvent.derived_data && (inspectedEvent.derived_data as any).state_before
                      ? String((inspectedEvent.derived_data as any).state_before)
                      : inspectedEvent.derived_data && (inspectedEvent.derived_data as any).prev_gap
                      ? `${(inspectedEvent.derived_data as any).prev_gap.toFixed(2)}s`
                      : '—'}
                  </span>
                </div>
                <div className="diff-arrow">&rarr;</div>
                <div className="diff-col after">
                  <span className="diff-lbl">STATE AFTER</span>
                  <span className="diff-val mono text-accent">
                    {inspectedEvent.derived_data && (inspectedEvent.derived_data as any).state_after
                      ? String((inspectedEvent.derived_data as any).state_after)
                      : inspectedEvent.derived_data && (inspectedEvent.derived_data as any).gap_seconds
                      ? `${(inspectedEvent.derived_data as any).gap_seconds.toFixed(2)}s`
                      : inspectedEvent.derived_data && (inspectedEvent.derived_data as any).description
                      ? String((inspectedEvent.derived_data as any).description)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="inspector-field">
              <span className="f-lbl">RELATED BATTLE:</span>
              <span className="f-val mono">
                {inspectedEvent.battle_id
                  ? inspectedEvent.battle_id
                  : inspectedEvent.cars.length > 1
                  ? `${inspectedEvent.cars[0]} vs ${inspectedEvent.cars[1]}`
                  : '—'}
              </span>
            </div>

            <div className="inspector-field-row">
              <div className="inspector-field">
                <span className="f-lbl">MODEL OUTPUT (P1):</span>
                <span className="f-val mono">
                  {inspectedEvent.derived_data && (inspectedEvent.derived_data as any).p1 !== undefined
                    ? `${((inspectedEvent.derived_data as any).p1 * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </div>
              <div className="inspector-field">
                <span className="f-lbl">COMPLIANCE:</span>
                <span className="f-val mono text-legal">
                  {inspectedEvent.derived_data && (inspectedEvent.derived_data as any).compliance
                    ? String((inspectedEvent.derived_data as any).compliance)
                    : 'LEGAL'}
                </span>
              </div>
            </div>

            <div className="inspector-field-row">
              <div className="inspector-field">
                <span className="f-lbl">SIMULATED ENERGY:</span>
                <span className="f-val mono">
                  {inspectedEvent.derived_data && (inspectedEvent.derived_data as any).energy_mj !== undefined
                    ? `${(inspectedEvent.derived_data as any).energy_mj.toFixed(2)} MJ`
                    : '—'}
                </span>
              </div>
              <div className="inspector-field">
                <span className="f-lbl">PROVENANCE:</span>
                <span className="f-val mono text-legal">{inspectedEvent.provenance || 'DERIVED_FROM_PUBLIC_TELEMETRY'}</span>
              </div>
            </div>

            <div className="inspector-field">
              <span className="f-lbl">RAW PAYLOAD:</span>
              <pre className="json-box mono">
                {JSON.stringify(inspectedEvent.derived_data || {}, null, 2)}
              </pre>
            </div>

            {inspectedEvent.lap && (
              <button
                type="button"
                className="btn-primary jump-moment-btn"
                onClick={() => onJumpToLap(inspectedEvent.lap!)}
              >
                ⏩ JUMP TO MOMENT (LAP {inspectedEvent.lap})
              </button>
            )}
          </div>
        ) : (
          <div className="empty-msg">Select an event from the timeline to inspect details.</div>
        )}
      </aside>
    </div>
  );
};
