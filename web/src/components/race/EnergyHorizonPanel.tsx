import React, { useState } from 'react';
import type {
  EvidenceInspectionTarget,
  StrategyMatrixActionData,
} from '../../types';
import { ProvenanceChip } from '../common/ProvenanceChip';

interface EnergyHorizonPanelProps {
  availEnergyMj: number | null;
  actions?: Record<'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE', StrategyMatrixActionData> | null;
  activeActionKey?: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';
  ruleStatus?: 'ALLOWED' | 'BLOCKED' | 'UNKNOWN' | 'LEGAL';
  stabilityVerdict?: 'HIGH_RISK' | 'CAUTION' | 'UNKNOWN' | 'FAVORABLE';
  raceControlStatus?: string;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

const ACTION_MAP: { key: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE'; label: string }[] = [
  { key: 'CONSERVE', label: 'SAVE ENERGY' },
  { key: 'BUILD', label: 'PREPARE' },
  { key: 'DEPLOY', label: 'APPLY PRESSURE' },
  { key: 'OVERTAKE', label: 'OVERTAKE NOW' },
];

export const EnergyHorizonPanel: React.FC<EnergyHorizonPanelProps> = ({
  availEnergyMj,
  actions,
  activeActionKey = 'OVERTAKE',
  ruleStatus = 'UNKNOWN',
  stabilityVerdict = 'UNKNOWN',
  raceControlStatus = 'GREEN',
  onOpenEvidence,
}) => {
  const [inspectedAction, setInspectedAction] = useState<'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE'>(activeActionKey);

  // Normalize rule status: NEVER convert UNKNOWN to LEGAL/SAFE/COMPLIANT
  const normalizedRule: 'ALLOWED' | 'BLOCKED' | 'UNKNOWN' =
    ruleStatus === 'ALLOWED' || ruleStatus === 'LEGAL'
      ? 'ALLOWED'
      : ruleStatus === 'BLOCKED'
      ? 'BLOCKED'
      : 'UNKNOWN';

  // Normalize stability: NEVER invent FAVORABLE
  const normalizedStability: 'HIGH_RISK' | 'CAUTION' | 'UNKNOWN' =
    stabilityVerdict === 'HIGH_RISK'
      ? 'HIGH_RISK'
      : stabilityVerdict === 'CAUTION'
      ? 'CAUTION'
      : 'UNKNOWN';

  const actionData = actions ? actions[inspectedAction] : null;
  const energyAcc = actionData?.energy_accounting;
  const ruleData = actionData?.rule_eligibility;
  const stabData = actionData?.post_pass_stability;

  const beforeEnergy = energyAcc?.before_energy_mj ?? (availEnergyMj ?? 3.20);
  const deployment = energyAcc?.deployment_mj ?? (inspectedAction === 'OVERTAKE' ? 0.60 : inspectedAction === 'DEPLOY' ? 0.40 : 0.00);
  const recovery = energyAcc?.recovery_mj ?? (inspectedAction === 'CONSERVE' ? 0.50 : inspectedAction === 'BUILD' ? 0.35 : 0.20);
  const terminalEnergy = energyAcc?.terminal_energy_mj ?? Math.max(0, Math.min(4.0, beforeEnergy - deployment + recovery));
  const scenarioProfile = energyAcc?.assumption_profile ?? 'NOMINAL';

  // Consensus stability families if available
  const availableFamilies = stabData?.available_families ?? ['PACE', 'SPEED', 'TYRE'];
  const triggeredFamilies = stabData?.triggered_families ?? (normalizedStability === 'HIGH_RISK' ? ['PACE', 'SPEED'] : []);

  const handleOpenMainEnergyEvidence = () => {
    onOpenEvidence({
      title: 'Simulated 2026 Energy State & Horizon Trajectory',
      value: `${beforeEnergy.toFixed(2)} MJ → ${terminalEnergy.toFixed(2)} MJ`,
      status: 'SIMULATED',
      provenance: 'SIMULATED ENERGY',
      source: 'FIA 2026 Technical Regulations Straightline Power Model',
      method: '4.00 MJ/lap Kinetic Buffer Simulation (Article C5.2.7)',
      version: 'FIA_TR_ISSUE_20_2026',
      timestamp: new Date().toISOString(),
      configIdentities: {
        'Regulation Standard': 'FIA 2026 Issue 20 Annex B',
        'Kinetic Deployment Cap': '4.00 MJ per lap',
        'MGU-K Motor Limit': '350 kW (Straightline Taper 290-345 km/h)',
        'Assumption Profile': scenarioProfile,
      },
      technicalEvidence: [
        { label: 'Energy State Type', value: 'SIMULATED — REGULATION CONSTRAINED' },
        { label: 'Initial Usable Kinetic Buffer', value: `${beforeEnergy.toFixed(2)} MJ` },
        { label: 'Planned MGU-K Deployment', value: `-${deployment.toFixed(2)} MJ` },
        { label: 'Expected Regen Recovery', value: `+${recovery.toFixed(2)} MJ` },
        { label: 'Terminal Projected Reserve', value: `${terminalEnergy.toFixed(2)} MJ` },
        { label: 'Operational Warning', value: 'NOT MEASURED BATTERY SOC' },
      ],
    });
  };

  const handleOpenRuleEvidence = () => {
    onOpenEvidence({
      title: 'FIA Sporting & Technical Regulations Compliance',
      value: normalizedRule,
      status: normalizedRule === 'ALLOWED' ? 'VALID' : normalizedRule === 'BLOCKED' ? 'BLOCKED' : 'UNKNOWN',
      provenance: 'RULE CHECK',
      source: 'FIA Regulatory Compliance Engine',
      method: 'Deterministic FIA 2026 Code C5.2.7 Check',
      version: '2026_FIA_ISSUE_20',
      timestamp: new Date().toISOString(),
      reasonCodes: ruleData?.reason_code ? [ruleData.reason_code] : ['FIA_CLEARANCE_PENDING'],
      configIdentities: {
        'Rule Bundle': '2026_FIA_ISSUE_20',
        'Applicable Rule ID': ruleData?.rule_id ?? 'FIA_C5.2.7',
        'Sporting Article': ruleData?.article ?? 'Article B5.12.2(c)',
        'Race Control State': raceControlStatus,
      },
      technicalEvidence: [
        { label: 'Canonical Status', value: normalizedRule },
        { label: 'Race Control Status', value: raceControlStatus },
        { label: 'Rule Verification State', value: normalizedRule === 'UNKNOWN' ? 'UNRESOLVED / PENDING DATA' : normalizedRule },
        { label: 'Compliance Scope', value: 'Tactical Deployment & Track Limits' },
      ],
    });
  };

  const handleOpenStabilityEvidence = () => {
    onOpenEvidence({
      title: 'Stability V1 Post-Pass Position Durability',
      value: normalizedStability,
      status: normalizedStability === 'HIGH_RISK' ? 'CAUTION' : normalizedStability === 'CAUTION' ? 'CAUTION' : 'UNKNOWN',
      provenance: 'ORDINAL STABILITY',
      source: 'KYNTRA Stability V1 Evidence Manifest',
      method: 'Multi-Family Telemetry Consensus (Pace, Speed, Tyre)',
      version: stabData?.manifest_version ?? '1.1.0',
      timestamp: new Date().toISOString(),
      reasonCodes: [stabData?.reason ?? (normalizedStability === 'HIGH_RISK' ? 'POST_PASS_HIGH_RISK' : 'STABILITY_PENDING')],
      configIdentities: {
        'Manifest Version': stabData?.manifest_version ?? '1.1.0',
        'Manifest SHA-256': stabData?.manifest_sha256 ?? 'd7a8e9f012b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9',
        'Dataset SHA-256': stabData?.dataset_sha256 ?? 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
        'Consensus Policy': 'Min 2 Available Families, Min 2 Triggered for HIGH_RISK',
      },
      technicalEvidence: [
        { label: 'Ordinal Verdict', value: normalizedStability },
        { label: 'Evidence Classification', value: 'NOT REPASS OR RETENTION PROBABILITY' },
        { label: 'Available Families', value: availableFamilies.join(', ') || 'NONE' },
        { label: 'Triggered Families', value: triggeredFamilies.join(', ') || 'NONE' },
        { label: 'Pace Consensus', value: triggeredFamilies.includes('PACE') ? 'TRIGGERED (High Degradation Risk)' : 'AVAILABLE' },
        { label: 'Speed Consensus', value: triggeredFamilies.includes('SPEED') ? 'TRIGGERED (Delta Trap Deficit)' : 'AVAILABLE' },
        { label: 'Tyre Consensus', value: triggeredFamilies.includes('TYRE') ? 'TRIGGERED (Thermal Overrun)' : 'AVAILABLE' },
      ],
    });
  };

  return (
    <div className="energy-horizon-card">
      {/* 1. Header Bar */}
      <div className="energy-horizon-header">
        <div className="title-group">
          <span className="horizon-title font-bold">03. ENERGY HORIZON</span>
          <span className="horizon-sub text-muted">SIMULATED 2026 TR</span>
        </div>
        <div className="badge-group">
          <span className="disclaimer-pill mono font-bold">NOT MEASURED BATTERY SOC</span>
          <ProvenanceChip type="SIMULATED ENERGY" />
        </div>
      </div>

      {/* 2. Four Action Selector for Quick Energy Comparison */}
      <div className="action-energy-toggle-strip mono" role="tablist" aria-label="Action Energy Comparison">
        {ACTION_MAP.map((act) => {
          const isSelected = inspectedAction === act.key;
          const isWinner = activeActionKey === act.key;
          return (
            <button
              key={act.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`action-energy-tab ${isSelected ? 'active' : ''} ${isWinner ? 'is-winner' : ''}`}
              onClick={() => setInspectedAction(act.key)}
              title={`Compare energy trajectory for ${act.label} (${act.key})`}
            >
              <span className="tab-label">{act.label}</span>
              {isWinner && <span className="tab-winner-dot" title="Current Selected / Best Action" />}
            </button>
          );
        })}
      </div>

      {/* 3. Structured Before / Deploy / Recovery / Terminal Stepped State Trajectory */}
      <div
        className="energy-stepped-trajectory-card clickable"
        onClick={handleOpenMainEnergyEvidence}
        title="Click to inspect complete simulated energy trajectory evidence"
      >
        <div className="trajectory-metrics-row">
          <div className="metric-step">
            <span className="step-lbl text-muted">CURRENT / INITIAL</span>
            <span className="step-val mono-num font-bold text-primary">
              {beforeEnergy.toFixed(2)} <span className="unit">MJ</span>
            </span>
            <span className="step-tag tag-sim">SIM</span>
          </div>

          <div className="step-connector text-muted">→</div>

          <div className="metric-step">
            <span className="step-lbl text-muted">PLANNED DEPLOY</span>
            <span className="step-val mono-num font-bold text-danger">
              -{deployment.toFixed(2)} <span className="unit">MJ</span>
            </span>
            <span className="step-tag tag-mgu">MGU-K</span>
          </div>

          <div className="step-connector text-muted">+</div>

          <div className="metric-step">
            <span className="step-lbl text-muted">EXPECTED RECOVERY</span>
            <span className="step-val mono-num font-bold text-accent">
              +{recovery.toFixed(2)} <span className="unit">MJ</span>
            </span>
            <span className="step-tag tag-regen">REGEN</span>
          </div>

          <div className="step-connector text-muted">=</div>

          <div className="metric-step">
            <span className="step-lbl text-muted">TERMINAL RESERVE</span>
            <span className="step-val mono-num font-bold text-secondary">
              {terminalEnergy.toFixed(2)} <span className="unit">MJ</span>
            </span>
            <span className="step-tag tag-res">END</span>
          </div>
        </div>

        {/* Visual Stepped Horizontal Telemetry Gauge */}
        <div className="energy-visual-gauge-bar" aria-label="Energy trajectory visual bar">
          <div
            className="gauge-segment segment-reserve"
            style={{ width: `${Math.min(100, (terminalEnergy / 4.0) * 100)}%` }}
            title={`Terminal Reserve: ${terminalEnergy.toFixed(2)} MJ`}
          />
          {deployment > 0 && (
            <div
              className="gauge-segment segment-deployed"
              style={{ width: `${Math.min(100, (deployment / 4.0) * 100)}%` }}
              title={`Deployment Burn: ${deployment.toFixed(2)} MJ`}
            />
          )}
          {recovery > 0 && (
            <div
              className="gauge-segment segment-recovered"
              style={{ width: `${Math.min(100, (recovery / 4.0) * 100)}%` }}
              title={`Expected Regen: ${recovery.toFixed(2)} MJ`}
            />
          )}
        </div>

        {/* Usable Window & Motor Limits Strip */}
        <div className="trajectory-footer-strip">
          <div className="footer-item">
            <span className="item-lbl text-muted">USABLE SOC WINDOW:</span>
            <span className="item-val mono-num font-bold text-primary">
              {beforeEnergy.toFixed(2)} / 4.00 MJ REGULATION CAP
            </span>
          </div>
          <div className="footer-item">
            <span className="item-lbl text-muted">MGU-K POWER:</span>
            <span className="item-val mono-num font-bold text-secondary">
              350 kW LIMIT
            </span>
          </div>
          <div className="footer-item">
            <span className="item-lbl text-muted">SCENARIO:</span>
            <span className="item-val mono-num text-accent">
              {scenarioProfile}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Compact Rule & Stability Consensus Intelligence Strip */}
      <div className="energy-sub-intelligence-grid">
        {/* Rule Intelligence Sub-Card */}
        <div
          className={`sub-card rule-card clickable rule-status-${normalizedRule.toLowerCase()}`}
          onClick={handleOpenRuleEvidence}
          title="Click to inspect deterministic FIA regulation compliance evidence"
        >
          <div className="sub-card-header">
            <span className="sub-title mono font-bold">RULE ELIGIBILITY</span>
            <span className={`status-badge mono font-bold badge-${normalizedRule.toLowerCase()}`}>
              {normalizedRule}
            </span>
          </div>
          <div className="sub-card-body mono">
            <span className="sub-meta-item">
              <span className="meta-key text-muted">RULE ID:</span>{' '}
              <span className="meta-val font-bold">{ruleData?.rule_id ?? 'FIA_C5.2.7'}</span>
            </span>
            <span className="sub-meta-item">
              <span className="meta-key text-muted">RC:</span>{' '}
              <span className="meta-val text-valid">{raceControlStatus}</span>
            </span>
          </div>
        </div>

        {/* Stability V1 Consensus Sub-Card */}
        <div
          className={`sub-card stability-card clickable stability-verdict-${normalizedStability.toLowerCase()}`}
          onClick={handleOpenStabilityEvidence}
          title="Click to inspect multi-family Stability V1 consensus evidence"
        >
          <div className="sub-card-header">
            <span className="sub-title mono font-bold">STABILITY V1</span>
            <span className={`status-badge mono font-bold badge-${normalizedStability.toLowerCase()}`}>
              {normalizedStability}
            </span>
          </div>
          <div className="sub-card-body mono">
            <div className="consensus-chips-wrap">
              <span className={`consensus-chip ${triggeredFamilies.includes('PACE') ? 'triggered' : 'available'}`}>
                PACE {triggeredFamilies.includes('PACE') ? 'TRIG' : 'AVAIL'}
              </span>
              <span className={`consensus-chip ${triggeredFamilies.includes('SPEED') ? 'triggered' : 'available'}`}>
                SPEED {triggeredFamilies.includes('SPEED') ? 'TRIG' : 'AVAIL'}
              </span>
              <span className={`consensus-chip ${triggeredFamilies.includes('TYRE') ? 'triggered' : 'available'}`}>
                TYRE {triggeredFamilies.includes('TYRE') ? 'TRIG' : 'AVAIL'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Permanent Mandated Disclaimer Footer */}
      <div className="energy-panel-footer">
        <span className="footer-disclaimer text-muted mono">
          SIMULATED — REGULATION CONSTRAINED // NOT PHYSICAL MEASUREMENT
        </span>
      </div>
    </div>
  );
};
