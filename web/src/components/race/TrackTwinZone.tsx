import React from 'react';
import type { CarState, TrackGeometry } from '../../types';
import { DigitalTrackTwin } from '../DigitalTrackTwin';

interface TrackTwinZoneProps {
  geometry: TrackGeometry | null;
  cars: Record<string, CarState>;
  attackerCode?: string | null;
  defenderCode?: string | null;
  gapSeconds?: number | null;
  closingRate?: number | null;
  distanceGapM?: number | null;
  trackStatus?: string;
  circuitName?: string;
  onSelectCar?: (driver: string) => void;
}

export const TrackTwinZone: React.FC<TrackTwinZoneProps> = ({
  geometry,
  cars,
  attackerCode,
  defenderCode,
  gapSeconds,
  closingRate,
  distanceGapM,
  trackStatus = '1',
  circuitName = 'Monza',
  onSelectCar,
}) => {
  return (
    <div className="track-twin-zone-panel">
      {/* Upper Tactical Status Header */}
      <div className="twin-top-status-bar mono">
        <div className="twin-title-block">
          <span className="twin-circuit-name font-bold">{circuitName}</span>
          <span className="twin-status-chip">
            TRACK: {trackStatus === '1' ? 'GREEN' : trackStatus === '2' ? 'YELLOW' : trackStatus === '4' ? 'SC' : 'VSC'}
          </span>
        </div>

        {attackerCode && defenderCode && (
          <div className="twin-battle-focus-bar">
            <span className="focus-label text-muted">BATTLE FOCUS:</span>
            <span className="focus-pair font-bold">
              {attackerCode} vs {defenderCode}
            </span>
            <span className="focus-gap font-bold text-accent mono-num">
              {gapSeconds !== null && gapSeconds !== undefined ? `${gapSeconds.toFixed(2)}s` : '—'}
            </span>
            {distanceGapM && (
              <span className="focus-dist text-secondary mono-num">
                ({distanceGapM.toFixed(0)}m)
              </span>
            )}
          </div>
        )}
      </div>

      {/* SVG Canvas Frame */}
      <div className="twin-canvas-frame">
        <DigitalTrackTwin
          geometry={geometry}
          cars={cars}
          attackerCode={attackerCode}
          defenderCode={defenderCode}
          gapSeconds={gapSeconds ?? undefined}
          closingRate={closingRate ?? undefined}
          spatialGapMeters={distanceGapM ?? undefined}
          trackStatus={trackStatus}
          circuitName={circuitName}
          onSelectCar={onSelectCar}
        />
      </div>
    </div>
  );
};
