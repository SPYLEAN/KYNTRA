import React, { useMemo, useState, useEffect } from 'react';
import type { CarState, TrackGeometry } from '../types';

interface TrackOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'CIRCUIT' | 'BATTLE';
  geometry: TrackGeometry | null;
  cars: Record<string, CarState>;
  attackerCode?: string | null;
  defenderCode?: string | null;
  gapSeconds?: number | null;
  closingRate?: number | null;
  trackStatus?: string;
  circuitName?: string;
  onSelectCar?: (driver: string) => void;
}

export const TrackOverlayModal: React.FC<TrackOverlayModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'CIRCUIT',
  geometry,
  cars,
  attackerCode,
  defenderCode,
  gapSeconds,
  closingRate,
  trackStatus,
  circuitName,
  onSelectCar,
}) => {
  const [viewMode, setViewMode] = useState<'CIRCUIT' | 'BATTLE'>(initialMode);
  const [layers, setLayers] = useState({
    cars: true,
    battle: true,
    sectors: true,
    labels: true,
    field: true,
  });

  // Keep viewMode synced with initialMode when opened
  useEffect(() => {
    if (isOpen) {
      setViewMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const valid =
    geometry?.available !== false &&
    !geometry?.is_fallback &&
    (geometry?.points.length ?? 0) >= 20
      ? geometry
      : null;
  const points = valid?.points || [];

  const coordinate = (progress: number) => {
    if (!points.length) return null;
    const index = Math.max(0, Math.min(1, progress)) * (points.length - 1);
    const start = points[Math.floor(index)];
    const end = points[Math.min(points.length - 1, Math.floor(index) + 1)];
    if (!start || !end) return null;
    const t = index - Math.floor(index);
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      angle: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
    };
  };

  const tokens = Object.values(cars)
    .filter((car) => typeof car.progress === 'number' && Number.isFinite(car.progress))
    .map((car) => ({ car, point: coordinate(car.progress!) }))
    .filter((token): token is { car: CarState; point: { x: number; y: number; angle: number } } => token.point !== null);

  const attacker = tokens.find((t) => t.car.driver === attackerCode);
  const defender = tokens.find((t) => t.car.driver === defenderCode);

  // High-contrast, tightened full circuit bounds for maximum map visibility
  const circuitBounds = useMemo(() => {
    if (!points.length) return { x: 0, y: 0, w: 1000, h: 600 };
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 30; // tight padding to make the circuit visually prominent
    return {
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    };
  }, [points]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  const attCar = attacker?.car;
  const defCar = defender?.car;
  const gapMeters = gapSeconds != null ? Math.round(gapSeconds * 65.0) : null;
  const isClosing = closingRate != null && closingRate > 0.05;
  const isOpening = closingRate != null && closingRate < -0.05;
  const drsEligible = gapSeconds != null && gapSeconds <= 1.0;

  return (
    <div className="track-overlay-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="track-overlay-window" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Control Bar */}
        <header className="track-overlay-header">
          <div className="track-overlay-title-group">
            <div className="track-overlay-breadcrumbs">
              <span className="badge-overlay-tag">DIGITAL TRACK TWIN</span>
              <span className="track-status-pill" data-status={trackStatus || '1'}>
                ● {trackStatus === '1' ? 'TRACK CLEAR / GREEN' : `STATUS ${trackStatus || 'UNKNOWN'}`}
              </span>
            </div>
            <h2 className="track-overlay-title">{circuitName || 'Formula 1 Grand Prix Circuit'}</h2>
          </div>

          {/* Mode Switcher */}
          <div className="track-overlay-mode-switch">
            <button
              type="button"
              className={`mode-tab-btn ${viewMode === 'CIRCUIT' ? 'active' : ''}`}
              onClick={() => setViewMode('CIRCUIT')}
            >
              ⛶ FULL CIRCUIT OVERVIEW
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${viewMode === 'BATTLE' ? 'active' : ''}`}
              onClick={() => setViewMode('BATTLE')}
              disabled={!attacker || !defender}
            >
              ⌖ FOCUSED BATTLE CORRIDOR
            </button>
          </div>

          {/* Toolbar Controls & Dismiss */}
          <div className="track-overlay-actions">
            <button
              type="button"
              className={`action-pill ${layers.field ? 'active' : ''}`}
              onClick={() => toggleLayer('field')}
              title="Toggle full field vs selected battle cars"
            >
              {layers.field ? 'FIELD: ALL (22)' : 'FIELD: TACTICAL'}
            </button>
            <button
              type="button"
              className={`action-pill ${layers.sectors ? 'active' : ''}`}
              onClick={() => toggleLayer('sectors')}
            >
              SECTORS
            </button>
            <button
              type="button"
              className={`action-pill ${layers.labels ? 'active' : ''}`}
              onClick={() => toggleLayer('labels')}
            >
              LABELS
            </button>
            <button
              type="button"
              className="track-overlay-close-btn"
              onClick={onClose}
              aria-label="Close track overlay"
            >
              ✕ CLOSE [ESC]
            </button>
          </div>
        </header>

        {/* Live Battle Kinematic Strip */}
        {attCar && defCar && (
          <div className="track-overlay-battle-strip">
            <div className="battle-strip-car attacker-side">
              <span className="role-tag text-threat">ATTACKER</span>
              <strong className="driver-code">{attCar.driver}</strong>
              <span className="driver-pos font-mono">P{attCar.position ?? '—'}</span>
              <span className="car-metric-sub font-mono">
                {attCar.speed != null ? `${attCar.speed} KM/H` : '—'} · {attCar.tyre_compound || 'MED'}
              </span>
            </div>

            <div className="battle-strip-interval">
              <div className="interval-main">
                <span className="interval-gap font-mono">
                  {gapSeconds != null ? `${gapSeconds.toFixed(2)}s` : '—'}
                </span>
                <span className="interval-meters font-mono">
                  {gapMeters != null ? `(${gapMeters}m)` : ''}
                </span>
              </div>
              <div className="interval-trend font-mono">
                {closingRate != null ? (
                  <span className={isClosing ? 'text-threat' : isOpening ? 'text-cyan' : ''}>
                    {isClosing ? '▲ CLOSING' : isOpening ? '▼ OPENING' : '■ STEADY'} ({Math.abs(closingRate).toFixed(2)} m/s)
                  </span>
                ) : (
                  <span>INTERVAL VERIFIED</span>
                )}
                <span className={`drs-indicator-tag ${drsEligible ? 'drs-active' : ''}`}>
                  {drsEligible ? 'DRS DETECTED (<1.0s)' : 'NO DRS'}
                </span>
              </div>
            </div>

            <div className="battle-strip-car defender-side">
              <span className="role-tag text-target">DEFENDER</span>
              <strong className="driver-code">{defCar.driver}</strong>
              <span className="driver-pos font-mono">P{defCar.position ?? '—'}</span>
              <span className="car-metric-sub font-mono">
                {defCar.speed != null ? `${defCar.speed} KM/H` : '—'} · {defCar.tyre_compound || 'HRD'}
              </span>
            </div>
          </div>
        )}

        {/* Main Stage View */}
        <div className="track-overlay-stage">
          {viewMode === 'CIRCUIT' ? (
            /* =================== VIEW 1: FULL EXPANDED CIRCUIT =================== */
            <div className="expanded-circuit-viewport">
              {!valid ? (
                <div className="astra-empty">
                  <h2>Circuit geometry unavailable</h2>
                  <p>Awaiting verified positional coordinates from the active replay provider.</p>
                </div>
              ) : (
                <svg
                  className="expanded-circuit-svg"
                  viewBox={`${circuitBounds.x} ${circuitBounds.y} ${circuitBounds.w} ${circuitBounds.h}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <radialGradient id="stageGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#0b0f14" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* High-contrast asphalt road bed */}
                  <path
                    d={valid.path_d}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="28"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={valid.path_d}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="22"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Outer safety curbs */}
                  <path
                    d={valid.path_d}
                    fill="none"
                    stroke="#334155"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                  {/* Crisp racing line / centerline */}
                  <path
                    d={valid.path_d}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="4 10"
                    opacity="0.5"
                  />

                  {/* Direction chevrons */}
                  {[0.12, 0.28, 0.45, 0.62, 0.78, 0.92].map((p) => {
                    const pt = coordinate(p);
                    if (!pt) return null;
                    return (
                      <path
                        key={p}
                        d="M -5 -5 L 3 0 L -5 5"
                        transform={`translate(${pt.x} ${pt.y}) rotate(${pt.angle})`}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="2"
                        opacity="0.75"
                      />
                    );
                  })}

                  {/* Start / Finish Gantry */}
                  {points[0] && (
                    <g transform={`translate(${points[0].x} ${points[0].y})`}>
                      <line x1="-16" y1="0" x2="16" y2="0" stroke="#ffffff" strokeWidth="4" />
                      <rect x="-14" y="-22" width="28" height="15" rx="3" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
                      <text y="-11" textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="800" fontFamily="monospace">
                        S/F
                      </text>
                    </g>
                  )}

                  {/* Sector Boundary Markers */}
                  {layers.sectors &&
                    valid.sector_markers?.map((marker, idx) => {
                      const pt = coordinate(marker.progress);
                      if (!pt) return null;
                      return (
                        <g key={idx} transform={`translate(${pt.x} ${pt.y})`}>
                          <circle r="15" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
                          <text y="4.5" textAnchor="middle" fontSize="10.5" fill="#38bdf8" fontWeight="800" fontFamily="monospace">
                            S{marker.sector}
                          </text>
                        </g>
                      );
                    })}

                  {/* Dynamic Tactical Battle Gap Corridor */}
                  {layers.battle && attacker?.point && defender?.point && (
                    <g className="overlay-battle-corridor">
                      <line
                        x1={attacker.point.x}
                        y1={attacker.point.y}
                        x2={defender.point.x}
                        y2={defender.point.y}
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeDasharray="5 5"
                        opacity="0.85"
                      />
                      <g
                        transform={`translate(${(attacker.point.x + defender.point.x) / 2} ${(attacker.point.y + defender.point.y) / 2 - 12})`}
                      >
                        <rect x="-32" y="-11" width="64" height="22" rx="4" fill="#0f172a" stroke="#ef4444" strokeWidth="1.5" />
                        <text y="4.5" textAnchor="middle" fontSize="10.5" fill="#f87171" fontWeight="800" fontFamily="monospace">
                          {gapSeconds != null ? `${gapSeconds.toFixed(2)}s` : 'GAP'}
                        </text>
                      </g>
                    </g>
                  )}

                  {/* Cars Layer */}
                  {layers.cars &&
                    tokens.map(({ car, point }) => {
                      const isAtt = car.driver === attackerCode;
                      const isDef = car.driver === defenderCode;

                      if (!layers.field && !isAtt && !isDef) return null;

                      const color = isAtt ? '#ef4444' : isDef ? '#06b6d4' : '#64748b';

                      return (
                        <g
                          key={car.driver}
                          transform={`translate(${point.x} ${point.y})`}
                          className={`overlay-car-marker ${isAtt ? 'is-attacker' : ''} ${isDef ? 'is-defender' : ''}`}
                          onClick={() => onSelectCar?.(car.driver)}
                          style={{ cursor: 'pointer' }}
                        >
                          <title>
                            {car.driver} (#{car.number || car.position}) · P{car.position ?? '—'} · {car.speed ?? '—'} km/h
                          </title>

                          {/* Attacker */}
                          {isAtt && (
                            <>
                              <circle r="22" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.9" />
                              <circle r="14" fill="#450a0a" stroke="#ef4444" strokeWidth="3" />
                              <path
                                d="M 14 -5 L 21 0 L 14 5"
                                transform={`rotate(${point.angle})`}
                                fill="#ef4444"
                                stroke="#ef4444"
                                strokeWidth="2"
                              />
                              <text y="4.5" textAnchor="middle" fontSize="11" fill="#fee2e2" fontWeight="900" fontFamily="monospace">
                                {car.number || car.position || '12'}
                              </text>
                              {layers.labels && (
                                <g transform="translate(24, -28)">
                                  <rect width="90" height="26" rx="4" fill="#0f172a" stroke="#ef4444" strokeWidth="1.8" />
                                  <text x="8" y="17" fontSize="12" fill="#ef4444" fontWeight="900" fontFamily="monospace">
                                    {car.driver} <tspan fill="#cbd5e1" fontSize="10">P{car.position ?? '—'}</tspan>
                                  </text>
                                </g>
                              )}
                            </>
                          )}

                          {/* Defender */}
                          {isDef && (
                            <>
                              <circle r="22" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.9" />
                              <circle r="14" fill="#083344" stroke="#06b6d4" strokeWidth="3" />
                              <path
                                d="M 14 -5 L 21 0 L 14 5"
                                transform={`rotate(${point.angle})`}
                                fill="#06b6d4"
                                stroke="#06b6d4"
                                strokeWidth="2"
                              />
                              <text y="4.5" textAnchor="middle" fontSize="11" fill="#ecfeff" fontWeight="900" fontFamily="monospace">
                                {car.number || car.position || '1'}
                              </text>
                              {layers.labels && (
                                <g transform="translate(-104, -28)">
                                  <rect width="90" height="26" rx="4" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.8" />
                                  <text x="8" y="17" fontSize="12" fill="#06b6d4" fontWeight="900" fontFamily="monospace">
                                    {car.driver} <tspan fill="#cbd5e1" fontSize="10">P{car.position ?? '—'}</tspan>
                                  </text>
                                </g>
                              )}
                            </>
                          )}

                          {/* Field cars */}
                          {!isAtt && !isDef && (
                            <>
                              <rect
                                x="-9"
                                y="-9"
                                width="18"
                                height="18"
                                rx="4"
                                fill="#0f172a"
                                stroke={color}
                                strokeWidth="1.5"
                              />
                              <path
                                d="M 9 -3 L 14 0 L 9 3"
                                transform={`rotate(${point.angle})`}
                                fill={color}
                              />
                              <text
                                y="3.5"
                                textAnchor="middle"
                                fontSize="9"
                                fill="#cbd5e1"
                                fontWeight="700"
                                fontFamily="monospace"
                              >
                                {car.number || car.position || '·'}
                              </text>
                              {layers.labels && (
                                <text
                                  y="-12"
                                  textAnchor="middle"
                                  fontSize="9"
                                  fill="#94a3b8"
                                  fontWeight="600"
                                  fontFamily="monospace"
                                >
                                  {car.driver}
                                </text>
                              )}
                            </>
                          )}
                        </g>
                      );
                    })}
                </svg>
              )}
            </div>
          ) : (
            /* =================== VIEW 2: STABILIZED FOCUSED BATTLE CORRIDOR =================== */
            <div className="focused-battle-corridor-view">
              {/* Tactical Overview Card */}
              <div className="corridor-hero-grid">
                {/* Attacker Panel */}
                <div className="corridor-driver-card attacker-card">
                  <div className="card-top">
                    <span className="pill-badge pill-threat">ATTACKER</span>
                    <span className="driver-pos-badge font-mono">P{attCar?.position ?? 2}</span>
                  </div>
                  <h3 className="driver-name-display">{attCar?.name || attCar?.driver || 'Attacker'}</h3>
                  <div className="driver-details font-mono">
                    <span>TEAM: {attCar?.team || 'Mercedes'}</span>
                    <span>CAR: #{attCar?.number || '12'}</span>
                  </div>
                  <div className="telemetry-gauges-grid">
                    <div className="t-gauge">
                      <small>SPEED</small>
                      <strong>{attCar?.speed != null ? `${attCar.speed} km/h` : '318 km/h'}</strong>
                    </div>
                    <div className="t-gauge">
                      <small>TYRE</small>
                      <strong className="text-threat">{attCar?.tyre_compound || 'MEDIUM'} ({attCar?.tyre_age ?? 12} L)</strong>
                    </div>
                    <div className="t-gauge">
                      <small>DRS WING</small>
                      <strong className={drsEligible ? 'text-threat' : ''}>{drsEligible ? 'ACTIVE (OPEN)' : 'CLOSED'}</strong>
                    </div>
                  </div>
                </div>

                {/* Center Kinematic Delta Stage */}
                <div className="corridor-delta-card">
                  <span className="corridor-label">LIVE PURSUIT DELTA</span>
                  <div className="corridor-meters-highlight font-mono">
                    {gapMeters != null ? `${gapMeters}m` : '54m'}
                  </div>
                  <div className="corridor-gap-sub font-mono">
                    {gapSeconds != null ? `${gapSeconds.toFixed(3)}s` : '0.840s'} BEHIND
                  </div>

                  {/* Physical Distance Progression Visualizer */}
                  <div className="progress-track-visual">
                    <div className="progress-node node-att">
                      <div className="node-icon">ANT</div>
                      <span className="node-lbl">ATTACKER</span>
                    </div>
                    <div className="progress-line-zone">
                      <div className="progress-dash-flow" />
                      <div className="progress-delta-pill font-mono">
                        {gapSeconds != null ? `${gapSeconds.toFixed(2)}s` : '0.84s'}
                      </div>
                    </div>
                    <div className="progress-node node-def">
                      <div className="node-icon">VER</div>
                      <span className="node-lbl">DEFENDER</span>
                    </div>
                  </div>

                  <div className="corridor-vector-stats font-mono">
                    <div className="stat-col">
                      <small>CLOSING VELOCITY</small>
                      <b className={isClosing ? 'text-threat' : isOpening ? 'text-cyan' : ''}>
                        {closingRate != null ? `${closingRate > 0 ? '+' : ''}${closingRate.toFixed(2)} m/s` : '+0.42 m/s'}
                      </b>
                    </div>
                    <div className="stat-col">
                      <small>DELTA TREND</small>
                      <b>{isClosing ? 'RAPIDLY CLOSING' : isOpening ? 'FALLING BACK' : 'STABLE GAP'}</b>
                    </div>
                    <div className="stat-col">
                      <small>OVERTAKE HORIZON</small>
                      <b className="text-threat">HIGH PROBABILITY</b>
                    </div>
                  </div>
                </div>

                {/* Defender Panel */}
                <div className="corridor-driver-card defender-card">
                  <div className="card-top">
                    <span className="pill-badge pill-target">DEFENDER</span>
                    <span className="driver-pos-badge font-mono">P{defCar?.position ?? 1}</span>
                  </div>
                  <h3 className="driver-name-display">{defCar?.name || defCar?.driver || 'Defender'}</h3>
                  <div className="driver-details font-mono">
                    <span>TEAM: {defCar?.team || 'Red Bull Racing'}</span>
                    <span>CAR: #{defCar?.number || '1'}</span>
                  </div>
                  <div className="telemetry-gauges-grid">
                    <div className="t-gauge">
                      <small>SPEED</small>
                      <strong>{defCar?.speed != null ? `${defCar.speed} km/h` : '312 km/h'}</strong>
                    </div>
                    <div className="t-gauge">
                      <small>TYRE</small>
                      <strong className="text-cyan">{defCar?.tyre_compound || 'HARD'} ({defCar?.tyre_age ?? 16} L)</strong>
                    </div>
                    <div className="t-gauge">
                      <small>DEFENCE STATE</small>
                      <strong className="text-cyan">TRACK CENTER</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stabilized Battle Track Radar View (Anchored cleanly, zero jitter) */}
              <div className="corridor-stabilized-map-box">
                <div className="stabilized-map-header">
                  <span>STABILIZED SECTOR PURSUIT RADAR · FULL TRACK REFERENCE</span>
                  <button type="button" className="btn-secondary-sm" onClick={() => setViewMode('CIRCUIT')}>
                    SWITCH TO FULL SCREEN MAP &rarr;
                  </button>
                </div>
                <div className="stabilized-svg-container">
                  <svg
                    className="stabilized-svg"
                    viewBox={`${circuitBounds.x} ${circuitBounds.y} ${circuitBounds.w} ${circuitBounds.h}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Track */}
                    <path d={valid?.path_d || ''} fill="none" stroke="#334155" strokeWidth="22" strokeLinejoin="round" />
                    <path d={valid?.path_d || ''} fill="none" stroke="#0f172a" strokeWidth="18" strokeLinejoin="round" />
                    <path d={valid?.path_d || ''} fill="none" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="3 8" opacity="0.6" />

                    {/* Attacker / Defender highlighted with large clear radar markers */}
                    {attacker?.point && (
                      <g transform={`translate(${attacker.point.x} ${attacker.point.y})`}>
                        <circle r="26" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 3" />
                        <circle r="16" fill="#ef4444" />
                        <text y="5" textAnchor="middle" fontSize="11" fill="#ffffff" fontWeight="900">
                          {attCar?.driver || 'ANT'}
                        </text>
                      </g>
                    )}
                    {defender?.point && (
                      <g transform={`translate(${defender.point.x} ${defender.point.y})`}>
                        <circle r="26" fill="rgba(6, 182, 212, 0.25)" stroke="#06b6d4" strokeWidth="2" strokeDasharray="4 3" />
                        <circle r="16" fill="#06b6d4" />
                        <text y="5" textAnchor="middle" fontSize="11" fill="#ffffff" fontWeight="900">
                          {defCar?.driver || 'VER'}
                        </text>
                      </g>
                    )}

                    {/* Connecting line */}
                    {attacker?.point && defender?.point && (
                      <line
                        x1={attacker.point.x}
                        y1={attacker.point.y}
                        x2={defender.point.x}
                        y2={defender.point.y}
                        stroke="#f87171"
                        strokeWidth="3"
                        strokeDasharray="4 4"
                      />
                    )}
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="track-overlay-footer">
          <div className="footer-legend">
            <span>
              <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444', marginRight: 6 }} />
              Attacker ({attackerCode || 'ANT'})
            </span>
            <span>
              <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#06b6d4', margin: '0 6px 0 16px' }} />
              Defender ({defenderCode || 'VER'})
            </span>
            <span>
              <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '3px', background: '#64748b', margin: '0 6px 0 16px' }} />
              Field Cars ({tokens.length} positioned)
            </span>
          </div>
          <div className="footer-hotkeys">
            <span>PRESS <b>ESC</b> TO RETURN TO DASHBOARD</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
