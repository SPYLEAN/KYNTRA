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

  // Strategic UI Call headline
  let uiCallText = 'NO DOMINANT STRATEGY';
  let backendAction = 'NONE';
  let reason = publishedCall?.primary_reason || 'EVALUATING PIT-WALL STRATEGY';

  if (isValid && publishedCall) {
    uiCallText = publishedCall.ui_call;
    backendAction = publishedCall.backend_action;
  } else if (lifecycle === 'PENDING_FINAL_GATE') {
    uiCallText = candidateCall?.ui_call || 'PENDING FINAL GATE';
    backendAction = candidateCall?.canonical_action || 'EVALUATING';
    reason = 'Candidate recommendation pending 7-point safety & staleness gate';
  } else if (lifecycle === 'WITHHELD') {
    uiCallText = 'WITHHELD';
    reason = publishedCall?.primary_reason || 'Gate withheld call due to high risk or rule checks';
  } else if (lifecycle === 'BLOCKED') {
    uiCallText = 'BLOCKED';
    reason = publishedCall?.primary_reason || 'Track neutralized or sporting regulation violation';
  } else if (lifecycle === 'EXPIRED') {
    uiCallText = 'CALL EXPIRED';
    reason = 'Staleness threshold exceeded without fresh race telemetry';
  } else if (lifecycle === 'INVALIDATED') {
    uiCallText = 'INVALIDATED';
    reason = 'Tactical parameters diverged from publication preconditions';
  }

  const decId = publishedCall?.decision_snapshot_id || decisionSnapshotId || 'DEC_FORENSIC_STANDBY';
  const pubTime = publishedCall?.published_at
    ? new Date(publishedCall.published_at).toLocaleTimeString()
    : 'STANDBY';

  return (
    <div className={`kyntra-call-hero-card lifecycle-style-${lifecycle.toLowerCase()}`}>
      {/* Upper Status & Badge Line */}
      <div className="call-hero-topline">
        <div className="call-brand-pill mono">
          <img
            src="/brand/kyntra-symbol-ui.png"
            alt="KYNTRA"
            className="call-symbol"
          />
          <span className="font-bold">KYNTRA CALL</span>
        </div>
        <LifecycleBadge state={lifecycle} />
      </div>

      {/* Main Giant Call Display */}
      <div className="call-main-headline-block">
        <div className="call-massive-label font-bold tracking-tight">
          {uiCallText}
        </div>
        <div className="call-backend-sub mono text-secondary">
          ACTION: <strong className="text-primary font-bold">{backendAction}</strong>
        </div>
      </div>

      {/* Operational Rationale / Reason */}
      <div className="call-reason-box mono">
        <span className="reason-lbl text-muted">PRIMARY BASIS:</span>
        <span className="reason-text text-secondary">{reason}</span>
      </div>

      {/* Forensic Metadata Strip */}
      <div className="call-forensic-strip mono text-muted">
        <div
          className="forensic-item clickable"
          onClick={() =>
            onOpenEvidence({
              title: `Decision Snapshot — ${decId}`,
              value: uiCallText,
              status: isValid ? 'VALID' : 'BLOCKED',
              provenance: 'DERIVED',
              method: '7-Point Final Publication Gate V1',
              timestamp: publishedCall?.published_at,
              reasonCodes: publishedCall?.reason_codes,
              configIdentities: {
                'Decision Snapshot ID': decId,
                'Call ID': publishedCall?.call_id || 'STANDBY',
                'Staleness Threshold': `${publishedCall?.staleness_threshold_s ?? 4.0}s`,
                'Lifecycle State': lifecycle,
              },
            })
          }
          title="Click to inspect decision forensic record"
        >
          <span className="f-lbl">DECISION ID:</span>
          <span className="f-val text-accent font-bold">{decId.slice(0, 18)}...</span>
        </div>

        <div className="forensic-item">
          <span className="f-lbl">PUBLISHED:</span>
          <span className="f-val text-secondary">{pubTime}</span>
        </div>

        {publishedCall?.robustness && (
          <div className="forensic-item">
            <span className="f-lbl">ROBUSTNESS:</span>
            <span className="f-val text-primary font-bold">
              {publishedCall.robustness.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
