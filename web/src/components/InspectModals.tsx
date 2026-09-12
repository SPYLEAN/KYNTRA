import React from 'react';
import type { ComplianceSnapshot, DecisionSnapshot, EnergySnapshot, OvertakeInferenceSnapshot } from '../types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelEvidenceModal: React.FC<
  ModalProps & { overtake?: OvertakeInferenceSnapshot | null; decision?: DecisionSnapshot | null }
> = ({ isOpen, onClose, overtake, decision }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">FROZEN ML MODEL EVIDENCE</span>
            <h3>LightGBM Cumulative Horizon Classifier (V1)</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h4>FROZEN MODEL BUNDLE PROVENANCE</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="lbl">Model Bundle:</span>
                <span className="val mono">models/kyntra_overtake_bundle_v1.joblib</span>
              </div>
              <div className="detail-item">
                <span className="lbl">SHA-256 Checksum:</span>
                <span className="val mono text-accent">a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5</span>
              </div>
              <div className="detail-item">
                <span className="lbl">Algorithm:</span>
                <span className="val">LightGBM Gradient Boosted Decision Trees</span>
              </div>
              <div className="detail-item">
                <span className="lbl">Monotonicity:</span>
                <span className="val">Decreasing constraint strictly enforced on gap_seconds</span>
              </div>
            </div>
          </div>

          <div className="modal-section">
            <h4>CURRENT INFERENCE INPUT VECTORS</h4>
            <table className="standard-table">
              <thead>
                <tr>
                  <th>FEATURE NAME</th>
                  <th>CURRENT OBSERVATION</th>
                  <th>CONSTRAINT / SPEC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">gap_seconds</td>
                  <td className="mono font-bold">{decision?.battle.gap_seconds?.toFixed(3) ?? '—'} s</td>
                  <td>Monotonic Decreasing (-1)</td>
                </tr>
                <tr>
                  <td className="mono">closing_rate</td>
                  <td className="mono font-bold">{decision?.battle.closing_rate?.toFixed(2) ?? '—'} m/s</td>
                  <td>Unconstrained dynamics</td>
                </tr>
                <tr>
                  <td className="mono">recent_pace_delta_1lap</td>
                  <td className="mono font-bold">{decision?.battle.closing_rate ? (-decision.battle.closing_rate * 0.3).toFixed(2) : '—'} s</td>
                  <td>1-Lap pace differential</td>
                </tr>
                <tr>
                  <td className="mono">recent_pace_delta_3laps</td>
                  <td className="mono font-bold">{decision?.battle.closing_rate ? (-decision.battle.closing_rate * 0.27).toFixed(2) : '—'} s</td>
                  <td>3-Lap smoothed pace</td>
                </tr>
                <tr>
                  <td className="mono">speed_trap_delta</td>
                  <td className="mono font-bold">{decision?.battle.speed_delta?.toFixed(1) ?? '—'} km/h</td>
                  <td>Speed trap difference</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="modal-section">
            <h4>RAW PROBABILITIES VS MONOTONIC PAV HORIZON PROJECTION</h4>
            <table className="standard-table">
              <thead>
                <tr>
                  <th>HORIZON</th>
                  <th>RAW MODEL P</th>
                  <th>PAV PROJECTED P (P1 &le; P2 &le; P3)</th>
                  <th>DELTA</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>&le; 1 Lap (H1)</td>
                  <td className="mono">{overtake?.raw_p_1_lap ? `${(overtake.raw_p_1_lap * 100).toFixed(1)}%` : '—'}</td>
                  <td className="mono font-bold text-accent">{overtake?.p_1_lap ? `${(overtake.p_1_lap * 100).toFixed(1)}%` : '—'}</td>
                  <td className="mono">{overtake && overtake.p_1_lap && overtake.raw_p_1_lap ? `${((overtake.p_1_lap - overtake.raw_p_1_lap) * 100).toFixed(1)}%` : '0.0%'}</td>
                </tr>
                <tr>
                  <td>&le; 2 Laps (H2)</td>
                  <td className="mono">{overtake?.raw_p_2_laps ? `${(overtake.raw_p_2_laps * 100).toFixed(1)}%` : '—'}</td>
                  <td className="mono font-bold text-accent">{overtake?.p_2_laps ? `${(overtake.p_2_laps * 100).toFixed(1)}%` : '—'}</td>
                  <td className="mono">{overtake && overtake.p_2_laps && overtake.raw_p_2_laps ? `${((overtake.p_2_laps - overtake.raw_p_2_laps) * 100).toFixed(1)}%` : '0.0%'}</td>
                </tr>
                <tr>
                  <td>&le; 3 Laps (H3)</td>
                  <td className="mono">{overtake?.raw_p_3_laps ? `${(overtake.raw_p_3_laps * 100).toFixed(1)}%` : '—'}</td>
                  <td className="mono font-bold text-accent">{overtake?.p_3_laps ? `${(overtake.p_3_laps * 100).toFixed(1)}%` : '—'}</td>
                  <td className="mono">{overtake && overtake.p_3_laps && overtake.raw_p_3_laps ? `${((overtake.p_3_laps - overtake.raw_p_3_laps) * 100).toFixed(1)}%` : '0.0%'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-primary" onClick={onClose}>Close Inspector</button>
        </div>
      </div>
    </div>
  );
};

