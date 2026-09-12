import React, { useMemo } from 'react';
import type { CarState } from '../../types';

interface TimingTowerProps {
  cars: Record<string, CarState>;
  attackerCode?: string | null;
  defenderCode?: string | null;
  selectedBattleId?: string | null;
  onSelectCar?: (driver: string) => void;
}

export const TimingTower: React.FC<TimingTowerProps> = ({
  cars,
  attackerCode,
  defenderCode,
  onSelectCar,
}) => {
  const sortedCars = useMemo(() => {
    const list = Object.values(cars);
    return list.sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  }, [cars]);

  return (
    <div className="timing-tower-panel" aria-label="Race Running Order Timing Tower">
      <div className="tower-header-row">
        <span className="tower-title font-bold">TIMING TOWER</span>
        <span className="tower-count text-muted mono-num">{sortedCars.length} CARS</span>
      </div>

      <div className="table-bounded-scroll tower-scroll-area">
        <table className="timing-table">
          <thead>
            <tr>
              <th className="col-pos">P</th>
              <th className="col-driver">DRIVER</th>
              <th className="col-gap">GAP</th>
              <th className="col-int">INT</th>
              <th className="col-tyre">TYRE</th>
            </tr>
          </thead>
          <tbody>
            {sortedCars.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell text-muted">
                  No telemetry cars available
                </td>
              </tr>
            ) : (
              sortedCars.map((car, idx) => {
                const isAttacker = car.driver === attackerCode;
                const isDefender = car.driver === defenderCode;
                const isBattleParticipant = isAttacker || isDefender;

                let rowClass = 'row-neutral';
                if (isAttacker) rowClass = 'row-attacker';
                if (isDefender) rowClass = 'row-defender';

                const interval =
                  idx === 0
                    ? 'LEADER'
                    : car.gap_to_car_ahead !== undefined && car.gap_to_car_ahead !== null
                    ? `+${car.gap_to_car_ahead.toFixed(1)}s`
                    : '—';

                const gapLeader =
                  idx === 0
                    ? '0.0s'
                    : car.gap_to_leader !== undefined && car.gap_to_leader !== null
                    ? `+${car.gap_to_leader.toFixed(1)}s`
                    : '—';

                return (
                  <tr
                    key={car.driver}
                    className={`timing-row ${rowClass} ${onSelectCar ? 'clickable' : ''}`}
                    onClick={() => onSelectCar && onSelectCar(car.driver)}
                    title={
                      isAttacker
                        ? `ATTACKER [${car.driver}] in tracked battle`
                        : isDefender
                        ? `DEFENDER [${car.driver}] in tracked battle`
                        : `Select ${car.driver}`
                    }
                  >
                    <td className="col-pos mono-num font-bold">
                      {car.position ?? idx + 1}
                    </td>
                    <td className="col-driver">
                      <span className="driver-flag-slot">
                        {isBattleParticipant ? (
                          <span className={`battle-marker-dot ${isAttacker ? 'dot-atk' : 'dot-def'}`} />
                        ) : (
                          <span className="dot-placeholder" />
                        )}
                      </span>
                      <span className={`driver-code-text ${isAttacker ? 'text-threat font-bold' : isDefender ? 'text-target font-bold' : 'text-primary'}`}>
                        {car.driver}
                      </span>
                    </td>
                    <td className="col-gap text-secondary mono-num">
                      {gapLeader}
                    </td>
                    <td className="col-int text-secondary mono-num">
                      {interval}
                    </td>
                    <td className="col-tyre text-muted">
                      <span className={`tyre-badge tyre-${(car.tyre_compound || 'M').toLowerCase()}`}>
                        {(car.tyre_compound || 'M').slice(0, 1)}
                      </span>
                      <span className="tyre-laps mono-num">{car.tyre_age ?? 10}L</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
