import React from 'react';
import type { EvidenceInspectionTarget } from '../../types';

interface PassWindowStripProps {
  p1?: number | null;
  p2?: number | null;
  p3?: number | null;
  pavApplied?: boolean;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

export const PassWindowStrip: React.FC<PassWindowStripProps> = ({
  p1,
  p2,
  p3,
  pavApplied = true,
  onOpenEvidence,
}) => {
  const p1Val = p1 !== undefined && p1 !== null ? Math.round(p1 * 100) : null;
  const p2Val = p2 !== undefined && p2 !== null ? Math.round(p2 * 100) : null;
  const p3Val = p3 !== undefined && p3 !== null ? Math.round(p3 * 100) : null;

  return (
    <div
      className="pass-window-strip clickable"
      onClick={() =>
        onOpenEvidence({
          title: 'Cumulative Overtake Horizon Likelihood (P1 / P2 / P3)',
          value: `P1: ${p1Val ?? '—'}% | P2: ${p2Val ?? '—'}% | P3: ${p3Val ?? '—'}%`,
          status: 'INFO',
          provenance: 'FROZEN MODEL',
          method: 'LightGBM Cumulative Classifier + Equal-Weight PAV',
          version: '1.0.0',
          configIdentities: {
            'Model SHA-256': 'a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5',
            'PAV Monotonicity': pavApplied ? 'ENFORCED (P1 <= P2 <= P3)' : 'UNENFORCED',
            'Context Semantics': 'Cumulative Natural Pass Likelihood (Action-Independent)',
          },
          evidenceItems: [
            { label: 'P1 (Pass within ≤1 Lap)', value: p1Val !== null ? `${p1Val}%` : 'UNAVAILABLE' },
            { label: 'P2 (Pass within ≤2 Laps)', value: p2Val !== null ? `${p2Val}%` : 'UNAVAILABLE' },
            { label: 'P3 (Pass within ≤3 Laps)', value: p3Val !== null ? `${p3Val}%` : 'UNAVAILABLE' },
          ],
        })
      }
      title="Click to inspect frozen ML model and PAV monotonic calibration"
    >
      <div className="horizon-top-meta">
        <span className="meta-provenance text-muted">FROZEN MODEL • PAV MONOTONIC</span>
      </div>

      {/* 3-Column Large Probability Cards */}
      <div className="horizon-cards-grid">
        {/* P1 Card */}
        <div className="horizon-prob-card">
          <span className="card-horizon-label">P1</span>
          <span className="card-prob-num mono-num font-bold text-primary">
            {p1Val !== null ? `${p1Val}%` : '—'}
          </span>
          <span className="card-horizon-sub text-muted">&le;1 LAP</span>
          <div className="card-level-track">
            <div className="card-level-fill fill-p1" style={{ width: `${p1Val ?? 0}%` }} />
          </div>
        </div>

        {/* P2 Card */}
        <div className="horizon-prob-card">
          <span className="card-horizon-label">P2</span>
          <span className="card-prob-num mono-num font-bold text-primary">
            {p2Val !== null ? `${p2Val}%` : '—'}
          </span>
          <span className="card-horizon-sub text-muted">&le;2 LAPS</span>
          <div className="card-level-track">
            <div className="card-level-fill fill-p2" style={{ width: `${p2Val ?? 0}%` }} />
          </div>
        </div>

        {/* P3 Card */}
        <div className="horizon-prob-card">
          <span className="card-horizon-label">P3</span>
          <span className="card-prob-num mono-num font-bold text-primary">
            {p3Val !== null ? `${p3Val}%` : '—'}
          </span>
          <span className="card-horizon-sub text-muted">&le;3 LAPS</span>
          <div className="card-level-track">
            <div className="card-level-fill fill-p3" style={{ width: `${p3Val ?? 0}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
