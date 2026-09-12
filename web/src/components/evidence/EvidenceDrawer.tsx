import React, { useEffect } from 'react';
import type { EvidenceInspectionTarget } from '../../types';
import { ProvenanceChip } from '../common/ProvenanceChip';

interface EvidenceDrawerProps {
  target: EvidenceInspectionTarget | null;
  onClose: () => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ target, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!target) return null;

  const isEnergy = target.provenance === 'SIMULATED ENERGY' || target.title.includes('ENERGY');
  const isModel = target.provenance === 'FROZEN MODEL' || target.title.includes('OVERTAKE') || target.title.includes('PASS');

  return (
    <aside className="kyntra-evidence-drawer" aria-label="Evidence Inspector">
      {/* Top Header */}
      <div className="drawer-header">
        <div className="drawer-title-group">
          <span className="drawer-eyebrow mono">FORENSIC EVIDENCE INSPECTOR</span>
          <h3 className="drawer-title font-bold">{target.title}</h3>
        </div>
        <button
          type="button"
          className="drawer-close-btn mono"
          onClick={onClose}
          title="Close Inspector (ESC)"
        >
          ✕
        </button>
      </div>

      {/* Target Primary Metric Card */}
      <div className="drawer-primary-card">
        <div className="primary-value-row">
          <span className="primary-label mono">EVALUATED STATE:</span>
          <span className={`primary-value mono font-bold status-${target.status.toLowerCase()}`}>
            {target.value}
          </span>
        </div>
        <div className="primary-meta-row">
          <ProvenanceChip type={target.provenance} />
          {target.timestamp && (
            <span className="target-time mono text-muted">
              {new Date(target.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Critical Operational Banner for Simulated Data */}
      {isEnergy && (
        <div className="drawer-warning-banner">
          <span className="warning-icon">⚠</span>
          <div className="warning-text mono font-bold">
            SIMULATED 2026 ENERGY — NOT MEASURED SOC
          </div>
          <p className="warning-sub text-muted">
            Derived from FIA Article C5.2 4.0MJ/lap kinetic buffer model and 350kW MGU-K motor curve. Not physical telemetry.
          </p>
        </div>
      )}

      {/* Model Provenance Banner */}
      {isModel && (
        <div className="drawer-info-banner">
          <span className="info-icon">ℹ</span>
          <div className="info-text mono font-bold">
            FROZEN MODEL RUNTIME INFERENCE
          </div>
          <p className="info-sub text-muted">
            Cumulative horizon classifier with Pool Adjacent Violators (PAV) monotonic projection. Deterministic and frozen.
          </p>
        </div>
      )}

      {/* Granular Evidence Body */}
      <div className="drawer-content-scroll table-bounded-scroll">
        {/* Method & Versions */}
        <div className="drawer-section">
          <h4 className="section-heading mono font-bold">METHOD &amp; SPECIFICATION</h4>
          <table className="dense-keyvalue-table mono">
            <tbody>
              {target.method && (
                <tr>
                  <td className="key-col">Method</td>
                  <td className="val-col font-bold">{target.method}</td>
                </tr>
              )}
              {target.version && (
                <tr>
                  <td className="key-col">Version</td>
                  <td className="val-col">{target.version}</td>
                </tr>
              )}
              <tr>
                <td className="key-col">Provenance</td>
                <td className="val-col text-accent">{target.provenance}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Evidence Breakdown Items */}
        {target.evidenceItems && target.evidenceItems.length > 0 && (
          <div className="drawer-section">
            <h4 className="section-heading mono font-bold">EVIDENCE BREAKDOWN</h4>
            <table className="dense-keyvalue-table mono">
              <tbody>
                {target.evidenceItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="key-col">{item.label}</td>
                    <td className="val-col font-bold">
                      {item.value}
                      {item.note && <span className="item-note text-muted"> ({item.note})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reason Codes */}
        {target.reasonCodes && target.reasonCodes.length > 0 && (
          <div className="drawer-section">
            <h4 className="section-heading mono font-bold">REASON CODES</h4>
            <div className="reason-codes-list">
              {target.reasonCodes.map((code, idx) => (
                <div key={idx} className="reason-code-badge mono font-bold">
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cryptographic Signatures & Config Identifiers */}
        {target.configIdentities && Object.keys(target.configIdentities).length > 0 && (
          <div className="drawer-section">
            <h4 className="section-heading mono font-bold">FORENSIC IDENTIFIERS</h4>
            <table className="dense-keyvalue-table mono">
              <tbody>
                {Object.entries(target.configIdentities).map(([k, v]) => (
                  <tr key={k}>
                    <td className="key-col text-muted">{k}</td>
                    <td className="val-col break-all text-secondary">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Status Footer */}
      <div className="drawer-footer">
        <span className="footer-esc-tip mono text-muted">Press [ESC] to return to pit-wall view</span>
      </div>
    </aside>
  );
};
