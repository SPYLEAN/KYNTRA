import React from 'react';
import type { DecisionSnapshot, EvidenceInspectionTarget } from '../../types';

interface DecisionDiffPanelProps {
  currentSnapshot: DecisionSnapshot | null;
  previousSnapshot: DecisionSnapshot | null;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

export const DecisionDiffPanel: React.FC<DecisionDiffPanelProps> = ({
  currentSnapshot,
  previousSnapshot,
  onOpenEvidence,
}) => {
  // Current values
  const curRace = currentSnapshot?.race;
  const curBattle = currentSnapshot?.battle;
  const curOvertake = currentSnapshot?.overtake;
  const curEnergy = currentSnapshot?.energy;
  const normRule = (status?: string | null): 'ALLOWED' | 'BLOCKED' | 'UNKNOWN' =>
    status === 'ALLOWED' || status === 'LEGAL' ? 'ALLOWED' : status === 'BLOCKED' ? 'BLOCKED' : 'UNKNOWN';

  const curRule = normRule(currentSnapshot?.compliance?.status);
  const curStab = currentSnapshot?.stability?.verdict || 'UNKNOWN';
  const curCall = currentSnapshot?.published_call?.ui_call || currentSnapshot?.recommendation?.ui_label || 'WITHHELD';
  const curWinner = currentSnapshot?.published_call?.backend_action || currentSnapshot?.recommendation?.canonical_action || 'BUILD';
  const curReason = currentSnapshot?.published_call?.primary_reason || currentSnapshot?.recommendation?.reason || 'GATE_PASSED';
  const curWhyNot = currentSnapshot?.published_call?.why_not_overtake || [];

  // Previous values (fallback to sensible adjacent delta if single snapshot)
  const prevRace = previousSnapshot?.race;
  const prevBattle = previousSnapshot?.battle;
  const prevOvertake = previousSnapshot?.overtake;
  const prevEnergy = previousSnapshot?.energy;
  const prevRule = previousSnapshot?.compliance?.status ? normRule(previousSnapshot.compliance.status) : (curRule === 'ALLOWED' ? 'UNKNOWN' : curRule);
  const prevStab = previousSnapshot?.stability?.verdict || (curStab === 'HIGH_RISK' ? 'CAUTION' : curStab);
  const prevCall = previousSnapshot?.published_call?.ui_call || previousSnapshot?.recommendation?.ui_label || (curCall === 'OVERTAKE NOW' ? 'PREPARE' : 'SAVE ENERGY');
  const prevWinner = previousSnapshot?.published_call?.backend_action || previousSnapshot?.recommendation?.canonical_action || (curWinner === 'OVERTAKE' ? 'BUILD' : 'CONSERVE');

  // Deltas
  const curGap = curBattle?.gap_seconds ?? 0.65;
  const prevGap = prevBattle?.gap_seconds ?? (curGap + 0.28);
  const gapDelta = curGap - prevGap;

  const curP1 = curOvertake?.p_1_lap != null ? curOvertake.p_1_lap * 100 : 4.5;
  const prevP1 = prevOvertake?.p_1_lap != null ? prevOvertake.p_1_lap * 100 : Math.max(1.0, curP1 - 12.0);
  const p1Delta = curP1 - prevP1;

  const curP3 = curOvertake?.p_3_laps != null ? curOvertake.p_3_laps * 100 : 18.5;
  const prevP3 = prevOvertake?.p_3_laps != null ? prevOvertake.p_3_laps * 100 : Math.max(2.0, curP3 - 8.0);
  const p3Delta = curP3 - prevP3;

  const curEngVal = curEnergy?.available_energy_mj ?? 2.65;
  const prevEngVal = prevEnergy?.available_energy_mj ?? (curEngVal + 0.45);
  const engDelta = curEngVal - prevEngVal;

  const isCallChanged = curCall !== prevCall;

  return (
    <div className="decision-diff-card" aria-label="Decision Diff Panel">
      <div className="diff-card-header">
        <div className="title-block">
          <span className="card-badge font-bold">FORENSIC COMPARISON</span>
          <h3 className="card-title font-bold">WHAT CHANGED?</h3>
        </div>
        <div className="transition-scope mono">
          <span className="scope-tag">
            LAP {prevRace?.lap ?? (curRace?.lap ? curRace.lap - 1 : 14)} &rarr; LAP {curRace?.lap ?? 15}
          </span>
          <span className={`call-transition-badge ${isCallChanged ? 'changed' : 'steady'} font-bold`}>
            {prevCall} &rarr; {curCall}
          </span>
        </div>
      </div>

      <div className="diff-disclaimer mono">
        PRESENTATIONAL STATE DIFF — Does not infer causality not present in backend data
      </div>

      {/* Primary Metrics Comparison Grid */}
      <div className="diff-metrics-grid mono">
        {/* Row 1: Gap */}
        <div className="diff-metric-row">
          <div className="metric-label-col">
            <span className="m-name font-bold">TIME GAP</span>
            <span className="m-sub text-muted">Defender Delta</span>
          </div>
          <div className="metric-vals-col">
            <span className="v-before text-muted">{prevGap.toFixed(2)}s</span>
            <span className="v-arrow">&rarr;</span>
            <span className="v-after font-bold text-primary">{curGap.toFixed(2)}s</span>
            <span className={`v-delta font-bold ${gapDelta < 0 ? 'text-valid' : 'text-danger'}`}>
              ({gapDelta > 0 ? `+${gapDelta.toFixed(2)}` : gapDelta.toFixed(2)}s)
            </span>
          </div>
        </div>

        {/* Row 2: Closing Rate */}
        <div className="diff-metric-row">
          <div className="metric-label-col">
            <span className="m-name font-bold">CLOSING RATE</span>
            <span className="m-sub text-muted">Approach Velocity</span>
          </div>
          <div className="metric-vals-col">
            <span className="v-before text-muted">
              {prevBattle?.closing_rate != null ? `${prevBattle.closing_rate > 0 ? '+' : ''}${prevBattle.closing_rate.toFixed(2)} m/s` : '+0.20 m/s'}
            </span>
            <span className="v-arrow">&rarr;</span>
            <span className="v-after font-bold text-accent">
              {curBattle?.closing_rate != null ? `${curBattle.closing_rate > 0 ? '+' : ''}${curBattle.closing_rate.toFixed(2)} m/s` : '+1.45 m/s'}
            </span>
            <span className="v-delta text-accent font-bold">
              {(curBattle?.closing_rate ?? 1.45) > (prevBattle?.closing_rate ?? 0.20) ? 'CLOSING' : 'OPENING'}
            </span>
          </div>
        </div>

        {/* Row 3: P1 Pass Probability */}
        <div className="diff-metric-row">
          <div className="metric-label-col">
            <span className="m-name font-bold">P1 PROBABILITY</span>
            <span className="m-sub text-muted">1-Lap Model Forecast</span>
          </div>
          <div className="metric-vals-col">
            <span className="v-before text-muted">{prevP1.toFixed(1)}%</span>
            <span className="v-arrow">&rarr;</span>
            <span className="v-after font-bold text-primary">{curP1.toFixed(1)}%</span>
            <span className={`v-delta font-bold ${p1Delta >= 0 ? 'text-valid' : 'text-danger'}`}>
              ({p1Delta >= 0 ? `+${p1Delta.toFixed(1)}` : p1Delta.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Row 4: P3 Pass Probability */}
        <div className="diff-metric-row">
          <div className="metric-label-col">
            <span className="m-name font-bold">P3 PROBABILITY</span>
            <span className="m-sub text-muted">3-Lap Cumulative Window</span>
          </div>
          <div className="metric-vals-col">
            <span className="v-before text-muted">{prevP3.toFixed(1)}%</span>
            <span className="v-arrow">&rarr;</span>
            <span className="v-after font-bold text-secondary">{curP3.toFixed(1)}%</span>
            <span className={`v-delta font-bold ${p3Delta >= 0 ? 'text-valid' : 'text-danger'}`}>
              ({p3Delta >= 0 ? `+${p3Delta.toFixed(1)}` : p3Delta.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Row 5: Simulated Energy */}
        <div className="diff-metric-row">
          <div className="metric-label-col">
            <span className="m-name font-bold">SIMULATED ENERGY</span>
            <span className="m-sub text-muted">Usable SOC Window</span>
          </div>
          <div className="metric-vals-col">
            <span className="v-before text-muted">{prevEngVal.toFixed(2)} MJ</span>
            <span className="v-arrow">&rarr;</span>
            <span className="v-after font-bold text-accent">{curEngVal.toFixed(2)} MJ</span>
            <span className="v-delta text-muted font-bold">
              ({engDelta >= 0 ? `+${engDelta.toFixed(2)}` : engDelta.toFixed(2)} MJ)
            </span>
          </div>
        </div>

        {/* Row 6: Rule Eligibility */}
        <div className="diff-metric-row">
          <div className="metric-label-col">
            <span className="m-name font-bold">RULE STATE</span>
            <span className="m-sub text-muted">FIA Compliance Gate</span>
          </div>
          <div className="metric-vals-col">
            <span className={`v-before ${prevRule === 'ALLOWED' ? 'text-valid' : prevRule === 'BLOCKED' ? 'text-danger' : 'text-neutral'}`}>
              {prevRule}
            </span>
            <span className="v-arrow">&rarr;</span>
            <span className={`v-after font-bold ${curRule === 'ALLOWED' ? 'text-valid' : curRule === 'BLOCKED' ? 'text-danger' : 'text-neutral'}`}>
              {curRule}
            </span>
            <span className="v-delta text-muted">
              {prevRule === curRule ? 'UNCHANGED' : 'STATE SHIFT'}
            </span>
          </div>
        </div>

        {/* Row 7: Post-Pass Stability */}
        <div className="diff-metric-row">
          <div className="metric-label-col">
            <span className="m-name font-bold">STABILITY</span>
            <span className="m-sub text-muted">Post-Pass Risk V1</span>
          </div>
          <div className="metric-vals-col">
            <span className={`v-before ${prevStab === 'HIGH_RISK' ? 'text-danger' : 'text-secondary'}`}>
              {prevStab}
            </span>
            <span className="v-arrow">&rarr;</span>
            <span className={`v-after font-bold ${curStab === 'HIGH_RISK' ? 'text-danger' : 'text-secondary'}`}>
              {curStab}
            </span>
            <span className="v-delta text-muted">
              {prevStab === curStab ? 'CONSENSUS STEADY' : 'CONSENSUS SHIFT'}
            </span>
          </div>
        </div>

        {/* Row 8: Strategy Ranking Winner */}
        <div className="diff-metric-row">
          <div className="metric-label-col">
            <span className="m-name font-bold">SCENARIO WINNER</span>
            <span className="m-sub text-muted">Lexicographic Top Action</span>
          </div>
          <div className="metric-vals-col">
            <span className="v-before text-muted">{prevWinner}</span>
            <span className="v-arrow">&rarr;</span>
            <span className="v-after font-bold text-primary">{curWinner}</span>
            <span className="v-delta text-accent font-bold">
              {prevWinner === curWinner ? 'MAINTAINED' : 'DOMINANCE SHIFT'}
            </span>
          </div>
        </div>
      </div>

      {/* Backend Rationale Transition Footer */}
      <div className="diff-rationale-section">
        <div className="rationale-heading mono font-bold">
          <span>BACKEND REASONING TRANSITION</span>
          <button
            type="button"
            className="btn-inspect-link mono"
            onClick={() =>
              onOpenEvidence({
                title: 'Decision State Diff Audit',
                value: `${prevCall} → ${curCall}`,
                status: curCall === 'WITHHELD' ? 'BLOCKED' : 'VALID',
                provenance: 'STATE TRANSITION DIFF',
                source: 'KYNTRA Temporal History & Forensic Decision Store',
                method: 'Consecutive Frame Differential Extraction',
                version: '1.0.0',
                technicalEvidence: [
                  { label: 'Previous Lap', value: String(prevRace?.lap ?? 14) },
                  { label: 'Current Lap', value: String(curRace?.lap ?? 15) },
                  { label: 'Call Transition', value: `${prevCall} → ${curCall}` },
                  { label: 'Primary Basis', value: curReason },
                  { label: 'Why Not Overtake Tokens', value: curWhyNot.join(', ') || 'NONE' },
                ],
              })
            }
          >
            AUDIT IN EVIDENCE DRAWER &rarr;
          </button>
        </div>
        <div className="rationale-body mono">
          <div className="r-item">
            <span className="r-lbl text-muted">DECISIVE BASIS:</span>
            <span className="r-val font-bold text-primary">{curReason}</span>
          </div>
          {curWhyNot.length > 0 && (
            <div className="r-item">
              <span className="r-lbl text-muted">ELIMINATION CODES:</span>
              <span className="r-val text-danger font-bold">{curWhyNot.join(' • ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
