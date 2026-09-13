import React, { useEffect, useState } from 'react';
import type { EvidenceInspectionTarget } from '../../types';
import { ProvenanceChip } from '../common/ProvenanceChip';

interface EvidenceDrawerProps {
  target: EvidenceInspectionTarget | null;
  onClose: () => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ target, onClose }) => {
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!target) return null;

  const isEnergy =
    target.provenance === 'SIMULATED ENERGY' ||
    target.title.toUpperCase().includes('ENERGY') ||
    target.title.toUpperCase().includes('SOC');

  const isModel =
    target.provenance === 'FROZEN MODEL' ||
    target.title.toUpperCase().includes('HORIZON') ||
    target.title.toUpperCase().includes('P1') ||
    target.title.toUpperCase().includes('P2') ||
    target.title.toUpperCase().includes('P3') ||
    target.title.toUpperCase().includes('PASS CONTEXT');

  const isStability =
    target.provenance === 'ORDINAL STABILITY' ||
    target.title.toUpperCase().includes('STABILITY') ||
    target.title.toUpperCase().includes('DURABILITY');

  const isRule =
    target.provenance === 'RULE CHECK' ||
    target.title.toUpperCase().includes('RULE') ||
    target.title.toUpperCase().includes('ELIGIBILITY') ||
    target.title.toUpperCase().includes('REGULATION');

  const evidenceList = target.technicalEvidence || target.evidenceItems || [];

  return (
    <aside className="kyntra-evidence-drawer" aria-label="Forensic Evidence Inspector">
      {/* 1. Header with Eyebrow, Title and Close */}
      <div className="drawer-header">
        <div className="drawer-title-group">
          <span className="drawer-eyebrow mono font-bold text-accent">
            FORENSIC EVIDENCE ENGINE // AUDIT LOG
          </span>
          <h3 className="drawer-title font-bold">{target.title}</h3>
        </div>
        <button
          type="button"
          className="drawer-close-btn mono font-bold"
          onClick={onClose}
          title="Close Inspector (ESC)"
        >
          ✕
        </button>
      </div>

      {/* 2. Target Primary Metric Card (VALUE + STATUS + PROVENANCE) */}
      <div className="drawer-primary-card">
        <div className="primary-value-row">
          <span className="primary-label mono font-bold text-muted">EVALUATED STATE:</span>
          <span className={`primary-value mono font-bold status-${target.status.toLowerCase()}`}>
            {target.value}
          </span>
        </div>
        <div className="primary-meta-row">
          <ProvenanceChip type={target.provenance} />
          <span className={`evidence-status-pill mono font-bold status-${target.status.toLowerCase()}`}>
            {target.status}
          </span>
          {target.timestamp && (
            <span className="target-time mono text-muted">
              {new Date(target.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* 3. Specialized Domain Provenance Banners */}
      {isEnergy && (
        <div className="drawer-warning-banner">
          <span className="warning-icon">⚠</span>
          <div>
            <div className="warning-text mono font-bold">
              SIMULATED ENERGY — NOT MEASURED BATTERY SOC
            </div>
            <p className="warning-sub text-muted">
              Derived from FIA 2026 TR 4.00 MJ USABLE SOC WINDOW per lap &amp; MGU-K MAXIMUM POWER LIMIT — 350 kW. Usable window simulation only; does not represent physical cell electrochemical telemetry.
            </p>
          </div>
        </div>
      )}

      {isModel && (
        <div className="drawer-info-banner">
          <span className="info-icon">ℹ</span>
          <div>
            <div className="info-text mono font-bold">
              FROZEN MODEL RUNTIME INFERENCE
            </div>
            <p className="info-sub text-muted">
              LightGBM multi-horizon classifier calibrated with Pool Adjacent Violators (PAV) monotonic projection. Deterministic evaluation with zero runtime weights mutation.
            </p>
          </div>
        </div>
      )}

      {isStability && (
        <div className="drawer-stability-banner">
          <span className="stability-icon">🛡</span>
          <div>
            <div className="stability-text mono font-bold">
              ORDINAL STABILITY V1 — CONSENSUS MANIFEST
            </div>
            <p className="stability-sub text-muted">
              Post-pass position durability evaluation based on multi-family telemetry consensus (Pace, Speed, Tyre). Not repass or retention probability; zero empirical weights in runtime.
            </p>
          </div>
        </div>
      )}

      {isRule && (
        <div className="drawer-rule-banner">
          <span className="rule-icon">⚖</span>
          <div>
            <div className="rule-text mono font-bold">
              DETERMINISTIC FIA REGULATION EVALUATION
            </div>
            <p className="rule-sub text-muted">
              Evaluated against codified FIA Sporting &amp; Technical Regulations. Canonical states: ALLOWED, BLOCKED, UNKNOWN. UNKNOWN indicates unresolved race control context.
            </p>
          </div>
        </div>
      )}

      {/* 4. Granular Contract Sections */}
      <div className="drawer-content-scroll table-bounded-scroll">
        {/* Specification & Source Contract */}
        <div className="drawer-section">
          <h4 className="section-heading mono font-bold">SPECIFICATION &amp; METHODOLOGY</h4>
          <table className="dense-keyvalue-table mono">
            <tbody>
              <tr>
                <td className="key-col text-muted">Source</td>
                <td className="val-col font-bold">{target.source || 'KYNTRA Runtime Strategy Core'}</td>
              </tr>
              {target.method && (
                <tr>
                  <td className="key-col text-muted">Method</td>
                  <td className="val-col font-bold text-primary">{target.method}</td>
                </tr>
              )}
              {target.version && (
                <tr>
                  <td className="key-col text-muted">Version</td>
                  <td className="val-col font-bold">{target.version}</td>
                </tr>
              )}
              <tr>
                <td className="key-col text-muted">Provenance</td>
                <td className="val-col text-accent font-bold">{target.provenance}</td>
              </tr>
              {target.timestamp && (
                <tr>
                  <td className="key-col text-muted">Timestamp</td>
                  <td className="val-col">{target.timestamp}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Technical Evidence Breakdown Items */}
        {evidenceList.length > 0 && (
          <div className="drawer-section">
            <h4 className="section-heading mono font-bold">TECHNICAL EVIDENCE BREAKDOWN</h4>
            <table className="dense-keyvalue-table mono">
              <tbody>
                {evidenceList.map((item, idx) => (
                  <tr key={idx}>
                    <td className="key-col text-muted">{item.label}</td>
                    <td className="val-col font-bold">
                      <span className="text-secondary">{item.value}</span>
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
            <h4 className="section-heading mono font-bold">DETERMINISTIC REASON CODES</h4>
            <div className="reason-codes-list">
              {target.reasonCodes.map((code, idx) => (
                <div key={idx} className="reason-code-badge mono font-bold">
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model & Config Identities (Cryptographic Signatures) */}
        {target.configIdentities && Object.keys(target.configIdentities).length > 0 && (
          <div className="drawer-section">
            <h4 className="section-heading mono font-bold">MODEL &amp; CONFIG IDENTIFIERS</h4>
            <table className="dense-keyvalue-table mono">
              <tbody>
                {Object.entries(target.configIdentities).map(([k, v]) => (
                  <tr key={k}>
                    <td className="key-col text-muted">{k}</td>
                    <td className="val-col break-all text-secondary font-mono">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Forensic Snapshot / Raw Payload Inspector */}
        {target.rawObject && (
          <div className="drawer-section">
            <div className="raw-toggle-header">
              <h4 className="section-heading mono font-bold">RAW TELEMETRY / SNAPSHOT</h4>
              <button
                type="button"
                className="raw-toggle-btn mono font-bold"
                onClick={() => setShowRaw(!showRaw)}
              >
                {showRaw ? 'HIDE RAW' : 'INSPECT RAW PAYLOAD'}
              </button>
            </div>
            {showRaw && (
              <pre className="raw-payload-block mono">
                {JSON.stringify(target.rawObject, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* 5. Drawer Footer */}
      <div className="drawer-footer">
        <span className="footer-cert mono text-accent">
          SOURCE EVIDENCE · INSPECTABLE RECORD
        </span>
        <span className="footer-esc-tip mono text-muted">
          Press [ESC] to return to pitwall view
        </span>
      </div>
    </aside>
  );
};

