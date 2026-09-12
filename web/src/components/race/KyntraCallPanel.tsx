import React from 'react';
import type { EvidenceInspectionTarget, PublishedCallSnapshotData } from '../../types';
import { LifecycleBadge } from '../common/LifecycleBadge';

interface KyntraCallPanelProps {
  publishedCall: PublishedCallSnapshotData | null;
  callLifecycle: string;
  candidateCall?: any;
  decisionSnapshotId?: string | null;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

export const KyntraCallPanel: React.FC<KyntraCallPanelProps> = ({
  publishedCall,
  callLifecycle,
  candidateCall,
  decisionSnapshotId,
  onOpenEvidence,
}) => {
  const lifecycle = (publishedCall?.lifecycle_state || callLifecycle || 'WITHHELD').toUpperCase();
  const isValid = lifecycle === 'VALID' || lifecycle === 'AGING';

  // Strategic Headline & Metadata
  let headlineCall = 'NO DOMINANT STRATEGY';
  let backendAction = 'NONE';
  let primaryBasis = publishedCall?.primary_reason || 'Evaluating pit-wall strategy options.';

  if (isValid && publishedCall) {
    headlineCall = publishedCall.ui_call;
    backendAction = publishedCall.backend_action;
  } else if (lifecycle === 'PENDING_FINAL_GATE') {
    // CRITICAL: Candidate PENDING_FINAL_GATE must never visually appear as a published call
    headlineCall = 'PENDING FINAL GATE';
    backendAction = candidateCall?.canonical_action ? `CANDIDATE: ${candidateCall.canonical_action}` : 'EVALUATING';
    primaryBasis = 'Candidate recommendation undergoing 7-point safety & staleness gate verification.';
  } else if (lifecycle === 'WITHHELD') {
    headlineCall = 'CALL WITHHELD';
    backendAction = publishedCall?.backend_action || 'WITHHELD';
    primaryBasis = publishedCall?.primary_reason || 'Gate withheld recommendation due to safety or rule bounds.';
  } else if (lifecycle === 'BLOCKED') {
    headlineCall = 'CALL BLOCKED';
    backendAction = publishedCall?.backend_action || 'BLOCKED';
    primaryBasis = publishedCall?.primary_reason || 'Sporting regulation violation or neutralized track status.';
  } else if (lifecycle === 'EXPIRED') {
    headlineCall = 'CALL EXPIRED';
    backendAction = publishedCall?.backend_action || 'EXPIRED';
    primaryBasis = 'Telemetry staleness budget exceeded without fresh race data.';
  } else if (lifecycle === 'INVALIDATED') {
    headlineCall = 'CALL INVALIDATED';
    backendAction = publishedCall?.backend_action || 'INVALIDATED';
    primaryBasis = 'Preconditions diverged from active race state.';
  }

  const decId = publishedCall?.decision_snapshot_id || decisionSnapshotId || 'FORENSIC_STANDBY';
  const robustness = publishedCall?.robustness || 'ROBUST WITHIN TESTED ASSUMPTIONS';

  return (
    <div
      className={`kyntra-call-card-redesign lifecycle-state-${lifecycle.toLowerCase()} clickable`}
      onClick={() =>
        onOpenEvidence({
          title: `KYNTRA Decision Record — ${decId}`,
          value: headlineCall,
          status: isValid ? 'VALID' : lifecycle === 'PENDING_FINAL_GATE' ? 'CAUTION' : 'BLOCKED',
          provenance: 'DERIVED',
          method: '7-Point Atomic Final Publication Gate V1',
          timestamp: publishedCall?.published_at,
          reasonCodes: publishedCall?.reason_codes,
          configIdentities: {
            'Decision Snapshot ID': decId,
            'Lifecycle State': lifecycle,
            'Backend Action': backendAction,
            'Staleness Limit': `${publishedCall?.staleness_threshold_s ?? 4.0}s`,
          },
          evidenceItems: [
            { label: 'Published Action', value: headlineCall },
            { label: 'Lifecycle Status', value: lifecycle },
            { label: 'Primary Basis', value: primaryBasis },
            { label: 'Robustness', value: robustness },
          ],
        })
      }
      title="Click to inspect cryptographic DecisionSnapshot record"
      aria-label="Published KYNTRA Strategy Decision"
    >
      {/* 1. Header: Conclusion Identifier + Lifecycle Badge */}
      <div className="call-card-header">
        <div className="call-header-left">
          <span className="call-section-title font-bold">04. KYNTRA CALL</span>
          <span className="call-provenance-tag text-muted">FINAL PUBLICATION GATE</span>
        </div>
        <LifecycleBadge state={lifecycle} />
      </div>

      {/* 2. Hero Headline (Major Decision Typography: 24-28px, No Neon Glow) */}
      <div className="call-card-headline-zone">
        <div className="call-hero-title font-bold">
          {headlineCall}
        </div>
        <div className="call-metadata-line text-secondary">
          <span className="meta-item">
            ACTION: <strong className="text-primary">{backendAction}</strong>
          </span>
          <span className="meta-sep">&bull;</span>
          <span className="meta-item text-muted">
            ROBUSTNESS: <span className="text-secondary">{robustness}</span>
          </span>
        </div>
      </div>

      {/* 3. Primary Basis & Rationale (Clean readable phrases) */}
      <div className="call-basis-box">
        <span className="basis-label text-muted">PRIMARY BASIS:</span>
        <span className="basis-text text-secondary">{primaryBasis}</span>
      </div>

      {/* 4. Forensic Snapshot ID Footer */}
      <div className="call-footer-row text-muted">
        <span className="footer-lbl">DECISION ID:</span>
        <span className="footer-id mono-num text-secondary">
          {decId.length > 24 ? `${decId.slice(0, 24)}...` : decId}
        </span>
      </div>
    </div>
  );
};
