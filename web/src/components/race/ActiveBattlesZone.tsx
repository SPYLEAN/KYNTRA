import React, { useMemo, useState } from 'react';
import type { ActiveBattleTracker, BattleWatchlistItem } from '../../types';

interface ActiveBattlesZoneProps {
  runtimeBattles: ActiveBattleTracker[];
  watchlist: BattleWatchlistItem[];
  selectedBattleId?: string | null;
  onSelectBattle: (battleId: string) => void;
}

export const ActiveBattlesZone: React.FC<ActiveBattlesZoneProps> = ({
  runtimeBattles,
  watchlist,
  selectedBattleId,
  onSelectBattle,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSING'>('ALL');

  // Merge runtime tracker and watchlist data
  const mergedBattles = useMemo(() => {
    if (runtimeBattles && runtimeBattles.length > 0) {
      return runtimeBattles.map((tb) => {
        const wlItem = watchlist.find((w) => w.battle_id === tb.battle_id);
        return {
          battle_id: tb.battle_id,
          attacker: tb.attacker,
          defender: tb.defender,
          gap_seconds: tb.current_gap_s,
          laps_active: tb.laps_active,
          is_continuous: tb.is_continuous_over_laps,
          is_expired: tb.is_expired,
          window_state: tb.window_state,
          priority_state: wlItem?.priority_state || (tb.current_gap_s <= 1.0 ? 'CRITICAL' : 'ACTIVE'),
          closing_state: wlItem?.closing_state || (tb.current_gap_s < 1.5 ? 'CLOSING' : 'STABLE'),
        };
      });
    }

    // Fallback to watchlist items
    return watchlist.map((w) => ({
      battle_id: w.battle_id,
      attacker: w.attacker,
      defender: w.defender,
      gap_seconds: w.gap_seconds ?? 2.0,
      laps_active: 1,
      is_continuous: true,
      is_expired: false,
      window_state: w.window_state || 'UNKNOWN',
      priority_state: w.priority_state,
      closing_state: w.closing_state || 'STABLE',
    }));
  }, [runtimeBattles, watchlist]);

  const filteredBattles = useMemo(() => {
    let list = [...mergedBattles];
    if (filter === 'ACTIVE') {
      list = list.filter((b) => !b.is_expired && b.gap_seconds <= 3.0);
    } else if (filter === 'CLOSING') {
      list = list.filter((b) => b.closing_state === 'CLOSING');
    }
    return list.sort((a, b) => (a.gap_seconds ?? 99) - (b.gap_seconds ?? 99));
  }, [mergedBattles, filter]);

  return (
    <div className="active-battles-panel">
      <div className="battles-header-row">
        <div className="title-group">
          <span className="battles-title font-bold mono">ACTIVE BATTLES</span>
          <span className="battles-count mono text-muted">
            {filteredBattles.length} TRACKED
          </span>
        </div>
        <div className="filter-pill-group mono">
          <button
            type="button"
            className={`filter-pill ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            ALL
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setFilter('ACTIVE')}
          >
            &le;3.0s
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'CLOSING' ? 'active' : ''}`}
            onClick={() => setFilter('CLOSING')}
          >
            CATCH
          </button>
        </div>
      </div>

      <div className="table-bounded-scroll battles-scroll-area">
        {filteredBattles.length === 0 ? (
          <div className="no-battles-state mono text-muted">
            No active battles detected within &le;3.5s window.
          </div>
        ) : (
          filteredBattles.map((b) => {
            const isSelected = b.battle_id === selectedBattleId;
            const isClosing = b.closing_state === 'CLOSING';

            return (
              <div
                key={b.battle_id}
                className={`battle-card-row mono ${isSelected ? 'selected' : ''} ${
                  b.is_expired ? 'expired' : ''
                }`}
                onClick={() => onSelectBattle(b.battle_id)}
                title="Click to focus strategist workstation on this battle"
              >
                <div className="battle-main-line">
                  <div className="battle-pair">
                    <span className="attacker-code font-bold">{b.attacker}</span>
                    <span className="pair-arrow">&rarr;</span>
                    <span className="defender-code font-bold">{b.defender}</span>
                  </div>

                  <div className="battle-gap-block">
                    <span className="gap-value font-bold mono-num text-primary">
                      {b.gap_seconds !== null && b.gap_seconds !== undefined
                        ? `${b.gap_seconds.toFixed(2)}s`
                        : '—'}
                    </span>
                    <span className={`trend-indicator ${isClosing ? 'trend-catch' : 'trend-stable'}`}>
                      {isClosing ? '▼ CATCH' : '■ STABLE'}
                    </span>
                  </div>
                </div>

                <div className="battle-meta-line text-muted">
                  <span className="meta-item">
                    LAPS: <strong className="text-secondary mono-num">{b.laps_active}L</strong>
                  </span>
                  <span className="meta-item">
                    WIN: <strong className="text-secondary">{b.window_state}</strong>
                  </span>
                  {isSelected && <span className="selected-tag font-bold">FOCUSED</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
