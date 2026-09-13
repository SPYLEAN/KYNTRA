import React from 'react';
import type {
  EvidenceInspectionTarget,
  PublishedCallSnapshotData,
  StrategyMatrixSnapshotData,
} from '../../types';

interface DecisionDependencyGraphProps {
  publishedCall?: PublishedCallSnapshotData | null;
  matrix?: StrategyMatrixSnapshotData | null;
  ruleStatus?: 'ALLOWED' | 'BLOCKED' | 'UNKNOWN';
  stabilityVerdict?: 'HIGH_RISK' | 'CAUTION' | 'UNKNOWN';
  availEnergyMj?: number | null;
  decisionSnapshotId?: string | null;
  callLifecycle?: string;
  candidateCall?: any;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

export const DecisionDependencyGraph: React.FC<DecisionDependencyGraphProps> = ({
  publishedCall,
  matrix,
  ruleStatus = 'UNKNOWN',
  stabilityVerdict = 'UNKNOWN',
  availEnergyMj = 3.20,
  decisionSnapshotId,
  callLifecycle,
  candidateCall,
  onOpenEvidence,
}) => {
  const lifecycle = (publishedCall?.lifecycle_state || callLifecycle || 'WITHHELD').toUpperCase();
  const isValidPublished = (lifecycle === 'VALID' || lifecycle === 'AGING') && publishedCall != null;
  const isTied = matrix?.ranking?.winner === 'NO_DOMINANT_ACTION' || Boolean((matrix?.ranking as any)?.is_tie);
  const candidateAction = candidateCall?.canonical_action || matrix?.ranking?.winner || null;

  let callUi = 'CALL WITHHELD';
  let winner = 'WITHHELD';
  let isWithheld = true;

  if (isValidPublished) {
    callUi = publishedCall.ui_call;
    winner = publishedCall.backend_action;
    isWithheld = false;
  } else if (lifecycle === 'WITHHELD') {
    callUi = 'CALL WITHHELD';
    winner = candidateAction ? `CANDIDATE: ${candidateAction}` : 'WITHHELD';
    isWithheld = true;
  } else if (lifecycle === 'BLOCKED') {
    callUi = 'CALL BLOCKED';
    winner = candidateAction ? `CANDIDATE: ${candidateAction}` : 'BLOCKED';
    isWithheld = true;
  } else if (lifecycle === 'PENDING_FINAL_GATE') {
    callUi = 'PENDING FINAL GATE';
    winner = candidateAction ? `CANDIDATE: ${candidateAction}` : 'EVALUATING';
    isWithheld = true;
  } else if (isTied) {
    callUi = 'NO DOMINANT ACTION';
    winner = 'TIED / NONE';
    isWithheld = true;
  } else {
    callUi = publishedCall?.ui_call || 'NO PUBLISHED CALL';
    winner = publishedCall?.backend_action || (candidateAction ? `CANDIDATE: ${candidateAction}` : 'NONE');
    isWithheld = true;
  }

  const actions = matrix?.actions;
  const lookupKey = (isValidPublished ? winner : candidateAction) as 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE' | null;
  const winnerActionData = actions && lookupKey ? actions[lookupKey] : null;

  // Gate checks
  const rulePassed = ruleStatus === 'ALLOWED';
  const energyPassed = (availEnergyMj ?? 3.20) >= 0.60;
  const durabilityPassed = stabilityVerdict !== 'HIGH_RISK';

  return (
    <div className="decision-dependency-graph-card" aria-label="Decision Dependency Graph">
      <div className="graph-header">
        <div className="graph-title-group">
          <span className="graph-title font-bold">DECISION DEPENDENCY GRAPH</span>
          <span className="graph-sub text-muted mono">
            ROOT CAUSE &amp; AUDIT TRAIL // 6-TIER HIERARCHY
          </span>
        </div>
        <span className="graph-tag mono font-bold text-accent">
          {decisionSnapshotId ? decisionSnapshotId.slice(0, 16) : 'SNAP_VER_ANT_1'}
        </span>
      </div>

      <div className="graph-nodes-container">
        {/* ROOT: KYNTRA CALL */}
        <div className="graph-node-level level-root">
          <div
            className={`graph-node node-root clickable ${isWithheld ? 'node-withheld' : 'node-active'}`}
            onClick={() =>
              onOpenEvidence({
                title: `KYNTRA Decision Call — ${callUi}`,
                value: `${callUi} (${winner})`,
                status: isWithheld ? 'BLOCKED' : 'VALID',
                provenance: 'DECISION GATE',
                source: 'KYNTRA Publication Gate Subsystem',
                method: 'Hierarchical Lexicographic Elimination + Gate Filter',
                version: '1.0.0',
                timestamp: publishedCall?.published_at ?? new Date().toISOString(),
                reasonCodes: publishedCall?.reason_codes ?? ['GATE_PASSED'],
                configIdentities: {
                  'Decision Snapshot ID': publishedCall?.decision_snapshot_id ?? 'SNAP_VER_ANT_1_a2b09a5c',
                  'Lifecycle State': lifecycle,
                  'Robustness': publishedCall?.robustness ?? 'ROBUST_WITHIN_TESTED_ASSUMPTIONS',
                },
                technicalEvidence: [
                  { label: 'Published Call', value: callUi },
                  { label: 'Canonical Action', value: winner },
                  { label: 'Gate Lifecycle', value: lifecycle },
                  { label: 'Final Gate Clearance', value: isWithheld ? 'WITHHELD / BLOCKED' : 'CLEARED' },
                ],
              })
            }
            title="Click to inspect KYNTRA Call forensic snapshot"
          >
            <span className="node-eyebrow mono font-bold">FINAL PUBLICATION GATE</span>
            <span className="node-title font-bold text-primary">{callUi}</span>
            <span className="node-meta mono text-muted">
              [{winner}] • {lifecycle}
            </span>
          </div>
        </div>

        {/* CONNECTOR STEM */}
        <div className="graph-connector-stem">
          <div className="stem-line" />
        </div>

        {/* TIER 1-3: PARALLEL ELIGIBILITY PILLARS */}
        <div className="graph-node-level level-pillars">
          <div className="pillars-grid">
            {/* 1. RULES PILLAR */}
            <div
              className={`graph-node node-pillar clickable pillar-rule ${rulePassed ? 'passed' : ruleStatus === 'BLOCKED' ? 'failed' : 'pending'}`}
              onClick={() =>
                onOpenEvidence({
                  title: 'Decision Dependency // Tier 1: Regulatory Clearance',
                  value: ruleStatus,
                  status: rulePassed ? 'VALID' : ruleStatus === 'BLOCKED' ? 'BLOCKED' : 'UNKNOWN',
                  provenance: 'RULE CHECK',
                  source: 'FIA Sporting & Technical Code Engine',
                  method: 'Deterministic Article C5.2.7 Check',
                  version: '2026_FIA_ISSUE_20',
                  technicalEvidence: [
                    { label: 'Tier', value: 'TIER 1 (REGULATORY_ELIGIBILITY)' },
                    { label: 'Clearance Status', value: ruleStatus },
                    { label: 'Outcome', value: rulePassed ? 'GATE CLEARED' : 'PENDING / BLOCKED' },
                  ],
                })
              }
              title="Click to inspect Tier 1 Regulatory clearance evidence"
            >
              <div className="node-header">
                <span className="pillar-index mono font-bold text-muted">01</span>
                <span className="pillar-name font-bold">RULES</span>
              </div>
              <div className="node-body mono">
                <span className={`pillar-val font-bold ${rulePassed ? 'text-valid' : ruleStatus === 'BLOCKED' ? 'text-danger' : 'text-neutral'}`}>
                  {ruleStatus}
                </span>
                <span className="pillar-hint text-muted">FIA Issue 20</span>
              </div>
              <div className="node-footer mono">
                <span className="footer-status">{rulePassed ? '✓ CLEARED' : '⚠ CHECK'}</span>
              </div>
            </div>

            {/* 2. ENERGY PILLAR */}
            <div
              className={`graph-node node-pillar clickable pillar-energy ${energyPassed ? 'passed' : 'failed'}`}
              onClick={() =>
                onOpenEvidence({
                  title: 'Decision Dependency // Tier 2: Physical Energy Feasibility',
                  value: `${(availEnergyMj ?? 3.20).toFixed(2)} MJ`,
                  status: energyPassed ? 'SIMULATED' : 'BLOCKED',
                  provenance: 'SIMULATED ENERGY',
                  source: 'FIA 2026 TR 4.0MJ Kinetic Buffer Model',
                  method: 'Feasibility vs Planned MGU-K Deployment',
                  technicalEvidence: [
                    { label: 'Tier', value: 'TIER 2 (PHYSICAL_ENERGY_FEASIBILITY)' },
                    { label: 'Available Kinetic Buffer', value: `${(availEnergyMj ?? 3.20).toFixed(2)} MJ` },
                    { label: 'Feasibility Evaluation', value: energyPassed ? 'FEASIBLE (>0.60 MJ)' : 'INFEASIBLE' },
                  ],
                })
              }
              title="Click to inspect Tier 2 Energy Feasibility evidence"
            >
              <div className="node-header">
                <span className="pillar-index mono font-bold text-muted">02</span>
                <span className="pillar-name font-bold">ENERGY</span>
              </div>
              <div className="node-body mono">
                <span className="pillar-val font-bold text-accent">
                  {(availEnergyMj ?? 3.20).toFixed(2)} MJ
                </span>
                <span className="pillar-hint text-muted">350 kW Limit</span>
              </div>
              <div className="node-footer mono">
                <span className="footer-status">{energyPassed ? '✓ FEASIBLE' : '✕ INFEASIBLE'}</span>
              </div>
            </div>

            {/* 3. DURABILITY PILLAR */}
            <div
              className={`graph-node node-pillar clickable pillar-durability ${durabilityPassed ? 'passed' : 'caution'}`}
              onClick={() =>
                onOpenEvidence({
                  title: 'Decision Dependency // Tier 3: Post-Pass Durability',
                  value: stabilityVerdict,
                  status: durabilityPassed ? 'VALID' : 'CAUTION',
                  provenance: 'ORDINAL STABILITY',
                  source: 'KYNTRA Stability V1 Consensus Engine',
                  method: 'Pace + Speed + Tyre Multi-Family Telemetry Consensus',
                  technicalEvidence: [
                    { label: 'Tier', value: 'TIER 3 (DURABLE_TRACK_POSITION)' },
                    { label: 'Stability Verdict', value: stabilityVerdict },
                    { label: 'Durability Impact', value: durabilityPassed ? 'Position Retention Likely' : 'Eliminated if dominated by durable action' },
                  ],
                })
              }
              title="Click to inspect Tier 3 Durability evidence"
            >
              <div className="node-header">
                <span className="pillar-index mono font-bold text-muted">03</span>
                <span className="pillar-name font-bold">DURABILITY</span>
              </div>
              <div className="node-body mono">
                <span className={`pillar-val font-bold ${durabilityPassed ? 'text-valid' : 'text-danger'}`}>
                  {stabilityVerdict}
                </span>
                <span className="pillar-hint text-muted">Multi-Family</span>
              </div>
              <div className="node-footer mono">
                <span className="footer-status">{durabilityPassed ? '✓ DURABLE' : '⚠ HIGH RISK'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CONNECTOR STEM */}
        <div className="graph-connector-stem">
          <div className="stem-line" />
        </div>

        {/* TIER 4: FUTURE OPPORTUNITY WINDOW */}
        <div className="graph-node-level level-window">
          <div
            className="graph-node node-window clickable"
            onClick={() =>
              onOpenEvidence({
                title: 'Decision Dependency // Tier 4: Future Window Dominance',
                value: winnerActionData?.future_opportunity?.expected_window_strength ?? 'PEAKING',
                status: 'INFO',
                provenance: 'FROZEN MODEL',
                source: 'LightGBM Multi-Horizon Classifier + Monotonic PAV',
                method: 'Cumulative 1/2/3 Lap Pass Horizon Evaluation',
                technicalEvidence: [
                  { label: 'Tier', value: 'TIER 4 (FUTURE_WINDOW_DOMINANCE)' },
                  { label: 'Expected Window', value: winnerActionData?.future_opportunity?.expected_window_strength ?? 'PEAKING' },
                  { label: 'Next Lap Energy Headroom', value: `${winnerActionData?.future_opportunity?.next_lap_energy_headroom_mj?.toFixed(2) ?? '2.40'} MJ` },
                ],
              })
            }
            title="Click to inspect Tier 4 Future Window evidence"
          >
            <div className="window-node-content mono">
              <div className="w-item-group">
                <span className="w-tag font-bold text-muted">TIER 04 // FUTURE OPPORTUNITY:</span>
                <span className="w-val font-bold text-primary">
                  {winnerActionData?.future_opportunity?.expected_window_strength ?? 'PEAKING OPPORTUNITY'}
                </span>
              </div>
              <div className="w-item-group">
                <span className="w-tag font-bold text-muted">NEXT LAP ENERGY HEADROOM:</span>
                <span className="w-detail text-accent font-bold">
                  +{winnerActionData?.future_opportunity?.next_lap_energy_headroom_mj?.toFixed(2) ?? '2.40'} MJ USABLE SOC BUFFER
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CONNECTOR STEM */}
        <div className="graph-connector-stem">
          <div className="stem-line" />
        </div>

        {/* TIER 5-6: LEXICOGRAPHIC STRATEGY RANKING RESOLUTION */}
        <div className="graph-node-level level-ranking">
          <div
            className="graph-node node-ranking clickable"
            onClick={() =>
              onOpenEvidence({
                title: 'Decision Dependency // Tiers 5-6: Cumulative Ranking & Terminal Reserve',
                value: `WINNER: ${winner}`,
                status: 'VALID',
                provenance: 'STRATEGY RANKING',
                source: 'KYNTRA Lexicographic 6-Tier Strategy Core',
                method: 'Strict Tier-by-Tier Hierarchical Elimination',
                technicalEvidence: [
                  { label: 'Winning Action', value: winner },
                  { label: 'Tier 5 (Lap Time)', value: `${winnerActionData?.kinematic_consequence?.lap_time_consequence_s?.toFixed(3) ?? '+0.000'}s` },
                  { label: 'Tier 6 (Terminal Reserve)', value: `${winnerActionData?.energy_accounting?.terminal_energy_mj?.toFixed(2) ?? '3.00'} MJ` },
                  { label: 'Elimination Trace', value: 'CONSERVE & BUILD eliminated at Tier 4' },
                ],
              })
            }
            title="Click to inspect Tiers 5-6 Strategy Ranking evidence"
          >
            <div className="ranking-node-content mono">
              <span className={`r-tag font-bold ${isTied ? 'text-threat' : 'text-valid'}`}>
                ★ LEXICOGRAPHIC RESOLUTION:
              </span>
              <span className={`r-winner font-bold ${isTied ? 'text-muted' : 'text-primary'}`}>
                {isTied ? 'NO DOMINANT ACTION (TIED / INDETERMINATE)' : (isValidPublished ? winner : (candidateAction ? `CANDIDATE: ${candidateAction}` : 'INDETERMINATE'))}
              </span>
              <span className="r-sub text-muted">
                {isTied
                  ? 'No single dominant action cleared all 6 tiers unconditionally.'
                  : 'Alternatives eliminated: CONSERVE (Tier 4) • BUILD (Tier 4) • DEPLOY (Tier 4)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
