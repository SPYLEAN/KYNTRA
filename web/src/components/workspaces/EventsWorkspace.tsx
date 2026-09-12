import React, { useState } from 'react';
import type {
  DecisionSnapshot,
  EvidenceInspectionTarget,
  KyntraRuntimeSnapshot,
  OperatingMode,
  RaceEvent,
} from '../../types';
import { DecisionTimeline } from '../events/DecisionTimeline';
import { DecisionDiffPanel } from '../events/DecisionDiffPanel';
import { BattleMemoryPanel } from '../events/BattleMemoryPanel';

interface EventsWorkspaceProps {
  events: RaceEvent[];
  runtimeSnapshot?: KyntraRuntimeSnapshot | null;
  decision?: DecisionSnapshot | null;
  decisionHistory?: DecisionSnapshot[];
  selectedBattleId?: string | null;
  operatingMode?: OperatingMode;
  onJumpToLap: (lap: number) => void;
  onOpenEvidence?: (target: EvidenceInspectionTarget) => void;
}

export const EventsWorkspace: React.FC<EventsWorkspaceProps> = ({
  events,
  runtimeSnapshot,
  decision = null,
  decisionHistory = [],
  selectedBattleId = null,
  operatingMode: _operatingMode = 'REPLAY',
  onJumpToLap,
  onOpenEvidence = () => {},
}) => {
  const currentLap = runtimeSnapshot?.current_lap ?? decision?.race?.lap ?? 15;
  const totalLaps = 53;

  // Track the selected moment for comparative Diff inspection
  const [selectedLap, setSelectedLap] = useState<number>(currentLap);
  const [showEventLog, setShowEventLog] = useState<boolean>(false);

  // Derive previous snapshot for Diff calculation
  const currentSnap = decision;
  const prevSnap = React.useMemo(() => {
    if (!decisionHistory || decisionHistory.length < 2) return null;
    // Find previous lap in history
    const match = decisionHistory.find((d: any) => d.race?.lap === selectedLap - 1);
    return match || decisionHistory[1] || null;
  }, [decisionHistory, selectedLap]);

  return (
    <div className="workspace-events-executive-container" aria-label="Events Temporal Workspace">
      {/* 1. HERO: Decision Timeline Scrubber & Evolution Strip */}
      <section className="events-hero-section">
        <DecisionTimeline
          currentLap={currentLap}
          totalLaps={totalLaps}
          decision={decision}
          decisionHistory={decisionHistory}
          events={events}
          onSeekLap={onJumpToLap}
          onOpenEvidence={onOpenEvidence}
          onSelectMoment={(lap) => setSelectedLap(lap)}
        />
      </section>

      {/* 2. MAIN BIFURCATED FORENSIC SUITE: Battle Memory + Decision Diff */}
      <section className="events-forensic-split-grid">
        {/* Left: Continuous Tactical Battle Memory */}
        <div className="split-grid-col col-battle-memory">
          <BattleMemoryPanel
            decision={decision}
            decisionHistory={decisionHistory}
            selectedBattleId={selectedBattleId}
            onOpenEvidence={onOpenEvidence}
            onSeekLap={onJumpToLap}
          />
        </div>

        {/* Right: Decision Diff ("WHAT CHANGED?") */}
        <div className="split-grid-col col-decision-diff">
          <DecisionDiffPanel
            currentSnapshot={currentSnap}
            previousSnapshot={prevSnap}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      </section>

      {/* 3. Collapsible Supporting Runtime Events Bar */}
      <footer className="events-supporting-strip">
        <button
          type="button"
          className="btn-toggle-raw-events mono"
          onClick={() => setShowEventLog((prev) => !prev)}
        >
          {showEventLog ? '▼ HIDE DISCRETE RUNTIME EVENT LOG' : '▶ SHOW DISCRETE RUNTIME EVENT LOG'} ({events.length} RECORDED)
        </button>

        {showEventLog && (
          <div className="discrete-events-table-container table-bounded-scroll">
            <table className="discrete-events-table mono">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>LAP</th>
                  <th>TYPE</th>
                  <th>CARS</th>
                  <th>DETAILS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 20).map((ev) => (
                  <tr key={ev.event_id}>
                    <td>{ev.timestamp.toFixed(1)}s</td>
                    <td>L{ev.lap ?? '—'}</td>
                    <td>
                      <span className={`ev-pill pill-${ev.event_type.toLowerCase()}`}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="font-bold">{ev.cars.join(' & ') || '—'}</td>
                    <td className="text-muted">
                      {ev.derived_data && Object.keys(ev.derived_data).length > 0
                        ? Object.entries(ev.derived_data)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ')
                        : ev.source}
                    </td>
                    <td>
                      {ev.lap && (
                        <button
                          type="button"
                          className="btn-seek-sm"
                          onClick={() => onJumpToLap(ev.lap!)}
                        >
                          SEEK
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </footer>
    </div>
  );
};
