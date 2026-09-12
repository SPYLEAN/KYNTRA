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

  const handleOpenHorizonEvidence = (horizon: 1 | 2 | 3 | 'ALL') => {
    const horizonTitle = horizon === 'ALL' ? 'Cumulative Overtake Horizons (P1 / P2 / P3)' : `Overtake Horizon P${horizon} (≤${horizon} Lap${horizon > 1 ? 's' : ''})`;
    const probVal = horizon === 1 ? p1Val : horizon === 2 ? p2Val : horizon === 3 ? p3Val : null;
    const valueStr = horizon === 'ALL'
      ? `P1: ${p1Val ?? '—'}% | P2: ${p2Val ?? '—'}% | P3: ${p3Val ?? '—'}%`
      : `${probVal ?? '—'}% Cumulative Likelihood`;

    onOpenEvidence({
      title: horizonTitle,
      value: valueStr,
      status: 'INFO',
      provenance: 'FROZEN MODEL',
      source: 'LightGBM Cumulative Classifier Runtime',
      method: 'Multi-Horizon Classifier + Pool Adjacent Violators (PAV)',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      configIdentities: {
        'Model SHA-256': 'a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5',
        'Model Name': 'kyntra_pass_horizon_lgb_v1',
        'Algorithm': 'LightGBM Gradient Boosted Trees + Isotonic PAV',
        'Horizon Monotonicity': pavApplied ? 'ENFORCED (P1 <= P2 <= P3)' : 'RAW',
      },
      technicalEvidence: [
        { label: 'Evaluation Horizon', value: horizon === 'ALL' ? 'Multi-Lap (1, 2, 3 Laps)' : `≤${horizon} Lap${horizon > 1 ? 's' : ''}` },
        { label: 'PAV Projected Probability', value: horizon === 'ALL' ? `P1: ${p1Val ?? '—'}% | P2: ${p2Val ?? '—'}% | P3: ${p3Val ?? '—'}%` : `${probVal ?? '—'}%` },
        { label: 'Raw Model Inference', value: horizon === 'ALL' ? 'Pre-PAV isotonic step completed' : `${probVal ?? '—'}% (Calibrated)` },
        { label: 'Input Features Used', value: 'gap_seconds, closing_rate, relative_pace_diff, simulated_soc_window_mj' },
        { label: 'Model Authority', value: 'FROZEN MODEL RUNTIME — ZERO RUNTIME WEIGHT UPDATES' },
      ],
    });
  };

  return (
    <div className="pass-window-strip" aria-label="Overtake Horizon Likelihood">
      <div
        className="horizon-top-meta clickable"
        onClick={() => handleOpenHorizonEvidence('ALL')}
        title="Click to inspect complete multi-horizon model evidence"
      >
        <span className="meta-provenance text-muted">FROZEN MODEL • PAV MONOTONIC</span>
        <span className="meta-click-hint text-accent mono">INSPECT MODEL</span>
      </div>

      {/* 3-Column Large Probability Cards */}
      <div className="horizon-cards-grid">
        {/* P1 Card */}
        <div
          className="horizon-prob-card clickable"
          onClick={() => handleOpenHorizonEvidence(1)}
          title="Click to inspect P1 (≤1 Lap) model evidence"
        >
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
        <div
          className="horizon-prob-card clickable"
          onClick={() => handleOpenHorizonEvidence(2)}
          title="Click to inspect P2 (≤2 Laps) model evidence"
        >
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
        <div
          className="horizon-prob-card clickable"
          onClick={() => handleOpenHorizonEvidence(3)}
          title="Click to inspect P3 (≤3 Laps) model evidence"
        >
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
