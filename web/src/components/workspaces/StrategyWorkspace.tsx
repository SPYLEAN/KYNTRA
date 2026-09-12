import React from 'react';
import type { DecisionSnapshot } from '../../types';

interface StrategyWorkspaceProps {
  decision: DecisionSnapshot | null;
  onOpenModelModal: () => void;
  onOpenEnergyModal: () => void;
}

export const StrategyWorkspace: React.FC<StrategyWorkspaceProps> = ({
  decision,
  onOpenModelModal,
  onOpenEnergyModal,
}) => {
  const currentBattle = decision?.battle;
  const attacker = decision?.race.attacker || 'ATTACKER';
  const defender = decision?.race.defender || 'DEFENDER';

  return (
    <div className="workspace-strategy-container">
      {/* Top Banner: KYNTRA Call Status */}
      <div className="strategy-call-banner">
        <div className="banner-badge-block">
          <div className="call-badge-group">
            <img
              src="/brand/kyntra-symbol.png"
              alt="KYNTRA"
              className="call-brand-symbol"
            />
            <span className="banner-badge">KYNTRA CALL</span>
          </div>
          <span className="banner-state-pill">ENGINE STATUS: PENDING VERIFICATION</span>
        </div>
        <h2 className="banner-headline">AWAITING STRATEGY ENGINE</h2>
        <p className="banner-description">
          The continuous multi-horizon strategy solver and tactical game-theoretic tree are currently disabled.
          In accordance with KYNTRA integrity guidelines, no synthetic recommendations (ATTACK / HOLD / PREPARE / SAVE)
          are emitted. The decision framework below reflects real telemetry observations and verified regulatory limits.
        </p>
      </div>

      {/* Main Grid: Four Strategic Questions + Why Not Attack Now + Future Window */}
      <div className="strategy-content-grid">
        {/* The Four Core Strategic Questions */}
        <div className="strategy-col strategy-col-questions">
          <div className="panel-inner-card flex-col">
            <div className="panel-header-row">
              <span className="panel-title">STRATEGIC DECISION FRAMEWORK</span>
              <span className="panel-count mono">4 CANONICAL EVALUATION AXES</span>
            </div>

            <div className="questions-list">
              {/* Question 1: CAN I PASS? */}
              <div className="question-card">
                <div className="q-header">
                  <span className="q-number mono">01</span>
                  <div className="q-title-group">
                    <span className="q-title font-bold">CAN I PASS?</span>
                    <span className="q-subdesc">Tactical overtake evaluation for {attacker} vs {defender} (&le;1 to &le;3 laps).</span>
                  </div>
                  <span className="q-status-tag pending">EVALUATION PENDING</span>
                </div>
                <div className="q-body">
                  <div className="q-evidence-row">
                    <span className="e-lbl">Overtake Probability (&le;1 Lap):</span>
                    <span className="e-val mono font-bold" onClick={onOpenModelModal} style={{ cursor: 'pointer' }}>
                      {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(1)}% (H1)` : '—'}
                    </span>
                  </div>
                  <div className="q-evidence-row">
                    <span className="e-lbl">Temporal Gap:</span>
                    <span className="e-val mono">{currentBattle?.gap_seconds?.toFixed(3) ?? '—'} s</span>
                  </div>
                  <div className="q-evidence-row">
                    <span className="e-lbl">MGU-K Boost Headroom:</span>
                    <span className="e-val mono text-legal font-bold">350 kW AVAILABLE (C5.2.7)</span>
                  </div>
                </div>
              </div>

              {/* Question 2: CAN I AFFORD IT? */}
              <div className="question-card">
                <div className="q-header">
                  <span className="q-number mono">02</span>
                  <div className="q-title-group">
                    <span className="q-title font-bold">CAN I AFFORD IT?</span>
                    <span className="q-subdesc">Electrical energy expenditure and per-lap recovery headroom.</span>
                  </div>
                  <span className="q-status-tag pending">EVALUATION PENDING</span>
                </div>
                <div className="q-body">
                  <div className="q-evidence-row">
                    <span className="e-lbl">Battery Reserve (SOC):</span>
                    <span className="e-val mono font-bold" onClick={onOpenEnergyModal} style={{ cursor: 'pointer' }}>
                      {decision?.energy.available_energy_mj?.toFixed(2) ?? '3.20'} MJ ({decision?.energy.fraction ? `${(decision.energy.fraction * 100).toFixed(0)}%` : '80%'})
                    </span>
                  </div>
                  <div className="q-evidence-row">
                    <span className="e-lbl">Usable Buffer Limit:</span>
                    <span className="e-val mono">4.0 MJ MAX-MIN (Article C5.2.9)</span>
                  </div>
                  <div className="q-evidence-row">
                    <span className="e-lbl">Lap Recharge Ceiling:</span>
                    <span className="e-val mono text-legal font-bold">8.5 MJ / LAP (Article C5.2.10)</span>
                  </div>
                </div>
              </div>

              {/* Question 3: CAN I KEEP IT? */}
              <div className="question-card">
                <div className="q-header">
                  <span className="q-number mono">03</span>
                  <div className="q-title-group">
                    <span className="q-title font-bold">CAN I KEEP IT?</span>
                    <span className="q-subdesc">Post-pass position retention, counter-pass vulnerability, and rear threat.</span>
                  </div>
                  <span className="q-status-tag pending">EVALUATION PENDING</span>
                </div>
                <div className="q-body">
                  <div className="q-evidence-row">
                    <span className="e-lbl">Rear Pressure Threat:</span>
                    <span className="e-val mono font-bold">{currentBattle?.rear_threat || 'LOW'}</span>
                  </div>
                  <div className="q-evidence-row">
                    <span className="e-lbl">Post-Pass Stability Classifier:</span>
                    <span className="e-val mono text-amber font-bold">UNKNOWN (No Guessing)</span>
                  </div>
                  <div className="q-evidence-row">
                    <span className="e-lbl">Retention Horizon:</span>
                    <span className="e-val mono">Pending empirical verification</span>
                  </div>
                </div>
              </div>

              {/* Question 4: AM I ALLOWED? */}
              <div className="question-card">
                <div className="q-header">
                  <span className="q-number mono">04</span>
                  <div className="q-title-group">
                    <span className="q-title font-bold">AM I ALLOWED?</span>
                    <span className="q-subdesc">FIA Technical Issue 20 and Sporting Issue 08 regulatory compliance.</span>
                  </div>
                  <span className="q-status-tag pending">EVALUATION PENDING</span>
                </div>
                <div className="q-body">
                  <div className="q-evidence-row">
                    <span className="e-lbl">Compliance Status:</span>
                    <span className={`e-val mono font-bold ${decision?.compliance.status === 'LEGAL' ? 'text-legal' : 'text-blocked'}`}>
                      {decision?.compliance.status === 'LEGAL' ? '✓ FULLY COMPLIANT (LEGAL)' : '✕ BLOCKED'}
                    </span>
                  </div>
                  <div className="q-evidence-row">
                    <span className="e-lbl">Power Curve Limits:</span>
                    <span className="e-val mono">Articles C5.2.8(i) & C5.2.8(ii)</span>
                  </div>
                  <div className="q-evidence-row">
                    <span className="e-lbl">Sporting Constraints:</span>
                    <span className="e-val mono">Yellow flag / SC override restrictions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tactical Risk Factors: WHY NOT ATTACK NOW? + Window Projection */}
        <div className="strategy-col strategy-col-risks">
          {/* Why Not Attack Now Panel */}
          <div className="panel-inner-card" style={{ marginBottom: '12px' }}>
            <div className="panel-header-row">
              <span className="panel-title text-amber font-bold">WHY NOT ATTACK NOW? (RISK AUDIT)</span>
            </div>
            <div className="risk-factors-list">
              <div className="risk-item">
                <div className="risk-bullet">⚠</div>
                <div className="risk-text">
                  <strong>Energy Depletion Gradient:</strong> A failed 350 kW override attempt costs ~0.45–0.60 MJ of electrical reserve without position advancement, reducing subsequent defensive energy buffers.
                </div>
              </div>
              <div className="risk-item">
                <div className="risk-bullet">⚠</div>
                <div className="risk-text">
                  <strong>Counter-Pass Vulnerability:</strong> Post-pass retention model is uncalibrated. Passing before optimal braking markers risks immediate DRS/manual override repass on the subsequent straight.
                </div>
              </div>
              <div className="risk-item">
                <div className="risk-bullet">⚠</div>
                <div className="risk-text">
                  <strong>Thermal Tyre Slip:</strong> High-energy traction cornering in dirty air increases thermal degradation on {attacker}&apos;s medium compound set.
                </div>
              </div>
            </div>
          </div>

          {/* Decision Readiness Matrix */}
          <div className="panel-inner-card" style={{ marginBottom: '12px' }}>
            <div className="panel-header-row">
              <span className="panel-title font-bold">DECISION READINESS MATRIX</span>
              <span className="panel-count mono">6 SUBSYSTEMS</span>
            </div>
            <div className="readiness-grid">
              <div className="readiness-item">
                <span className="r-label">PASS MODEL:</span>
                <span className="r-status text-legal mono font-bold">READY (V1 FROZEN)</span>
              </div>
              <div className="readiness-item">
                <span className="r-label">ENERGY PU:</span>
                <span className="r-status text-amber mono font-bold">READY — SIMULATED</span>
              </div>
              <div className="readiness-item">
                <span className="r-label">STABILITY:</span>
                <span className="r-status text-amber mono font-bold">PENDING (UNKNOWN)</span>
              </div>
              <div className="readiness-item">
                <span className="r-label">COMPLIANCE:</span>
                <span className={`r-status mono font-bold ${decision?.compliance.status === 'LEGAL' ? 'text-legal' : 'text-blocked'}`}>
                  {decision?.compliance.status === 'LEGAL' ? 'READY (LEGAL)' : 'BLOCKED'}
                </span>
              </div>
              <div className="readiness-item">
                <span className="r-label">COUNTERFACTUAL:</span>
                <span className="r-status text-muted mono font-bold">PENDING</span>
              </div>
              <div className="readiness-item">
                <span className="r-label">STRATEGY ENGINE:</span>
                <span className="r-status text-blocked mono font-bold">NOT READY (INACTIVE)</span>
              </div>
            </div>
          </div>

          {/* Decision Timeline & Window Projection */}
          <div className="panel-inner-card flex-col">
            <div className="panel-header-row">
              <span className="panel-title">TACTICAL WINDOW OUTLOOK</span>
              <span className="panel-count mono">NEXT 3 LAPS</span>
            </div>
            <div className="table-bounded-scroll">
              <div className="outlook-timeline">
                <div className="outlook-step">
                  <span className="step-lap mono font-bold">LAP {decision?.race.lap ?? 1}</span>
                  <div className="step-content">
                    <span className="step-tag">CURRENT LAP (H1)</span>
                    <span className="step-desc">
                      Probability: {decision?.overtake.p_1_lap ? `${(decision.overtake.p_1_lap * 100).toFixed(0)}%` : '—'}.
                      Provisional observation within &le;{currentBattle?.gap_seconds?.toFixed(2) ?? '1.20'}s gap.
                    </span>
                  </div>
                </div>
                <div className="outlook-step">
                  <span className="step-lap mono font-bold">LAP {(decision?.race.lap ?? 1) + 1}</span>
                  <div className="step-content">
                    <span className="step-tag">PROJECTED +1 (H2)</span>
                    <span className="step-desc">
                      Predicted closing trajectory if delta maintained. Cumulative pass probability rises to{' '}
                      {decision?.overtake.p_2_laps ? `${(decision.overtake.p_2_laps * 100).toFixed(0)}%` : '50%'}.
                    </span>
                  </div>
                </div>
                <div className="outlook-step">
                  <span className="step-lap mono font-bold">LAP {(decision?.race.lap ?? 1) + 2}</span>
                  <div className="step-content">
                    <span className="step-tag">PEAK WINDOW (H3)</span>
                    <span className="step-desc">
                      Target window threshold ({decision?.overtake.p_3_laps ? `${(decision.overtake.p_3_laps * 100).toFixed(0)}%` : '65%'}).
                      Optimal thermal and electrical reserve alignment for manual override deployment.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
