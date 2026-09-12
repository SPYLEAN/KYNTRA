import React, { useEffect, useMemo, useState } from 'react';
import type { CarState, TrackGeometry, TrackLayerState, TrackViewMode } from '../types';

interface DigitalTrackTwinProps {
  geometry: TrackGeometry | null;
  cars: Record<string, CarState>;
  attackerCode?: string | null;
  defenderCode?: string | null;
  gapSeconds?: number | null;
  closingRate?: number | null;
  trackStatus?: string;
  circuitName?: string;
  onSelectCar?: (driver: string) => void;
  spatialGapMeters?: number | null;
}

export const DigitalTrackTwin: React.FC<DigitalTrackTwinProps> = ({
  geometry,
  cars,
  attackerCode,
  defenderCode,
  gapSeconds,
  closingRate,
  trackStatus = '1',
  circuitName = 'Monza',
  onSelectCar,
  spatialGapMeters,
}) => {
  const [viewMode, setViewMode] = useState<TrackViewMode>('FIELD');
  const [layers, setLayers] = useState<TrackLayerState>({
    cars: true,
    sectors: true,
    battles: true,
  });

  // Track recent breadcrumb trail for selected cars
  const [attackerTrail, setAttackerTrail] = useState<{ x: number; y: number }[]>([]);
  const [defenderTrail, setDefenderTrail] = useState<{ x: number; y: number }[]>([]);

  const toggleLayer = (layer: 'cars' | 'sectors' | 'battles') => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Interpolate car coordinate on track from progress [0..1]
  const getCarCoordinates = (progress: number | null | undefined): { x: number; y: number } => {
    if (!geometry || !geometry.points || geometry.points.length === 0) {
      return { x: 500, y: 300 };
    }
    const p = Math.max(0, Math.min(1, progress || 0));
    const idx = Math.min(
      Math.floor(p * (geometry.points.length - 1)),
      geometry.points.length - 1
    );
    return geometry.points[idx] || { x: 500, y: 300 };
  };

  const carList = Object.values(cars);

  // Find coordinates for attacker and defender if present
  const attackerCar = attackerCode ? cars[attackerCode] : null;
  const defenderCar = defenderCode ? cars[defenderCode] : null;

  const attCoords = attackerCar ? getCarCoordinates(attackerCar.progress) : null;
  const defCoords = defenderCar ? getCarCoordinates(defenderCar.progress) : null;

  // Update breadcrumb trails
  useEffect(() => {
    if (attCoords) {
      setAttackerTrail((prev) => [...prev.slice(-6), attCoords]);
    }
  }, [attCoords?.x, attCoords?.y]);

  useEffect(() => {
    if (defCoords) {
      setDefenderTrail((prev) => [...prev.slice(-6), defCoords]);
    }
  }, [defCoords?.x, defCoords?.y]);

  const isNeutralized = ['2', '4', '5', '6', '7', 'SC', 'VSC', 'RED'].includes(trackStatus);
  const trackStrokeColor = isNeutralized ? '#f59e0b' : '#334155';

  // Start / Finish line coordinates at progress 0.0
  const sfCoords = getCarCoordinates(0.0);
  const sfNextCoords = getCarCoordinates(0.02);

  // Compute dynamic SVG viewBox fitted to 85-90% of available pane without empty margins
  const effectiveViewBox = useMemo(() => {
    if (viewMode === 'FOCUS' && attCoords && defCoords) {
      const midX = (attCoords.x + defCoords.x) / 2;
      const midY = (attCoords.y + defCoords.y) / 2;
      const dist = Math.hypot(attCoords.x - defCoords.x, attCoords.y - defCoords.y);
      const spanW = Math.max(220, dist * 2.2);
      const spanH = spanW * 0.58;
      const x = Math.round(midX - spanW / 2);
      const y = Math.round(midY - spanH / 2);
      return `${x} ${y} ${Math.round(spanW)} ${Math.round(spanH)}`;
    }

    // FIELD MODE: Calculate tight bounding box from real circuit points with 6% padding (85-90% fill)
    if (geometry && geometry.points && geometry.points.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const pt of geometry.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const padX = spanX * 0.06;
      const padY = spanY * 0.06;
      const vx = Math.round(minX - padX);
      const vy = Math.round(minY - padY);
      const vw = Math.round(spanX + padX * 2);
      const vh = Math.round(spanY + padY * 2);
      return `${vx} ${vy} ${vw} ${vh}`;
    }

    return geometry?.view_box || '0 0 1000 600';
  }, [viewMode, attCoords, defCoords, geometry]);

  return (
    <div className="digital-track-twin-card">
      {/* Track Twin Header Bar */}
      <div className="track-twin-header">
        <div className="track-title-block">
          <span className="track-twin-badge font-bold">DIGITAL TRACK TWIN</span>
          <span className="track-circuit-name">{circuitName}</span>
          <span className="track-provenance-tag mono">TELEMETRY-DERIVED CIRCUIT GEOMETRY</span>
          <span className="track-field-count mono font-bold text-accent">{carList.length} CARS</span>
        </div>

        {/* Camera Focus Mode Toggles */}
        <div className="track-camera-controls" role="group" aria-label="Camera modes">
          <span className="camera-label mono font-bold">CAMERA:</span>
          <button
            type="button"
            className={`cam-mode-btn ${viewMode === 'FIELD' ? 'active' : ''}`}
            onClick={() => setViewMode('FIELD')}
            title="Field View: Entire Circuit Overview"
          >
            FIELD
          </button>
          <button
            type="button"
            className={`cam-mode-btn ${viewMode === 'FOCUS' ? 'active' : ''}`}
            onClick={() => setViewMode('FOCUS')}
            title="Battle Focus: Dynamically frame active engagement"
            disabled={!attCoords || !defCoords}
          >
            FOCUS
          </button>
        </div>

        {/* Layer Toggles (All functional, dead controls removed) */}
        <div className="track-layer-toggles" role="toolbar" aria-label="Track layers">
          <span className="layer-label mono font-bold">LAYERS:</span>
          <button
            type="button"
            className={`layer-btn ${layers.cars ? 'active' : ''}`}
            onClick={() => toggleLayer('cars')}
            title="Toggle Car Positions"
          >
            CARS
          </button>
          <button
            type="button"
            className={`layer-btn ${layers.sectors ? 'active' : ''}`}
            onClick={() => toggleLayer('sectors')}
            title="Toggle Sector Splits"
          >
            SECTORS
          </button>
          <button
            type="button"
            className={`layer-btn ${layers.battles ? 'active' : ''}`}
            onClick={() => toggleLayer('battles')}
            title="Toggle Active Battle Vector"
          >
            BATTLES
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="track-svg-container">
        <svg
          viewBox={effectiveViewBox}
          className="track-svg"
          preserveAspectRatio="xMidYMid meet"
          style={{ transition: 'viewBox 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <defs>
            {/* Direction Arrow Marker */}
            <marker
              id="dir-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#00e5ff" />
            </marker>

            {/* Battle Arrow Marker */}
            <marker
              id="battle-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 8 5 L 0 8 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Primary Track Ribbon (Clean Engineering Vector) */}
          <path
            d={geometry?.path_d || 'M 200 300 L 800 300'}
            fill="none"
            stroke={trackStrokeColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Center Progress Guide Line */}
          <path
            d={geometry?.path_d || 'M 200 300 L 800 300'}
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />

          {/* Start / Finish Line */}
          {sfCoords && (
            <g transform={`translate(${sfCoords.x}, ${sfCoords.y})`}>
              <line x1="-6" y1="-6" x2="6" y2="6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
              <text x="9" y="3" fill="rgba(255,255,255,0.7)" fontSize="8" fontWeight="600">
                S/F
              </text>
            </g>
          )}

          {/* Direction Indicator Vector */}
          {sfCoords && sfNextCoords && (
            <line
              x1={sfCoords.x}
              y1={sfCoords.y}
              x2={sfNextCoords.x}
              y2={sfNextCoords.y}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.5"
              markerEnd="url(#dir-arrow)"
              opacity="0.6"
            />
          )}

          {/* Sector 1/2/3 division markers */}
          {layers.sectors &&
            geometry?.sector_markers?.map((sm, idx) => {
              const coords = getCarCoordinates(sm.progress);
              return (
                <g key={idx} transform={`translate(${coords.x}, ${coords.y})`}>
                  <circle r="2.5" fill="rgba(245, 158, 11, 0.7)" />
                  <text
                    x="6"
                    y="3"
                    fill="rgba(255,255,255,0.5)"
                    fontSize="7.5"
                    fontWeight="600"
                  >
                    S{sm.sector}
                  </text>
                </g>
              );
            })}

          {/* Attacker Breadcrumb Trail (Restrained Red) */}
          {layers.cars && attackerTrail.length > 1 && (
            <polyline
              points={attackerTrail.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#E05252"
              strokeWidth="1.5"
              strokeDasharray="2 3"
              opacity="0.5"
            />
          )}

          {/* Defender Breadcrumb Trail (Restrained Cyan/Sky) */}
          {layers.cars && defenderTrail.length > 1 && (
            <polyline
              points={defenderTrail.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeDasharray="2 3"
              opacity="0.5"
            />
          )}

          {/* Battle Engagement Line between Attacker & Defender */}
          {layers.battles && attCoords && defCoords && attackerCode !== defenderCode && (
            <g className="battle-vector-group">
              <line
                x1={attCoords.x}
                y1={attCoords.y}
                x2={defCoords.x}
                y2={defCoords.y}
                stroke="rgba(245, 158, 11, 0.5)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Midpoint Compact Operational Vector Badge (Clean & Non-Obtrusive) */}
              <g transform={`translate(${(attCoords.x + defCoords.x) / 2}, ${(attCoords.y + defCoords.y) / 2 - 12})`}>
                <rect
                  x="-42"
                  y="-9"
                  width="84"
                  height="18"
                  rx="3"
                  fill="#101318"
                  stroke="rgba(255, 255, 255, 0.14)"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#F2F4F5"
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {gapSeconds !== null && gapSeconds !== undefined ? `${gapSeconds.toFixed(2)}s` : '—'}
                  {closingRate != null ? ` (${closingRate > 0 ? '+' : ''}${closingRate.toFixed(1)}m/s)` : ''}
                  {spatialGapMeters != null ? ` • ${Math.round(spatialGapMeters)}m` : ''}
                </text>
              </g>
            </g>
          )}

          {/* Car Markers along Track */}
          {layers.cars &&
            carList.map((car) => {
              const coords = getCarCoordinates(car.progress);
              const isAttacker = car.driver === attackerCode;
              const isDefender = car.driver === defenderCode;
              const carColor = isAttacker ? '#E05252' : isDefender ? '#38BDF8' : (car.color || '#475569');

              return (
                <g
                  key={car.driver}
                  transform={`translate(${coords.x}, ${coords.y})`}
                  style={{ transition: 'transform 0.4s ease-out', cursor: 'pointer' }}
                  onClick={() => onSelectCar && onSelectCar(car.driver)}
                >
                  {/* Attacker Target Ring (Restrained Red) */}
                  {isAttacker && (
                    <circle
                      r="12"
                      fill="none"
                      stroke="#E05252"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      opacity="0.9"
                    />
                  )}

                  {/* Defender Target Ring (Restrained Cyan) */}
                  {isDefender && (
                    <circle
                      r="12"
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      opacity="0.9"
                    />
                  )}

                  {/* Core Car Marker Circle */}
                  <circle
                    r={isAttacker || isDefender ? '7.5' : '5.5'}
                    fill={carColor}
                    stroke={isAttacker ? '#E05252' : isDefender ? '#38BDF8' : 'rgba(0,0,0,0.5)'}
                    strokeWidth={isAttacker || isDefender ? '1.5' : '1'}
                  />

                  {/* Driver Code Label */}
                  <text
                    y={isAttacker || isDefender ? '-11' : '-9'}
                    textAnchor="middle"
                    fill={isAttacker ? '#E05252' : isDefender ? '#38BDF8' : '#94A3B8'}
                    fontSize={isAttacker || isDefender ? '9' : '7.5'}
                    fontWeight={isAttacker || isDefender ? '700' : '500'}
                    fontFamily="monospace"
                  >
                    {car.driver}
                  </text>

                  {/* Position Badge Number inside Circle */}
                  <text
                    y="2.5"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={isAttacker || isDefender ? '7.5' : '6.5'}
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {car.position ?? ''}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
};
