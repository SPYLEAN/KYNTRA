import React from 'react';
import type { BattleWatchlistItem } from '../types';

interface BattleWatchlistPanelProps {
  watchlist: BattleWatchlistItem[];
  selectedBattleId?: string | null;
  onSelectBattle: (battleId: string) => void;
}

export const BattleWatchlistPanel: React.FC<BattleWatchlistPanelProps> = ({
  watchlist,
  selectedBattleId,
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

  const getWindowBadgeClass = (windowState?: string | null) => {
    switch (windowState) {
      case 'PEAKING':
        return 'window-peaking';
      case 'FORMING':
        return 'window-forming';
      case 'FADING':
        return 'window-fading';
      case 'STABLE':
        return 'window-stable';
      default:
        return 'window-unknown';
    }
  };

  return (
    <div className="battle-watchlist-panel">
      <div className="panel-header-simple" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Active Battle Watchlist</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {watchlist.length} CANDIDATES DISCOVERED
        </span>
      </div>

      {watchlist.length === 0 ? (
        <div className="empty-watchlist-msg">
          No active battles within proximity threshold (&le; 2.5s). Field spread out.
        </div>
      ) : (
        <div className="watchlist-table-wrapper">
          <table className="watchlist-table">
            <thead>
              <tr>
                <th>PRIORITY</th>
                <th>ENGAGEMENT</th>
                <th>POS</th>
                <th>GAP</th>
                <th>TREND</th>
                <th title="Qualitative Trajectory Heuristic — Not an ML Probability">WINDOW (HEURISTIC)</th>
                <th>RULE</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((item) => {
                const isSelected = item.battle_id === selectedBattleId;
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
                      <span className="att-code">{item.attacker}</span>
                      <span className="arrow">&rarr;</span>
                      <span className="def-code">{item.defender}</span>
                    </td>
                    <td className="mono text-muted">
                      {item.attacker_position ? `P${item.attacker_position}` : '-'} / {item.defender_position ? `P${item.defender_position}` : '-'}
                    </td>
                    <td className="mono font-bold">
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
                      <span className={`window-badge ${getWindowBadgeClass(item.window_state)}`}>
                        {item.window_state || 'UNKNOWN'}
                      </span>
                    </td>
                    <td>
                      <span className={item.compliance_status === 'LEGAL' ? 'text-legal' : 'text-blocked'}>
                        {item.compliance_status === 'LEGAL' ? '✓ LEGAL' : '✕ BLK'}
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
