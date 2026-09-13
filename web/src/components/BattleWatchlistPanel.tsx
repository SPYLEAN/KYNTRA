import React from 'react';
import type { BattleWatchlistItem } from '../types';

interface BattleWatchlistPanelProps {
  watchlist: BattleWatchlistItem[];
  selectedBattleId?: string | null;
  canonicalRuleStatus?: string | null;
  onSelectBattle: (battleId: string) => void;
}

export const BattleWatchlistPanel: React.FC<BattleWatchlistPanelProps> = ({
  watchlist,
  selectedBattleId,
  canonicalRuleStatus,
  onSelectBattle,
}) => {
  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'badge-critical';
      case 'ACTIVE':
        return 'badge-active';
      case 'FORMING':
        return 'badge-forming';
      case 'WATCH':
        return 'badge-watch';
      default:
        return 'badge-unknown';
    }
  };

  return (
    <div className="battle-watchlist-panel" aria-label="Battle Watchlist">
      {/* Header with Candidates Count */}
      <div className="watchlist-header-bar">
        <span className="watchlist-title font-bold">BATTLE WATCH</span>
        <span className="candidates-count text-muted mono-num">
          {watchlist.length} DETECTED PROXIMITY CANDIDATES
        </span>
      </div>

      {/* When 0 live candidates exist, display concise truth state + tracked battle link if present */}
      {watchlist.length === 0 ? (
        <div className="watchlist-empty-state">
          <div className="empty-notice text-muted">
            0 live proximity candidates (&le;2.5s). Field spread out.
          </div>
          {selectedBattleId && (
            <div className="tracked-session-row">
              <span className="tracked-tag font-bold text-secondary">TRACKED BATTLE:</span>
              <span className="tracked-code font-bold text-primary mono-num">
                {selectedBattleId}
              </span>
              <span className="tracked-prov text-muted">[SESSION / REPLAY]</span>
            </div>
          )}
        </div>
      ) : (
        <div className="watchlist-table-wrapper">
          <table className="watchlist-table">
            <thead>
              <tr>
                <th>PRIORITY</th>
                <th>ENGAGEMENT</th>
                <th>GAP</th>
                <th>TREND</th>
                <th>RULE</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((item) => {
                const isSelected = item.battle_id === selectedBattleId;
                const effectiveStatus = isSelected && canonicalRuleStatus ? canonicalRuleStatus : (item.compliance_status || 'UNKNOWN');
                const isLegal = effectiveStatus === 'LEGAL' || effectiveStatus === 'ALLOWED' || effectiveStatus === 'CLEAR';
                const isBlocked = effectiveStatus === 'BLOCKED' || effectiveStatus === 'DISQUALIFIED';
                const statusLabel = isLegal ? '✓ LEGAL' : isBlocked ? '✕ BLK' : '? UNK';
                const statusClass = isLegal ? 'text-valid' : isBlocked ? 'text-blocked' : 'text-neutral';

                return (
                  <tr
                    key={item.battle_id}
                    className={`watchlist-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelectBattle(item.battle_id)}
                  >
                    <td>
                      <span className={`priority-badge ${getPriorityBadgeClass(item.priority_state)}`}>
                        {item.priority_state}
                      </span>
                    </td>
                    <td className="battle-engagement-cell">
                      <span className="att-code text-threat font-bold">{item.attacker}</span>
                      <span className="arrow text-muted">&rarr;</span>
                      <span className="def-code text-target font-bold">{item.defender}</span>
                    </td>
                    <td className="gap-cell mono-num font-bold">
                      {item.gap_seconds !== null && item.gap_seconds !== undefined
                        ? `${item.gap_seconds.toFixed(2)}s`
                        : '—'}
                    </td>
                    <td>
                      <span className={`trend-tag trend-${item.gap_trend?.toLowerCase() || 'unknown'}`}>
                        {item.gap_trend === 'CLOSING' && '▲ '}
                        {item.gap_trend === 'OPENING' && '▼ '}
                        {item.gap_trend || 'STABLE'}
                      </span>
                    </td>
                    <td>
                      <span className={statusClass}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
