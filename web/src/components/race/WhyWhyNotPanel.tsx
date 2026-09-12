import React from 'react';
import type { EvidenceInspectionTarget } from '../../types';

interface WhyWhyNotPanelProps {
  whySelected?: string[];
  whyNot?: Record<string, string>;
  ruleStatus?: string | null;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

const TOKEN_PHRASES: Record<string, string> = {
  RULE_RESTRICTION: 'FIA sporting regulation restriction active (SC/VSC/Flag)',
  ENERGY_INFEASIBILITY: 'MGU-K energy deficit for planned deployment',
  POST_PASS_INSTABILITY: 'High post-pass counter-attack risk detected',
  FUTURE_WINDOW_DOMINANCE: 'Superior forward attack window available next lap',
  REAR_THREAT: 'Immediate rear traffic pressure behind attacker',
  KINEMATIC_OPPORTUNITY_DEFICIT: 'Insufficient kinematic closing speed delta',
  ENERGY_SENSITIVITY: 'Strategy outcome sensitive to recovery scenario',
  INSUFFICIENT_INFORMATION: 'Incomplete telemetry feature set for confident pass',
  STRATEGY_TIE: 'Co-equal strategic ranking tier evaluation',
  DOMINATED_ACTION: 'Lower ranked across lexicographic tiers',
  EXCLUDED_BY_RULE: 'Prohibited by active track status and sporting rules',
  HIGH_RISK_POST_PASS: 'Position durability evaluated as HIGH_RISK',
};

export const WhyWhyNotPanel: React.FC<WhyWhyNotPanelProps> = ({
  whySelected = [],
  whyNot = {},
  ruleStatus,
  onOpenEvidence,
}) => {
  const isRuleUnknown = !ruleStatus || ruleStatus === 'UNKNOWN';

  // Contradiction A3 Guard: Filter or adapt false clearance claims if rule state is UNKNOWN
  const sanitizedWhySelected = whySelected.map((reason) => {
    if (isRuleUnknown) {
      const lower = reason.toLowerCase();
      if (
        lower.includes('regulatory clearance confirmed') ||
        lower.includes('clearance confirmed') ||
        lower.includes('legal') ||
        lower.includes('compliant') ||
        lower.includes('meets all regulatory') ||
        lower.includes('rule passed')
      ) {
        return 'Regulatory evaluation UNKNOWN (clearance unverified)';
      }
    }
    return reason;
  });

  // Limit to 3-4 primary reasons
  const visibleSelected = sanitizedWhySelected.slice(0, 4);
  const whyNotEntries = Object.entries(whyNot).slice(0, 4);

  const translateToken = (token: string) => {
    return TOKEN_PHRASES[token] || token.replace(/_/g, ' ');
  };

  return (
    <div className="why-why-not-panel" aria-label="Strategy Rationale and Exclusions">
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
            {visibleSelected.length === 0 ? (
              <div className="no-reasons text-muted">
                Candidate recommendation undergoing final publication gate verification.
              </div>
            ) : (
              visibleSelected.map((reasonText, idx) => (
                <div
                  key={idx}
                  className="reason-row clickable"
                  onClick={() =>
                    onOpenEvidence({
                      title: 'Selection Rationale Detail',
                      value: reasonText,
                      status: 'VALID',
                      provenance: 'DERIVED',
                      method: 'Lexicographic 6-Tier Strategy Brain',
                      evidenceItems: [
                        { label: 'Factor', value: reasonText },
                        { label: 'Rule Verification State', value: ruleStatus || 'UNKNOWN' },
                      ],
                    })
                  }
                  title="Click to inspect rationale evidence"
                >
                  <span className="reason-bullet font-bold text-valid">&bull;</span>
                  <span className="reason-text text-primary">
                    {translateToken(reasonText)}
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
                    <strong className="text-secondary mono-num">[{action}]</strong>{' '}
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
