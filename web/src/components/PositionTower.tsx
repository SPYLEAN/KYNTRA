import React from 'react';
import type { CarState } from '../types';

interface PositionTowerProps {
  cars: Record<string, CarState>;
  attackerCode?: string | null;
  defenderCode?: string | null;
  onSelectCar?: (driver: string) => void;
  onSelectBattle?: (battleId: string) => void;
  selectedBattleId?: string | null;
}

export const PositionTower: React.FC<PositionTowerProps> = ({
  cars,
  attackerCode,
  defenderCode,
  onSelectCar,
  onSelectBattle,
  selectedBattleId,
}) => {
  const carList = Object.values(cars).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const carCount = carList.length;

  return (
    <div className="position-tower-pane">
      <div className="pane-header">
        <div className="pane-title-group">
          <span className="pane-label font-bold">TIMING TOWER</span>
          <span className="pane-count-badge mono">{carCount} CARS MONITORED</span>
        </div>
      </div>

      <div className="tower-table-wrapper table-bounded-scroll">
        <table className="standard-table tower-table">
          <thead>
            <tr>
              <th className="th-pos">POS</th>
              <th className="th-car">CAR</th>
              <th className="th-driver">DRIVER</th>
              <th className="th-int">INT</th>
              <th className="th-gap">GAP</th>
              <th className="th-tyre">TYRE</th>
              <th className="th-pace">PACE</th>
              <th className="th-pit">PIT</th>
              <th className="th-role">ROLE</th>
            </tr>
          </thead>
          <tbody>
            {carList.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-muted" style={{ padding: '16px' }}>
                  AWAITING FIELD TELEMETRY...
                </td>
              </tr>
            ) : (
              carList.map((car) => {
                const isAttacker = car.driver === attackerCode;
                const isDefender = car.driver === defenderCode;
                const rowClass = isAttacker
                  ? 'tower-row-attacker battle-active-row'
                  : isDefender
                  ? 'tower-row-defender battle-active-row'
                  : '';

                return (
                  <tr
                    key={car.driver}
                    className={`tower-row interactive-row ${rowClass}`}
                    onClick={() => {
                      if (onSelectCar) onSelectCar(car.driver);
                      if (onSelectBattle && selectedBattleId && (isAttacker || isDefender)) {
                        onSelectBattle(selectedBattleId);
                      }
                    }}
                    title={`Click to inspect #${car.number} ${car.name || car.driver}`}
                  >
                    <td className="mono font-bold text-accent">P{car.position ?? '—'}</td>
                    <td className="mono text-muted">#{car.number}</td>
                    <td className="font-bold">
                      <span className="driver-color-chip" style={{ backgroundColor: car.color || '#64748b' }} />
                      {car.driver}
                    </td>
                    <td className="mono text-secondary">
                      {car.gap_to_car_ahead !== null && car.gap_to_car_ahead !== undefined
                        ? `+${car.gap_to_car_ahead.toFixed(2)}s`
                        : '—'}
                    </td>
                    <td className="mono">
                      {car.gap_to_leader !== null && car.gap_to_leader !== undefined
                        ? car.gap_to_leader === 0
                          ? 'LEADER'
                          : `+${car.gap_to_leader.toFixed(2)}s`
                        : '—'}
                    </td>
                    <td className="mono">
                      {car.tyre_compound ? (
                        <>
                          <span className={`tyre-badge tyre-${car.tyre_compound.toLowerCase()}`}>
                            {car.tyre_compound[0]}
                          </span>{' '}
                          <span className="text-muted">
                            {car.tyre_age !== null && car.tyre_age !== undefined ? `${car.tyre_age}L` : '—'}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="mono text-secondary">
                      {car.last_lap_time || '—'}
                    </td>
                    <td className="mono text-muted">{car.pit_status || 'TRACK'}</td>
                    <td>
                      {isAttacker && <span className="role-tag role-attacker">ATT</span>}
                      {isDefender && <span className="role-tag role-defender">DEF</span>}
                      {!isAttacker && !isDefender && <span className="text-muted">—</span>}
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
