import React from 'react';
import type { DecisionSnapshot, EvidenceInspectionTarget } from '../../types';
import { HeroStrategyMatrix } from '../race/HeroStrategyMatrix';
import { RobustnessPanel } from '../race/RobustnessPanel';
import { KyntraCallPanel } from '../race/KyntraCallPanel';

interface StrategyWorkspaceProps {
  decision: DecisionSnapshot | null;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

export const StrategyWorkspace: React.FC<StrategyWorkspaceProps> = ({
  decision,
  onOpenEvidence,
}) => {
  const matrix = (decision?.strategy_matrix as any) || null;
  const publishedCall = (decision?.published_call as any) || null;
  const candidateCall = (decision?.recommendation as any) || null;
  const callLifecycle = publishedCall?.lifecycle_state || 'WITHHELD';

  const fairBaseline = matrix?.fair_baseline || {};

  return (
    <div className="workspace-strategy-container mono">
      {/* Top Strategic Overview Bar */}
      <div className="strategy-top-header">
        <div className="header-text-group">
          <span className="eyebrow-tag text-accent font-bold">TACTICAL STRATEGY BRAIN</span>
          <h2 className="header-title font-bold">
            STRATEGIST MATRIX &amp; LEXICOGRAPHIC RANKING DEEP DIVE
          </h2>
          <p className="header-sub text-muted">
            Evaluating 4 candidate actions (CONSERVE, BUILD, DEPLOY, OVERTAKE) from an identical, synchronized source state.
          </p>
        </div>
      </div>

      {/* Main Strategy Grid */}
      <div className="strategy-main-layout">
        {/* Left Column: Call Banner + Robustness + Fair Baseline */}
        <div className="strategy-side-column">
          <KyntraCallPanel
            publishedCall={publishedCall}
            callLifecycle={callLifecycle}
            candidateCall={candidateCall}
            decisionSnapshotId={decision?.decision_id}
            onOpenEvidence={onOpenEvidence}
          />

          <RobustnessPanel
            scenarioWinners={publishedCall?.scenario_winners || candidateCall?.scenario_winners}
            robustnessVerdict={publishedCall?.robustness || candidateCall?.robustness}
            onClickEvidence={() =>
              onOpenEvidence({
                title: 'Scenario Robustness Sensitivity',
                value: publishedCall?.robustness || 'ROBUST WITHIN TESTED ASSUMPTIONS',
                status: 'VALID',
                provenance: 'DERIVED',
                method: '3-Scenario Assumption Sensitivity Sweep',
              })
            }
          />

          {/* Fair Baseline Card */}
          <div className="fair-baseline-card">
            <div className="card-header font-bold">FAIR BASELINE PRECONDITIONS</div>
            <table className="dense-keyvalue-table">
              <tbody>
                <tr>
                  <td className="key-col text-muted">Attacker Starting Energy</td>
                  <td className="val-col font-bold">{fairBaseline['attacker_energy_mj'] ? `${fairBaseline['attacker_energy_mj'].toFixed(2)} MJ` : '3.20 MJ'}</td>
                </tr>
                <tr>
                  <td className="key-col text-muted">Temporal Gap</td>
                  <td className="val-col font-bold">{fairBaseline['gap_seconds'] ? `${fairBaseline['gap_seconds'].toFixed(2)}s` : '—'}</td>
                </tr>
                <tr>
                  <td className="key-col text-muted">Closing Rate</td>
                  <td className="val-col">{fairBaseline['closing_rate'] ? `${fairBaseline['closing_rate'].toFixed(1)} m/s` : '0.0 m/s'}</td>
                </tr>
                <tr>
                  <td className="key-col text-muted">Evaluation Timestamp</td>
                  <td className="val-col text-accent">{matrix?.evaluation_timestamp ? new Date(matrix.evaluation_timestamp).toLocaleTimeString() : 'LIVE'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Full Hero Strategy Matrix */}
        <div className="strategy-matrix-column">
          <HeroStrategyMatrix
            matrix={matrix}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      </div>
    </div>
  );
};