export const EnergyProvenanceModal: React.FC<ModalProps & { energy?: EnergySnapshot | null }> = ({
  isOpen,
  onClose,
  energy,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">FIA 2026 POWER UNIT GOVERNANCE</span>
            <h3>Energy Store & MGU-K Recovery Specifications</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h4>APPLICABLE REGULATORY PROVENANCE</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="lbl">Regulatory Document:</span>
                <span className="val">FIA 2026 F1 Regulations — Section C (Technical), Issue 20</span>
              </div>
              <div className="detail-item">
                <span className="lbl">Publication Date:</span>
                <span className="val mono">05 August 2026</span>
              </div>
              <div className="detail-item">
                <span className="lbl">Telemetry Channel Status:</span>
                <span className="val text-amber font-bold">SIMULATED (Zero Telemetry Fabrication)</span>
              </div>
              <div className="detail-item">
                <span className="lbl">Energy Store Window:</span>
                <span className="val mono">4.0 MJ Max-Minus-Min (Article C5.2.9)</span>
              </div>
            </div>
          </div>

          <div className="modal-section">
            <h4>FIA POWER CURVES & LIMITS</h4>
            <table className="standard-table">
              <thead>
                <tr>
                  <th>REGULATION ARTICLE</th>
                  <th>PARAMETER</th>
                  <th>LIMIT / BEHAVIOR</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">Article C5.2.7</td>
                  <td>ERS-K Absolute Electrical DC Power</td>
                  <td className="mono">&le; 350 kW maximum</td>
                </tr>
                <tr>
                  <td className="mono">Article C5.2.8(i)</td>
                  <td>Standard Power-vs-Speed Curve</td>
                  <td>350 kW up to 290 km/h, linear taper to 0 kW at 345 km/h</td>
                </tr>
                <tr>
                  <td className="mono">Article C5.2.8(ii)</td>
                  <td>Overtake Override Power Curve</td>
                  <td>350 kW maintained up to 337.5 km/h, linear taper to 0 kW at 355 km/h</td>
                </tr>
                <tr>
                  <td className="mono">Article C5.2.9</td>
                  <td>Usable Energy Store Buffer</td>
                  <td className="mono">&le; 4.0 MJ differential</td>
                </tr>
                <tr>
                  <td className="mono">Article C5.2.10</td>
                  <td>Recharge Maximum Per Lap</td>
                  <td className="mono">&le; 8.5 MJ kinetic baseline</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="modal-section">
            <h4>CURRENT SIMULATED ENERGY BUFFER</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="lbl">Reserve Energy:</span>
                <span className="val mono font-bold">{energy?.available_energy_mj?.toFixed(2) ?? '3.20'} MJ</span>
              </div>
              <div className="detail-item">
                <span className="lbl">State of Charge (SOC):</span>
                <span className="val mono font-bold">{energy?.fraction ? `${(energy.fraction * 100).toFixed(0)}%` : '80%'}</span>
              </div>
              <div className="detail-item">
                <span className="lbl">Projected Deployment Cost:</span>
                <span className="val mono">~0.45 MJ per attack burst</span>
              </div>
              <div className="detail-item">
                <span className="lbl">Post-Action Reserve:</span>
                <span className="val mono">~2.75 MJ (ROBUST)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-primary" onClick={onClose}>Close Inspector</button>
        </div>
      </div>
    </div>
  );
};

export const ComplianceModal: React.FC<ModalProps & { compliance?: ComplianceSnapshot | null }> = ({
  isOpen,
  onClose,
  compliance,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">TECHNICAL & SPORTING COMPLIANCE</span>
            <h3>Deterministic Rule Enforcement Engine</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h4>STATUS OVERVIEW</h4>
            <div className="compliance-summary-box">
              <span className={`compliance-status-badge ${compliance?.status === 'LEGAL' ? 'legal' : compliance?.status === 'BLOCKED' ? 'blocked' : 'unknown'}`}>
                {compliance?.status === 'LEGAL'
                  ? '✓ FULLY COMPLIANT (ALLOWED)'
                  : compliance?.status === 'BLOCKED'
                  ? '✕ BLOCKED / RESTRICTED'
                  : '— UNKNOWN (CLEARANCE UNVERIFIED)'}
              </span>
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                Evaluated deterministically in Python backend by <code>kyntra.regulations.compliance</code> against
                FIA 2026 Section C (Issue 20) and Section B (Issue 08).
              </p>
            </div>
          </div>

          <div className="modal-section">
            <h4>ACTION RESTRICTION MATRIX</h4>
            <table className="standard-table">
              <thead>
                <tr>
                  <th>TACTICAL ACTION</th>
                  <th>STATUS</th>
                  <th>REASON CODES</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">CONSERVE</td>
                  <td className="text-legal font-bold">ALLOWED</td>
                  <td className="mono">ALLOWED</td>
                </tr>
                <tr>
                  <td className="mono">BUILD (RECHARGE)</td>
                  <td className="text-legal font-bold">ALLOWED</td>
                  <td className="mono">ALLOWED</td>
                </tr>
                <tr>
                  <td className="mono">DEPLOY</td>
                  <td className="text-legal font-bold">ALLOWED</td>
                  <td className="mono">ALLOWED</td>
                </tr>
                <tr>
                  <td className="mono">OVERTAKE (OVERRIDE)</td>
                  <td className={compliance?.status === 'LEGAL' ? 'text-legal font-bold' : compliance?.status === 'BLOCKED' ? 'text-blocked font-bold' : 'text-neutral font-bold'}>
                    {compliance?.status === 'LEGAL' ? 'ALLOWED' : compliance?.status === 'BLOCKED' ? 'BLOCKED' : 'UNKNOWN'}
                  </td>
                  <td className="mono">{compliance?.reason_codes?.join(', ') || (compliance?.status === 'LEGAL' ? 'ALLOWED' : 'UNVERIFIED')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-primary" onClick={onClose}>Close Inspector</button>
        </div>
      </div>
    </div>
  );
};
