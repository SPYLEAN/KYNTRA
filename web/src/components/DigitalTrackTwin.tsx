import React, { useEffect, useMemo, useState } from 'react';
import type { CarState, TrackGeometry, TrackViewMode } from '../types';

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
  const [layers, setLayers] = useState({
    cars: true,
    battles: true,
    sectors: true,
    field: true,
    trails: true,
    labels: true,
  });
  const [overflowOpen, setOverflowOpen] = useState<boolean>(false);

  // Track recent breadcrumb trail for selected cars
  const [attackerTrail, setAttackerTrail] = useState<{ x: number; y: number }[]>([]);
  const [defenderTrail, setDefenderTrail] = useState<{ x: number; y: number }[]>([]);

  const toggleLayer = (layer: 'cars' | 'battles' | 'sectors' | 'field' | 'trails' | 'labels') => {
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

  // Helper to get angle tangent at progress
  const getTangentAngle = (progress: number): number => {
    if (!geometry || !geometry.points || geometry.points.length < 2) return 0;
    const n = geometry.points.length;
    const idx = Math.min(Math.floor(progress * (n - 1)), n - 1);
    const nextIdx = (idx + 1) % n;
    const p1 = geometry.points[idx];
    const p2 = geometry.points[nextIdx];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
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
      setAttackerTrail((prev) => [...prev.slice(-5), attCoords]);
    }
  }, [attCoords?.x, attCoords?.y]);

  useEffect(() => {
    if (defCoords) {
      setDefenderTrail((prev) => [...prev.slice(-5), defCoords]);
    }
  }, [defCoords?.x, defCoords?.y]);

  // Close layer overflow menu on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    const handleOutsideClick = () => setOverflowOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [overflowOpen]);

  const isNeutralized = ['2', '4', '5', '6', '7', 'SC', 'VSC', 'RED'].includes(trackStatus);
  const trackStrokeColor = isNeutralized ? '#f59e0b' : '#475569';

  // Start / Finish line coordinates at progress 0.0
  const sfCoords = getCarCoordinates(0.0);
  const sfAngle = getTangentAngle(0.0);

  // Direction chevron fractions along circuit
  const chevronFractions = [0.12, 0.35, 0.62, 0.85];

  // Check whether geometry is truly available (never fake a circuit)
  const isGeometryAvailable = Boolean(
    geometry &&
    geometry.available !== false &&
    geometry.is_fallback !== true &&
    geometry.points &&
    geometry.points.length >= 20 &&
    geometry.path_d
  );

  const validGeometry = isGeometryAvailable ? geometry : null;

  // Compute dynamic SVG viewBox fitted to 94–96% of available pane (minimal padding, hero scale)
  const effectiveViewBox = useMemo(() => {
    if (viewMode === 'FOCUS' && attCoords && defCoords) {
      const midX = (attCoords.x + defCoords.x) / 2;
      const midY = (attCoords.y + defCoords.y) / 2;
      const dist = Math.hypot(attCoords.x - defCoords.x, attCoords.y - defCoords.y);
      const spanW = Math.max(180, dist * 2.0);
      const spanH = spanW * 0.58;
      const x = Math.round(midX - spanW / 2);
      const y = Math.round(midY - spanH / 2);
      return `${x} ${y} ${Math.round(spanW)} ${Math.round(spanH)}`;
    }

    // FIELD MODE: Calculate tight bounding box from real circuit points with 3.5% padding
    if (validGeometry && validGeometry.points && validGeometry.points.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const pt of validGeometry.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const padX = spanX * 0.035;
      const padY = spanY * 0.035;
      const vx = Math.round(minX - padX);
      const vy = Math.round(minY - padY);
      const vw = Math.round(spanX + padX * 2);
      const vh = Math.round(spanY + padY * 2);
      return `${vx} ${vy} ${vw} ${vh}`;
    }

    return geometry?.view_box || '0 0 1000 600';
  }, [viewMode, attCoords, defCoords, geometry, validGeometry]);

  // Sort cars so unselected render first, defender renders next, attacker renders top
  const sortedCars = useMemo(() => {
    return [...carList].sort((a, b) => {
      const aWeight = a.driver === attackerCode ? 3 : a.driver === defenderCode ? 2 : 1;
      const bWeight = b.driver === attackerCode ? 3 : b.driver === defenderCode ? 2 : 1;
      return aWeight - bWeight;
    });
  }, [carList, attackerCode, defenderCode]);

  return (
    <div className="digital-track-twin-card">
      {/* Track Twin Professional Header Bar */}
      <div className="track-twin-header">
        <div className="track-title-block">
          <span className="track-twin-badge font-bold">DIGITAL TWIN 2.0</span>
          <span className="track-circuit-name">{circuitName}</span>
          {geometry?.event_id && (
            <span className="track-provenance-tag mono font-bold text-muted">
              {geometry.event_id}
            </span>
          )}
          <span className="track-field-count mono font-bold text-accent">{carList.length} CARS</span>
        </div>

        {/* Separate Compact Focus-Lock Control */}
        <div className="track-focus-control" role="group" aria-label="Focus lock control">
          <button
            type="button"
            className={`focus-lock-btn mono font-bold ${viewMode === 'FOCUS' ? 'locked' : ''}`}
            onClick={() => setViewMode((prev) => (prev === 'FOCUS' ? 'FIELD' : 'FOCUS'))}
            disabled={!attCoords || !defCoords}
            title={viewMode === 'FOCUS' ? 'Focus Lock Active (Battle Frame). Click to view field.' : 'Focus Lock Inactive (Field Overview). Click to lock battle focus.'}
          >
            <span className="focus-indicator-dot" />
            <span className="focus-text">FOCUS LOCK: {viewMode === 'FOCUS' ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Compact Layer Controls: LAYERS [CARS] [BATTLE] [SECTORS] [•••] */}
        <div className="track-layer-toggles" role="toolbar" aria-label="Track layers">
          <span className="layer-label mono font-bold">LAYERS</span>
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
            className={`layer-btn ${layers.battles ? 'active' : ''}`}
            onClick={() => toggleLayer('battles')}
            title="Toggle Active Battle Vector"
          >
            BATTLE
          </button>
          <button
            type="button"
            className={`layer-btn ${layers.sectors ? 'active' : ''}`}
            onClick={() => toggleLayer('sectors')}
            title="Toggle Sector Splits"
          >
            SECTORS
          </button>

          {/* Overflow Menu: FIELD, TRAILS, LABELS */}
          <div className="layer-overflow-wrap">
            <button
              type="button"
              className={`layer-btn overflow-trigger ${overflowOpen ? 'active' : ''}`}
              onClick={() => setOverflowOpen((prev) => !prev)}
              title="More layer options (Field, Trails, Labels)"
            >
              •••
            </button>
            {overflowOpen && (
              <div className="layer-overflow-menu mono" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`overflow-item ${layers.field ? 'active' : ''}`}
                  onClick={() => toggleLayer('field')}
                >
                  <span className="overflow-check">{layers.field ? '✓' : ' '}</span>
                  <span>FIELD</span>
                </button>
                <button
                  type="button"
                  className={`overflow-item ${layers.trails ? 'active' : ''}`}
                  onClick={() => toggleLayer('trails')}
                >
                  <span className="overflow-check">{layers.trails ? '✓' : ' '}</span>
                  <span>TRAILS</span>
                </button>
                <button
                  type="button"
                  className={`overflow-item ${layers.labels ? 'active' : ''}`}
                  onClick={() => toggleLayer('labels')}
                >
                  <span className="overflow-check">{layers.labels ? '✓' : ' '}</span>
                  <span>LABELS</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SVG Canvas or Purposeful Unavailable State */}
      <div className="track-svg-container">
        {!validGeometry ? (
          <div className="track-unavailable-state mono">
            <div className="unavailable-card">
              <div className="unavailable-header font-bold text-caution">
                CIRCUIT GEOMETRY UNAVAILABLE
              </div>
              <p className="unavailable-desc text-muted">
                Telemetry positional channels (X/Y coordinates) are not available for this session.
                KYNTRA displays verified spatial data only and does not synthesize fictional circuit geometry.
              </p>
              <div className="unavailable-meta">
                <span>EVENT: {geometry?.event_id || 'UNKNOWN'}</span>
                <span>STATE: POSITIONAL_DATA_ABSENT</span>
              </div>
            </div>
          </div>
        ) : (
          <svg
            viewBox={effectiveViewBox}
            className="track-svg"
            preserveAspectRatio="xMidYMid meet"
            style={{ transition: 'viewBox 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <defs>
              {/* Direction Arrow Marker */}
              <marker
                id="dir-arrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="rgba(255,255,255,0.4)" />
              </marker>

              {/* Attacker Direction Chevron Marker */}
              <marker
                id="att-dir-arrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 2 L 7 5 L 0 8 z" fill="#EF4444" />
              </marker>
            </defs>

            {/* Base Asphalt Track Ribbon (Multi-Layer Professional Width) */}
            <path
              d={validGeometry.path_d}
              fill="none"
              stroke="#1e293b"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />

            {/* Primary Track Centerline (Slate or Yellow Flag Amber) */}
            <path
              d={validGeometry.path_d}
              fill="none"
              stroke={trackStrokeColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Subtle Inner Progress Guide Line */}
            <path
              d={validGeometry.path_d}
              fill="none"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="0.75"
              strokeDasharray="3 5"
            />

            {/* Direction Indication Chevrons along Circuit Travel Path */}
            {chevronFractions.map((frac, idx) => {
              const pt = getCarCoordinates(frac);
              const angle = getTangentAngle(frac);
              return (
                <g key={`chevron-${idx}`} transform={`translate(${pt.x}, ${pt.y}) rotate(${angle})`}>
                  <path
                    d="M -4 -3 L 2 0 L -4 3"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.35)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* Start / Finish Line (Perpendicular Gate & Marker) */}
            {sfCoords && (
              <g transform={`translate(${sfCoords.x}, ${sfCoords.y}) rotate(${sfAngle + 90})`}>
                <line
                  x1="-7"
                  y1="0"
                  x2="7"
                  y2="0"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="square"
                />
                <line
                  x1="-7"
                  y1="-1.5"
                  x2="7"
                  y2="-1.5"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x="10"
                  y="2.5"
                  fill="#ffffff"
                  fontSize="7.5"
                  fontWeight="700"
                  fontFamily="monospace"
                  transform="rotate(-90 10 2.5)"
                >
                  S/F
                </text>
              </g>
            )}

            {/* Sector 1/2/3 division markers */}
            {layers.sectors &&
              validGeometry.sector_markers?.map((sm, idx) => {
                const coords = getCarCoordinates(sm.progress);
                const angle = getTangentAngle(sm.progress);
                return (
                  <g key={`sm-${idx}`} transform={`translate(${coords.x}, ${coords.y})`}>
                    <line
                      x1="-4"
                      y1="0"
                      x2="4"
                      y2="0"
                      stroke="rgba(245, 158, 11, 0.8)"
                      strokeWidth="1.5"
                      transform={`rotate(${angle + 90})`}
                    />
                    <rect
                      x="5"
                      y="-5"
                      width="15"
                      height="10"
                      rx="2"
                      fill="#0f172a"
                      stroke="rgba(245, 158, 11, 0.6)"
                      strokeWidth="0.75"
                    />
                    <text
                      x="12.5"
                      y="2.5"
                      textAnchor="middle"
                      fill="#f59e0b"
                      fontSize="6.5"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      S{sm.sector}
                    </text>
                  </g>
                );
              })}


            {/* Attacker Breadcrumb Trail (Restrained Red) */}
            {layers.trails && layers.cars && attackerTrail.length > 1 && (
              <polyline
                points={attackerTrail.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#EF4444"
                strokeWidth="1.5"
                strokeDasharray="2 3"
                opacity="0.45"
              />
            )}

            {/* Defender Breadcrumb Trail (Restrained Cyan) */}
            {layers.trails && layers.cars && defenderTrail.length > 1 && (
              <polyline
                points={defenderTrail.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#06B6D4"
                strokeWidth="1.5"
                strokeDasharray="2 3"
                opacity="0.45"
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

                {/* Midpoint Compact Operational Vector Badge */}
                <g transform={`translate(${(attCoords.x + defCoords.x) / 2}, ${(attCoords.y + defCoords.y) / 2 - 12})`}>
                  <rect
                    x="-42"
                    y="-9"
                    width="84"
                    height="18"
                    rx="3"
                    fill="#0f172a"
                    stroke="rgba(245, 158, 11, 0.4)"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3.5"
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

            {/* Car Markers along Track (Paints unselected first, then defender, then attacker) */}
            {layers.cars &&
              sortedCars.map((car) => {
                const coords = getCarCoordinates(car.progress);
                const isAttacker = car.driver === attackerCode;
                const isDefender = car.driver === defenderCode;

                // Field filtering: if car is neither attacker nor defender, check layers.field
                if (!isAttacker && !isDefender && !layers.field) {
                  return null;
                }

                // Color palette per specification:
                // Attacker: restrained red (#EF4444)
                // Defender: restrained cyan (#06B6D4)
                // Other cars: muted neutral (#475569)
                const carDotColor = isAttacker ? '#EF4444' : isDefender ? '#06B6D4' : '#475569';
                const labelColor = isAttacker ? '#EF4444' : isDefender ? '#06B6D4' : '#94A3B8';

                // Collision-aware label offset: Attacker above (y = -13), Defender below (y = +19)
                const labelOffsetY = isAttacker ? -13 : isDefender ? 19 : -9;

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
                        stroke="#EF4444"
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
                        stroke="#06B6D4"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                        opacity="0.9"
                      />
                    )}

                    {/* Core Car Marker Dot */}
                    <circle
                      r={isAttacker || isDefender ? '7' : '5'}
                      fill={carDotColor}
                      stroke={isAttacker ? '#B91C1C' : isDefender ? '#0891B2' : '#334155'}
                      strokeWidth={isAttacker || isDefender ? '1.5' : '1'}
                    />

                    {/* Driver Code Label (Attacker above, Defender below, Others compact) */}
                    {layers.labels && (
                      <text
                        y={labelOffsetY}
                        textAnchor="middle"
                        fill={labelColor}
                        fontSize={isAttacker || isDefender ? '9' : '7.5'}
                        fontWeight={isAttacker || isDefender ? '700' : '500'}
                        fontFamily="monospace"
                      >
                        {car.driver}
                      </text>
                    )}

                    {/* Position Number inside Circle */}
                    <text
                      y="2.5"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={isAttacker || isDefender ? '7' : '6'}
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {car.position ?? ''}
                    </text>
                  </g>
                );
              })}
          </svg>
        )}
      </div>
    </div>
  );
};
