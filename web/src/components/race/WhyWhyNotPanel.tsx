import React from 'react';
import type { EvidenceInspectionTarget } from '../../types';

interface WhyWhyNotPanelProps {
  whySelected?: string[];
  whyNot?: Record<string, string>;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

const TOKEN_PHRASES: Record<string, string> = {
  RULE_RESTRICTION: 'FIA sporting regulation restriction active (SC/VSC/Flag)',
  ENERGY_INFEASIBILITY: 'MGU-K kinetic energy deficit for planned deployment',
  POST_PASS_INSTABILITY: 'High post-pass counter-attack risk detected',
  FUTURE_WINDOW_DOMINANCE: 'Stronger future attack window available next lap',
  REAR_THREAT: 'Immediate rear traffic pressure detected behind attacker',
  KINEMATIC_OPPORTUNITY_DEFICIT: 'Insufficient kinematic closing speed delta',
  ENERGY_SENSITIVITY: 'Strategy outcome sensitive to recovery scenario',
  INSUFFICIENT_INFORMATION: 'Incomplete telemetry feature set for confident pass',
  STRATEGY_TIE: 'Co-equal strategic ranking tier evaluation',
  DOMINATED_ACTION: 'Lower ranked across lexicographic evaluation tiers',
  EXCLUDED_BY_RULE: 'Prohibited by active track status and sporting rules',
  HIGH_RISK_POST_PASS: 'Position durability evaluated as HIGH_RISK',
};

export const WhyWhyNotPanel: React.FC<WhyWhyNotPanelProps> = ({
  whySelected = [],
  whyNot = {},
  onOpenEvidence,
}) => {
  const whyNotEntries = Object.entries(whyNot);

  const translateToken = (token: string) => {
    return TOKEN_PHRASES[token] || token.replace(/_/g, ' ');
  };

  return (
    <div className="why-why-not-panel mono">
      <div className="why-panel-header">
        <span className="panel-title font-bold">RATIONALE &amp; EXCLUSIONS</span>
        <span className="panel-sub text-muted">DETERMINISTIC BASIS</span>
      </div>

      <div className="why-sections-grid">
        {/* Section 1: WHY SELECTED */}
        <div className="why-section why-selected-section">
          <div className="section-title-line">
            <span className="bullet-dot bullet-selected" />
            <span className="title-text font-bold">WHY SELECTED</span>
          </div>

          <div className="reasons-list">
            {whySelected.length === 0 ? (
              <div className="no-reasons text-muted">
                Candidate recommendation undergoing final publication gate verification.
              </div>
            ) : (
              whySelected.map((token, idx) => (
                <div
                  key={idx}
                  className="reason-row clickable"
                  onClick={() =>
                    onOpenEvidence({
                      title: `Selection Rationale — ${token}`,
                      value: translateToken(token),
                      status: 'VALID',
                      provenance: 'DERIVED',
                      method: 'Lexicographic 6-Tier Strategy Brain',
                      evidenceItems: [
                        { label: 'Token', value: token },
                        { label: 'Translation', value: translateToken(token) },
                      ],
                    })
                  }
                  title="Click to inspect rationale evidence"
                >
                  <span className="reason-bullet font-bold text-accent">&bull;</span>
                  <span className="reason-text font-bold text-primary">
                    {translateToken(token)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2: WHY NOT OVERTAKE NOW? */}
        <div className="why-section why-not-section">
          <div className="section-title-line">
            <span className="bullet-dot bullet-rejected" />
            <span className="title-text font-bold">WHY NOT OVERTAKE NOW?</span>
          </div>

          <div className="reasons-list">
            {whyNotEntries.length === 0 ? (
              <div className="reason-row text-muted">
                <span className="reason-bullet text-muted">&bull;</span>
                <span>Overtake currently selected or under active evaluation.</span>
              </div>
            ) : (
              whyNotEntries.map(([action, token]) => (
                <div
                  key={action}
                  className="reason-row clickable"
                  onClick={() =>
                    onOpenEvidence({
                      title: `Exclusion — ${action}`,
                      value: translateToken(token),
                      status: 'BLOCKED',
                      provenance: 'DERIVED',
                      method: 'Deterministic Exclusion Trace',
                      evidenceItems: [
                        { label: 'Action', value: action },
                        { label: 'Token', value: token },
                        { label: 'Translation', value: translateToken(token) },
                      ],
                    })
                  }
                  title={`Click to inspect why ${action} was eliminated`}
                >
                  <span className="reason-bullet text-blocked font-bold">&#10006;</span>
                  <span className="reason-text">
                    <strong className="text-secondary">[{action}]</strong>{' '}
                    <span className="text-primary">{translateToken(token)}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
