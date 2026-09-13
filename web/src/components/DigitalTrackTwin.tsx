import { useMemo, useState } from 'react';
import type { CarState, TrackGeometry } from '../types';
import { TrackOverlayModal } from './TrackOverlayModal';

interface Props {
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


export function DigitalTrackTwin({
  geometry,
  cars,
  attackerCode,
  defenderCode,
  gapSeconds,
  closingRate,
  trackStatus,
  circuitName,
  onSelectCar,
}: Props) {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<'CIRCUIT' | 'BATTLE'>('CIRCUIT');
  const [layers, setLayers] = useState({ cars: true, battle: true, sectors: false, labels: true, field: true });
  const [more, setMore] = useState(false);

  const valid = geometry?.available !== false && !geometry?.is_fallback && (geometry?.points.length ?? 0) >= 20 ? geometry : null;
  const points = valid?.points || [];

  const coordinate = (progress: number) => {
    const index = Math.max(0, Math.min(1, progress)) * (points.length - 1);
    const start = points[Math.floor(index)], end = points[Math.min(points.length - 1, Math.floor(index) + 1)];
    if (!start || !end) return null;
    const t = index - Math.floor(index);
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      angle: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
    };
  };

  // Progress is supplied by the provider. Interpolation is presentation only.
  const tokens = Object.values(cars)
    .filter((car) => typeof car.progress === 'number' && Number.isFinite(car.progress))
    .map((car) => ({ car, point: coordinate(car.progress!) }))
    .filter((token) => token.point !== null);

  const attacker = tokens.find((t) => t.car.driver === attackerCode);
  const defender = tokens.find((t) => t.car.driver === defenderCode);

  // High-contrast, tight bounds so the track is 40-50% larger and clearly visible
  const allBounds = useMemo(() => {
    if (!points.length) return { x: 0, y: 0, w: 1000, h: 600 };
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 24; // Tight padding for maximized visibility
    return {
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    };
  }, [points]);

  // Rock-solid stable bounds: zero camera jitter during live playback
  const bounds = allBounds;

  const selected = tokens.filter((t) => [attackerCode, defenderCode].includes(t.car.driver));
  const rest = tokens.filter((t) => ![attackerCode, defenderCode].includes(t.car.driver));

  // Battle focus & proximity detection for nearby traffic
  const battleProg = attacker?.car.progress ?? defender?.car.progress ?? null;
  const isNearbyTraffic = (prog: number | undefined | null) => {
    if (battleProg == null || prog == null) return false;
    const diff = Math.abs(prog - battleProg);
    const circularDiff = Math.min(diff, 1.0 - diff);
    return circularDiff > 0.001 && circularDiff < 0.08;
  };

  // Full floating labels ONLY for selected battle pair to avoid clutter
  const labels = new Map<string, { x: number; y: number }>();
  if (attacker?.point) {
    labels.set(attacker.car.driver, { x: 18, y: -30 });
  }
  if (defender?.point) {
    const a = attacker?.point;
    const d = defender.point;
    const dy = a && Math.abs(a.y - d.y) < 35 ? 20 : -30;
    const dx = a && Math.abs(a.x - d.x) < 40 ? -82 : 18;
    labels.set(defender.car.driver, { x: dx, y: dy });
  }

