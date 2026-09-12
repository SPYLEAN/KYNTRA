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
      className="pass-window-strip mono clickable"
      onClick={() =>
        onOpenEvidence({
          title: 'Cumulative Overtake Horizon Probability (H1/H2/H3)',
          value: `H1: ${p1Val ?? '—'}% | H2: ${p2Val ?? '—'}% | H3: ${p3Val ?? '—'}%`,
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
            { label: 'P1 (Pass within 1 Lap)', value: p1Val !== null ? `${p1Val}%` : 'UNAVAILABLE' },
            { label: 'P2 (Pass within 2 Laps)', value: p2Val !== null ? `${p2Val}%` : 'UNAVAILABLE' },
            { label: 'P3 (Pass within 3 Laps)', value: p3Val !== null ? `${p3Val}%` : 'UNAVAILABLE' },
          ],
        })
      }
      title="Click to inspect frozen ML model and PAV monotonic calibration"
    >
      <div className="strip-title-row">
        <span className="strip-title font-bold">PASS HORIZON (P1 / P2 / P3)</span>
        <span className="strip-badge text-accent">FROZEN MODEL + PAV</span>
      </div>

      <div className="bars-container">
        {/* P1 Bar */}
        <div className="horizon-bar-item">
          <div className="bar-label-line">
            <span className="bar-h-tag font-bold">1 LAP (P1)</span>
            <span className="bar-pct font-bold text-primary mono-num">
              {p1Val !== null ? `${p1Val}%` : '—'}
            </span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill fill-p1"
              style={{ width: `${p1Val ?? 0}%` }}
            />
          </div>
        </div>

        {/* P2 Bar */}
        <div className="horizon-bar-item">
          <div className="bar-label-line">
            <span className="bar-h-tag font-bold">2 LAPS (P2)</span>
            <span className="bar-pct font-bold text-primary mono-num">
              {p2Val !== null ? `${p2Val}%` : '—'}
            </span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill fill-p2"
              style={{ width: `${p2Val ?? 0}%` }}
            />
          </div>
        </div>

        {/* P3 Bar */}
        <div className="horizon-bar-item">
          <div className="bar-label-line">
            <span className="bar-h-tag font-bold">3 LAPS (P3)</span>
            <span className="bar-pct font-bold text-primary mono-num">
              {p3Val !== null ? `${p3Val}%` : '—'}
            </span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill fill-p3"
              style={{ width: `${p3Val ?? 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
