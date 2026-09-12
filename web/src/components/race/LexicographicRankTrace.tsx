import React from 'react';
import type { StrategyMatrixSnapshotData } from '../../types';

interface LexicographicRankTraceProps {
  matrix: StrategyMatrixSnapshotData | null;
  onOpenEvidence?: (target: any) => void;
}

interface TierDefinition {
  tierNum: number;
  id: string;
  label: string;
  shortLabel: string;
}

const CANONICAL_TIERS: TierDefinition[] = [
  { tierNum: 1, id: 'REGULATORY_ELIGIBILITY', label: '1. Regulatory Eligibility', shortLabel: 'Rules' },
  { tierNum: 2, id: 'PHYSICAL_ENERGY_FEASIBILITY', label: '2. Physical Energy Feasibility', shortLabel: 'Energy' },
  { tierNum: 3, id: 'DURABLE_TRACK_POSITION', label: '3. Durable Track Position', shortLabel: 'Durability' },
  { tierNum: 4, id: 'FUTURE_WINDOW_DOMINANCE', label: '4. Future Window Dominance', shortLabel: 'Future Window' },
  { tierNum: 5, id: 'CUMULATIVE_LAP_TIME', label: '5. Cumulative Lap Time', shortLabel: 'Lap Time' },
  { tierNum: 6, id: 'TERMINAL_SIMULATED_ENERGY', label: '6. Terminal Simulated Energy', shortLabel: 'Terminal Energy' },
];

const ACTIONS_CONFIG: Array<{
  key: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';
  operatorLabel: string;
}> = [
  { key: 'CONSERVE', operatorLabel: 'SAVE ENERGY' },
  { key: 'BUILD', operatorLabel: 'PREPARE' },
  { key: 'DEPLOY', operatorLabel: 'APPLY PRESSURE' },
  { key: 'OVERTAKE', operatorLabel: 'OVERTAKE NOW' },
];

export const LexicographicRankTrace: React.FC<LexicographicRankTraceProps> = ({
  matrix,
  onOpenEvidence,
}) => {
  if (!matrix || !matrix.actions) {
    return null;
  }

  const actions = matrix.actions;
  const ranking = matrix.ranking;
  const winnerAction = ranking?.winner || matrix.recommendation?.canonical_action;

  // Map tier name to 1-indexed number
  const getTierNumber = (tierName?: string | null): number => {
    if (!tierName) return 99;
    const found = CANONICAL_TIERS.find((t) => t.id === tierName);
    return found ? found.tierNum : 99;
  };

  return (
    <div className="lexicographic-rank-trace-container mono" aria-label="Lexicographic 6-Tier Rank Trace">
      <div className="rank-trace-header">
        <div className="trace-title-group">
          <span className="trace-badge font-bold">LEXICOGRAPHIC RANK TRACE</span>
          <span className="trace-subtitle text-muted">
            DETERMINISTIC 6-TIER HIERARCHICAL ELIMINATION
          </span>
        </div>
        <span className="trace-hierarchy-tag text-accent font-bold">
          TIER 1 (RULES) &rarr; TIER 6 (ENERGY)
        </span>
      </div>

      <div className="rank-trace-grid">
        {ACTIONS_CONFIG.map(({ key, operatorLabel }) => {
          const actData = actions[key];
          const isWinner = winnerAction === key;
          const rankingRes = actData?.ranking_result;
          const isBlocked = actData?.rule_eligibility?.status === 'BLOCKED';

          // Determine elimination tier
          let elimTierNum = 99;
          let elimReason = rankingRes?.elimination_reason || '';

          if (isBlocked) {
            elimTierNum = 1;
            elimReason = 'Restricted by active rule state';
          } else if (rankingRes?.elimination_tier) {
            elimTierNum = getTierNumber(rankingRes.elimination_tier);
          } else if (key === 'OVERTAKE' && actData?.post_pass_stability?.verdict === 'HIGH_RISK') {
            elimTierNum = 3;
            elimReason = 'High post-pass risk';
          } else if (!isWinner && rankingRes?.excluded) {
            elimTierNum = 4;
            elimReason = 'Dominated by superior future window';
          }

          const cardClass = isWinner
            ? 'trace-card trace-winner'
            : isBlocked
            ? 'trace-card trace-blocked'
            : 'trace-card trace-eliminated';

          return (
            <div
              key={key}
              className={cardClass}
              onClick={() => {
                if (onOpenEvidence) {
                  onOpenEvidence({
                    title: `${operatorLabel} [${key}] — Lexicographic Trace`,
                    value: isWinner ? 'SELECTED WINNER' : `ELIMINATED AT TIER ${elimTierNum}`,
                    status: isWinner ? 'VALID' : isBlocked ? 'BLOCKED' : 'INFO',
                    provenance: 'DERIVED',
                    method: 'Lexicographic 6-Tier Elimination Sequence',
                    evidenceItems: [
                      { label: 'Action Key', value: key },
                      { label: 'Operator Label', value: operatorLabel },
                      { label: 'Evaluation Result', value: isWinner ? 'Dominant across tested tiers' : elimReason || `Eliminated at Tier ${elimTierNum}` },
                      { label: 'Rule Status', value: actData?.rule_eligibility?.status || 'UNKNOWN' },
                      { label: 'Stability Verdict', value: actData?.post_pass_stability?.verdict || 'UNKNOWN' },
                    ],
                  });
                }
              }}
              title="Click to inspect lexicographic audit trace"
            >
              <div className="trace-card-top">
                <div className="action-title font-bold">{operatorLabel}</div>
                <div className="action-key text-muted">[{key}]</div>
                {isWinner && <span className="winner-pill font-bold">&starf; WINNER</span>}
                {isBlocked && <span className="blocked-pill font-bold">BLOCKED</span>}
              </div>

              {/* 6-Tier Sequential Checklist */}
              <div className="trace-tiers-list">
                {CANONICAL_TIERS.map((tier) => {
                  let statusSymbol = '&mdash;';
                  let statusClass = 'tier-not-reached text-muted';
                  let statusText = 'Not reached';

                  if (isWinner) {
                    // Winner cleared all evaluated tiers
                    statusSymbol = '&check;';
                    statusClass = 'tier-passed text-valid font-bold';
                    statusText = 'Cleared';
                  } else if (tier.tierNum < elimTierNum) {
                    statusSymbol = '&check;';
                    statusClass = 'tier-passed text-valid font-bold';
                    statusText = 'Passed';
                  } else if (tier.tierNum === elimTierNum) {
                    statusSymbol = '&cross;';
                    statusClass = 'tier-failed text-threat font-bold';
                    statusText = 'Eliminated';
                  }

                  return (
                    <div key={tier.id} className="tier-row">
                      <span
                        className={`tier-sym ${statusClass}`}
                        dangerouslySetInnerHTML={{ __html: statusSymbol }}
                      />
                      <span className="tier-name">{tier.shortLabel}</span>
                      <span className="tier-status-sub text-muted">{statusText}</span>
                    </div>
                  );
                })}
              </div>

              {/* Elimination / Winner Summary Footer */}
              <div className="trace-card-footer">
                {isWinner ? (
                  <div className="footer-winner text-valid font-bold">
                    &rarr; Dominant Strategy
                  </div>
                ) : (
                  <div className="footer-eliminated text-muted">
                    <span className="elim-label text-threat font-bold">
                      &rarr; Eliminated at Tier {elimTierNum <= 6 ? elimTierNum : '4'}
                    </span>
                    {elimReason && <span className="elim-detail">{elimReason}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