  const toggle = (key: keyof typeof layers) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="astra-twin">
      <div className="astra-twin-toolbar">
        <span className="astra-eyebrow">
          {circuitName ? `${circuitName.toUpperCase()} · ` : ''}{tokens.length} POSITIONED / {Object.keys(cars).length} FIELD
        </span>
        <button
          className="astra-button"
          aria-pressed={layers.field}
          onClick={() => toggle('field')}
          title="Toggle between full field and selected battle only"
        >
          {layers.field ? 'FIELD ON' : 'FIELD OFF (TACTICAL)'}
        </button>
        <button
          className="astra-button"
          disabled={!attacker || !defender}
          onClick={() => {
            setOverlayMode('BATTLE');
            setIsOverlayOpen(true);
          }}
          title="Open clear, glitch-free focused battle overlay screen"
        >
          ⌖ Focus battle
        </button>
        <button
          className="astra-button astra-button-overlay"
          onClick={() => {
            setOverlayMode('CIRCUIT');
            setIsOverlayOpen(true);
          }}
          title="Open high-definition full-screen map overlay"
          style={{ borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 700 }}
        >
          ⛶ Overlay screen
        </button>
        <div className="astra-layers" aria-label="Track layers">
          <span>LAYERS</span>
          {(['cars', 'battle', 'sectors'] as const).map((key) => (
            <button key={key} aria-pressed={layers[key]} onClick={() => toggle(key)}>
              {key}
            </button>
          ))}
          <div className="astra-more">
            <button aria-label="More track layers" aria-expanded={more} onClick={() => setMore(!more)}>
              ···
            </button>
            {more && (
              <div className="astra-layer-menu">
                {(['labels', 'field'] as const).map((key) => (
                  <button key={key} aria-pressed={layers[key]} onClick={() => toggle(key)}>
                    {layers[key] ? '✓ ' : ''}
                    {key}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="astra-track-stage">
        {!valid ? (
          <div className="astra-empty">
            <span className="astra-eyebrow">SPATIAL DATA</span>
            <h2>Circuit geometry unavailable</h2>
            <p>Waiting for verified positional data for this session.</p>
          </div>
        ) : (
          <svg
            className="astra-track-svg"
            role="img"
            aria-label="Engineering circuit view with source-provided car positions"
            viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          >
            {/* Track Ribbon */}
            <path d={valid.path_d} fill="none" stroke="#373b40" strokeWidth="20" strokeLinejoin="round" />
            <path d={valid.path_d} fill="none" stroke="#16191d" strokeWidth="16" strokeLinejoin="round" />
            <path
              d={valid.path_d}
              fill="none"
              stroke={trackStatus === '1' ? '#72777d' : '#d8a457'}
              strokeWidth="1"
              strokeDasharray="2 9"
            />

            {/* Direction Arrows */}
            {[0.12, 0.36, 0.61, 0.86].map((p) => {
              const point = coordinate(p)!;
              return (
                <path
                  key={p}
                  d="M -4 -4 L 2 0 L -4 4"
                  transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}
                  fill="none"
                  stroke="#a2a5aa"
                  strokeWidth="1.5"
                />
              );
            })}

            {/* Start / Finish Line */}
            {points[0] && (
              <g transform={`translate(${points[0].x} ${points[0].y})`}>
                <path d="M -10 0 H 10" stroke="white" strokeWidth="3" />
                <text y="-16" fill="#aeb2b7" fontSize="10" textAnchor="middle">
                  S/F
                </text>
              </g>
            )}

            {/* Sector Markers */}
            {layers.sectors &&
              valid.sector_markers?.map((marker, i) => {
                const point = coordinate(marker.progress)!;
                return (
                  <g key={i} transform={`translate(${point.x} ${point.y})`}>
                    <circle r="13" fill="#20242a" stroke="#666" />
                    <text y="4" textAnchor="middle" fontSize="10" fill="#c0c3c8">
                      S{marker.sector}
                    </text>
                  </g>
                );
              })}

            {/* Battle Corridor & Connecting Line */}
            {layers.battle && attacker?.point && defender?.point && (
              <g className="astra-battle-corridor">
                <line
                  x1={attacker.point.x}
                  y1={attacker.point.y}
                  x2={defender.point.x}
                  y2={defender.point.y}
                  stroke="#ef4444"
                  strokeWidth="1.8"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />
                <g
                  transform={`translate(${(attacker.point.x + defender.point.x) / 2} ${(attacker.point.y + defender.point.y) / 2 - 8})`}
                >
                  <rect x="-24" y="-8" width="48" height="16" rx="3" fill="#0f172a" stroke="#ef4444" strokeWidth="1" opacity="0.9" />
                  <text y="4" textAnchor="middle" fontSize="9" fill="#f87171" fontWeight="700">
                    {gapSeconds != null ? `${gapSeconds.toFixed(2)}s` : 'GAP'}
                  </text>
                </g>
              </g>
            )}

            {/* Cars Layer with Hierarchy: Attacker (RED), Defender (CYAN), Nearby Traffic (Medium Slate), Distant Field (Muted Slate) */}
            {layers.cars &&
              [...rest, ...selected].map(({ car, point }) => {
                const isAtt = car.driver === attackerCode;
                const isDef = car.driver === defenderCode;

                // Field toggle: if field is OFF, render only selected battle
                if (!layers.field && !isAtt && !isDef) return null;

                const isNearby = isNearbyTraffic(car.progress);
                const color = isAtt ? '#ef4444' : isDef ? '#06b6d4' : isNearby ? '#94a3b8' : '#64748b';
                const label = labels.get(car.driver);

                return (
                  <g
                    key={car.driver}
                    transform={`translate(${point!.x} ${point!.y})`}
                    className={`astra-car ${isAtt ? 'is-attacker' : ''} ${isDef ? 'is-defender' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${car.driver} position ${car.position ?? 'unknown'}`}
                    onClick={() => onSelectCar?.(car.driver)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectCar?.(car.driver);
                      }
                    }}
                  >
                    <title>
                      {car.name || car.driver} (#{car.number || car.position}) · {isAtt ? 'ATTACKER' : isDef ? 'DEFENDER' : isNearby ? 'NEARBY TRAFFIC' : 'FIELD'} · P{car.position ?? '—'} · {car.speed ?? '—'} km/h
                    </title>

                    {/* Attacker: Strong Red Emphasis & Focus Ring */}
                    {isAtt && (
                      <>
                        <circle r="16" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeDasharray="3 3" opacity="0.85" />
                        <rect x="-11" y="-11" width="22" height="22" rx="4" fill="#220a0f" stroke="#ef4444" strokeWidth="2.5" />
                        <path
                          d="M 12 -4 L 18 0 L 12 4"
                          transform={`rotate(${point!.angle})`}
                          fill="#ef4444"
                          stroke="#ef4444"
                          strokeWidth="1.5"
                        />
                        <text y="4" textAnchor="middle" fontSize="10" fill="#ef4444" fontWeight="800">
                          {car.number || car.position || 'A'}
                        </text>
                        {layers.labels && label && (
                          <g transform={`translate(${label.x} ${label.y})`}>
                            <path d={`M ${-label.x} ${-label.y} L 0 11`} stroke="#ef4444" opacity="0.6" strokeWidth="1.2" />
                            <rect width="78" height="24" rx="4" fill="#14080b" stroke="#ef4444" strokeWidth="1.5" />
                            <text x="7" y="16" fontSize="11" fill="#ef4444" fontWeight="800">
                              {car.driver} <tspan fill="#cbd5e1" fontSize="9" fontWeight="600">P{car.position ?? '—'}</tspan>
                            </text>
                          </g>
                        )}
                      </>
                    )}

                    {/* Defender: Strong Cyan Emphasis & Focus Ring */}
                    {isDef && (
                      <>
                        <circle r="16" fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeDasharray="3 3" opacity="0.85" />
                        <rect x="-11" y="-11" width="22" height="22" rx="4" fill="#061a22" stroke="#06b6d4" strokeWidth="2.5" />
                        <path
                          d="M 12 -4 L 18 0 L 12 4"
                          transform={`rotate(${point!.angle})`}
                          fill="#06b6d4"
                          stroke="#06b6d4"
                          strokeWidth="1.5"
                        />
                        <text y="4" textAnchor="middle" fontSize="10" fill="#06b6d4" fontWeight="800">
                          {car.number || car.position || 'D'}
                        </text>
                        {layers.labels && label && (
                          <g transform={`translate(${label.x} ${label.y})`}>
                            <path d={`M ${-label.x} ${-label.y} L 0 11`} stroke="#06b6d4" opacity="0.6" strokeWidth="1.2" />
                            <rect width="78" height="24" rx="4" fill="#05141b" stroke="#06b6d4" strokeWidth="1.5" />
                            <text x="7" y="16" fontSize="11" fill="#06b6d4" fontWeight="800">
                              {car.driver} <tspan fill="#cbd5e1" fontSize="9" fontWeight="600">P{car.position ?? '—'}</tspan>
                            </text>
                          </g>
                        )}
                      </>
                    )}

                    {/* Other Field Cars: Compact Driver Number Badges with No Floating Label Clutter */}
                    {!isAtt && !isDef && (
                      <>
                        <rect
                          x={isNearby ? -8 : -7}
                          y={isNearby ? -8 : -7}
                          width={isNearby ? 16 : 14}
                          height={isNearby ? 16 : 14}
                          rx={3}
                          fill={isNearby ? '#1e293b' : '#0f172a'}
                          stroke={color}
                          strokeWidth={isNearby ? 1.2 : 1.0}
                          opacity={isNearby ? 0.95 : 0.7}
                        />
                        <path
                          d="M 8 -3 L 12 0 L 8 3"
                          transform={`rotate(${point!.angle})`}
                          fill={color}
                          opacity={isNearby ? 0.9 : 0.6}
                        />
                        <text
                          y="3"
                          textAnchor="middle"
                          fontSize={isNearby ? 8 : 7.5}
                          fill={isNearby ? '#f1f5f9' : '#94a3b8'}
                          fontWeight={isNearby ? '700' : '600'}
                        >
                          {car.number || car.position || '·'}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
          </svg>
        )}
      </div>

      <div className="astra-twin-footer">
        <span>
          <i className="att-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', marginRight: 4 }} /> Attacker{' '}
          <i className="def-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#06b6d4', margin: '0 4px 0 10px' }} /> Defender{' '}
          <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', margin: '0 4px 0 10px' }} /> Nearby traffic{' '}
          <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#64748b', margin: '0 4px 0 10px' }} /> Field
        </span>
        <span>
          {gapSeconds != null ? `${gapSeconds.toFixed(2)}s interval` : 'Gap unknown'} ·{' '}
          {closingRate == null ? 'Motion steady' : closingRate > 0 ? 'Closing' : closingRate < 0 ? 'Opening' : 'Steady'}
        </span>
      </div>
      <p className="astra-map-caption">
        Engineering view · progress mapped to verified source geometry
        {layers.sectors ? ' · sector markers are approximate thirds, not surveyed timing lines' : ''}
      </p>

      {/* Clear High-Definition Track & Battle Overlay Screen */}
      <TrackOverlayModal
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        initialMode={overlayMode}
        geometry={geometry}
        cars={cars}
        attackerCode={attackerCode}
        defenderCode={defenderCode}
        gapSeconds={gapSeconds}
        closingRate={closingRate}
        trackStatus={trackStatus}
        circuitName={circuitName}
        onSelectCar={onSelectCar}
      />
    </div>
  );
}
