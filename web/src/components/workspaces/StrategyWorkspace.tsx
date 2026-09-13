import React from 'react';
import type { DecisionSnapshot, EvidenceInspectionTarget } from '../../types';
import { HeroStrategyMatrix } from '../race/HeroStrategyMatrix';
import { RobustnessPanel } from '../race/RobustnessPanel';
import { KyntraCallPanel } from '../race/KyntraCallPanel';
import { WhyWhyNotPanel } from '../race/WhyWhyNotPanel';
import { DecisionDependencyGraph } from '../race/DecisionDependencyGraph';

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
  const whySelected = publishedCall?.why_selected || candidateCall?.why_selected || [];
  const whyNot = publishedCall?.why_not || candidateCall?.why_not || {};

  const ruleStatus = decision?.compliance?.status === 'LEGAL'
    ? 'ALLOWED'
    : (decision?.compliance?.status as 'ALLOWED' | 'BLOCKED' | 'UNKNOWN') || 'UNKNOWN';

  const stabilityVerdict = decision?.stability?.verdict === 'FAVORABLE'
    ? 'UNKNOWN'
    : (decision?.stability?.verdict as 'HIGH_RISK' | 'CAUTION' | 'UNKNOWN') || 'UNKNOWN';

  const availEnergyMj = decision?.energy?.available_energy_mj ?? fairBaseline['attacker_energy_mj'] ?? 3.20;

  return (
    <div className="workspace-strategy-container mono">
      {/* Top Strategic Overview Bar */}
      <div className="strategy-top-header">
        <div className="header-text-group">
          <span className="eyebrow-tag text-accent font-bold">STRATEGY OS</span>
          <h2 className="header-title font-bold">
            STRATEGIST MATRIX &amp; LEXICOGRAPHIC RANKING
          </h2>
          <p className="header-sub text-muted">
            Evaluating 4 canonical actions (SAVE ENERGY, PREPARE, APPLY PRESSURE, OVERTAKE NOW) with 6-tier lexicographic ranking.
          </p>
        </div>
      </div>

      {/* Main Strategy Grid */}
      <div className="strategy-main-layout">
        {/* Left Column: Call Banner + Dependency Graph + Robustness + Fair Baseline + Why/Why Not */}
        <div className="strategy-side-column">
          <KyntraCallPanel
            publishedCall={publishedCall}
            callLifecycle={callLifecycle}
            candidateCall={candidateCall}
            decisionSnapshotId={decision?.decision_id}
            onOpenEvidence={onOpenEvidence}
          />

          <DecisionDependencyGraph
            publishedCall={publishedCall}
            matrix={matrix}
            ruleStatus={ruleStatus}
            stabilityVerdict={stabilityVerdict}
            availEnergyMj={availEnergyMj}
            decisionSnapshotId={decision?.decision_id}
            callLifecycle={callLifecycle}
            candidateCall={candidateCall}
            onOpenEvidence={onOpenEvidence}
          />

          <WhyWhyNotPanel
            whySelected={whySelected}
            whyNot={whyNot}
            ruleStatus={ruleStatus}
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
                  <td className="val-col font-bold">
                    {fairBaseline['attacker_energy_mj'] != null
                      ? `${fairBaseline['attacker_energy_mj'].toFixed(2)} MJ`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="key-col text-muted">Temporal Gap</td>
                  <td className="val-col font-bold">
                    {fairBaseline['gap_seconds'] != null
                      ? `${fairBaseline['gap_seconds'].toFixed(2)}s`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="key-col text-muted">Closing Rate</td>
                  <td className="val-col">
                    {fairBaseline['closing_rate'] != null
                      ? `${fairBaseline['closing_rate'].toFixed(1)} m/s`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="key-col text-muted">Evaluation Timestamp</td>
                  <td className="val-col text-accent">
                    {matrix?.evaluation_timestamp
                      ? new Date(matrix.evaluation_timestamp).toLocaleTimeString()
                      : '—'}
                  </td>
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
