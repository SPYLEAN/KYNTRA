import React from 'react';
import type { EventInfo } from '../types';

interface SessionSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  currentEventId: string;
  onSelectEvent: (eventId: string) => void;
  isLoading?: boolean;
}

export const DEMO_SESSIONS: (EventInfo & { coverageNote?: string })[] = [
  {
    event_id: '2026_13_ITA',
    event_name: 'Italian Grand Prix',
    circuit: 'Autodromo Nazionale Monza',
    total_laps: 53,
    is_primary: true,
    description: 'Monza High-Speed Slipstream Battle: Verstappen (#1) vs Antonelli (#12) vs Russell (#63)',
    coverageNote: 'Full 3-car telemetry coverage (VER, ANT, RUS).',
  },
  {
    event_id: '2026_01_AUS',
    event_name: 'Australian Grand Prix',
    circuit: 'Albert Park Circuit',
    total_laps: 58,
    is_primary: false,
    description: 'Melbourne Chase: Russell (#63) vs Leclerc (#16) vs Verstappen (#1)',
    coverageNote: 'Full 3-car telemetry coverage (RUS, LEC, VER).',
  },
  {
    event_id: '2026_04_MIA',
    event_name: 'Miami Grand Prix',
    circuit: 'Miami International Autodrome',
    total_laps: 57,
    is_primary: false,
    description: 'Miami DRS Battle: Antonelli (#12) vs Verstappen (#1) vs Leclerc (#16)',
    coverageNote: 'Full 3-car telemetry coverage (ANT, VER, LEC).',
  },
  {
    event_id: '2026_03_JPN',
    event_name: 'Japanese Grand Prix',
    circuit: 'Suzuka International Racing Course',
    total_laps: 53,
    is_primary: false,
    description: 'Suzuka Sector 1 Elevation Flow: Antonelli (#12)',
    coverageNote: 'Limited Coverage: Single monitored car available in raw replay.',
  },
];

export const SessionSwitcher: React.FC<SessionSwitcherProps> = ({
  isOpen,
  onClose,
  currentEventId,
  onSelectEvent,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop session-switcher-backdrop" onClick={onClose}>
      <div
        className="modal-dialog session-switcher-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-switcher-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">HISTORICAL DEMO SESSIONS</span>
            <h3 id="session-switcher-title">SELECT RACE SESSION</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close session switcher"
          >
            ✕
          </button>
        </div>

        <div className="modal-body session-switcher-body">
          <p className="session-switcher-intro">
            Switch the active streaming replay provider. KYNTRA will reset transient battle tracking,
            clear window histories, and preserve persistent Race Memory while loading the new circuit.
          </p>

          <div className="session-cards-list">
            {DEMO_SESSIONS.map((sess) => {
              const isActive = sess.event_id === currentEventId;
              const isLimited = sess.event_id === '2026_03_JPN';

              return (
                <div
                  key={sess.event_id}
                  className={`session-card ${isActive ? 'active-session' : ''} ${isLoading ? 'loading' : ''}`}
                  onClick={() => {
                    if (isActive && !isLoading) { onClose(); return; }
                    if (!isActive && !isLoading) {
                      onSelectEvent(sess.event_id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!isLoading) { if (isActive) onClose(); else onSelectEvent(sess.event_id); }
                    }
                  }}
                >
                  <div className="session-card-header">
                    <div className="session-card-title-group">
                      <span className="session-event-name font-bold">{sess.event_name}</span>
                      <span className="session-circuit-name">{sess.circuit}</span>
                    </div>
                    <div className="session-badge-group">
                      {isActive ? (
                        <span className="badge-active-stream">● ACTIVE STREAM</span>
                      ) : (
                        <span className="badge-load-action">LOAD &rarr;</span>
                      )}
                    </div>
                  </div>

                  <div className="session-card-meta mono">
                    <span>ID: {sess.event_id}</span>
                    <span>{sess.total_laps} LAPS</span>
                    <span>FORMAT: RACE</span>
                  </div>

                  <div className="session-card-desc">{sess.description}</div>

                  {sess.coverageNote && (
                    <div className={`session-coverage-tag ${isLimited ? 'coverage-limited' : 'coverage-full'}`}>
                      {isLimited ? '⚠ ' : '✓ '}
                      {sess.coverageNote}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
