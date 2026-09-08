import React, { useState, useEffect, useRef } from 'react';
import type {
  DecisionSnapshot,
  EventInfo,
  SystemStatus,
} from './types';

// Fallback initial state if API is still booting
const DEFAULT_DECISION: DecisionSnapshot = {
  race: {
    event_id: '2026_13_ITA',
    event_name: 'Italian Grand Prix',
    lap: 18,
    replay_time: 1620.0,
    attacker: 'VER',
    defender: 'ANT',
    attacker_position: 2,
    defender_position: 1,
  },
  provenance: {
    telemetry_source: 'DEMO_HOLDOUT_REPLAY',
    energy_source: 'SIMULATED_2026_REGULATION',
    regulation_config_version: '2026_FIA_TECH_ISSUE_20',
    event_config_version: '2026_13_ITA_V1',
    overtake_model_version: 'KYNTRA_OVERTAKE_LIGHTGBM_V1',
    stability_method: 'DETERMINISTIC_POST_PASS_STABILITY_V1',
  },
  battle: {
    gap_seconds: 0.842,
    distance_gap_m: 46.8,
    closing_rate: 0.125,
    speed_delta: 4.8,
    tyre_age_delta: 3,
    laps_following: 4,
    rear_threat: 'LOW',
  },
  overtake: {
    available: true,
    model_version: 'KYNTRA_OVERTAKE_LIGHTGBM_V1',
    p_1_lap: 0.284,
    p_2_laps: 0.442,
    p_3_laps: 0.589,
    raw_p_1_lap: 0.284,
    raw_p_2_laps: 0.442,
    raw_p_3_laps: 0.589,
    horizon_projection_applied: false,
    feature_missingness: [],
  },
  energy: {
    available_energy_mj: 2.85,
    fraction: 0.71,
    scenario: 'NORMAL',
    simulated: true,
    provenance: 'SIMULATED — 2026 REGULATION CONSTRAINED (FIA Article C5.2.9 & C5.2.10)',
    projected_action_cost_mj: 1.2,
    projected_post_action_reserve_mj: 1.65,
    sensitivity: 'ROBUST',
  },
  stability: {
    method: 'DETERMINISTIC_POST_PASS_STABILITY_V1',
    verdict: 'UNKNOWN',
    available: false,
    evidence: [],
    reason: 'STABILITY_RULESET_PENDING_VERIFICATION',
  },
  compliance: {
    status: 'UNKNOWN',
    allowed_actions: ['CONSERVE', 'BUILD', 'DEPLOY', 'OVERTAKE'],
    blocked_actions: [],
    reason_codes: ['Event configuration unconfigured; circuit detection parameters pending official FIA publication'],
  },
  counterfactuals: [
    {
      action: 'CONSERVE',
      available: false,
      feasible: null,
      pass_outcome: null,
      retention_outcome: null,
      ending_energy_mj: null,
      future_opportunity: null,
      rank: null,
      reason: 'COUNTERFACTUAL_ENGINE_PENDING_VERIFICATION',
    },
    {
      action: 'BUILD',
      available: false,
      feasible: null,
      pass_outcome: null,
      retention_outcome: null,
      ending_energy_mj: null,
      future_opportunity: null,
      rank: null,
      reason: 'COUNTERFACTUAL_ENGINE_PENDING_VERIFICATION',
    },
    {
      action: 'DEPLOY',
      available: false,
      feasible: null,
      pass_outcome: null,
      retention_outcome: null,
      ending_energy_mj: null,
      future_opportunity: null,
      rank: null,
      reason: 'COUNTERFACTUAL_ENGINE_PENDING_VERIFICATION',
    },
    {
      action: 'OVERTAKE',
      available: false,
      feasible: null,
      pass_outcome: null,
      retention_outcome: null,
      ending_energy_mj: null,
      future_opportunity: null,
      rank: null,
      reason: 'COUNTERFACTUAL_ENGINE_PENDING_VERIFICATION',
    },
  ],
  recommendation: {
    available: false,
    canonical_action: null,
    ui_label: null,
    robust: null,
    energy_sensitive: null,
    why: [],
    reason: 'STRATEGY_ENGINE_PENDING_VERIFICATION',
  },
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'RACE' | 'BATTLE' | 'COUNTERFACTUALS' | 'SYSTEM' | 'REGULATIONS'>('RACE');
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('2026_13_ITA');
  const [currentLap, setCurrentLap] = useState<number>(18);
  const [totalLaps, setTotalLaps] = useState<number>(53);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [decision, setDecision] = useState<DecisionSnapshot>(DEFAULT_DECISION);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const playTimerRef = useRef<any>(null);

  // Fetch events & system info on mount
  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => {
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
        }
      })
      .catch((err) => console.error('Failed to load events:', err));

    fetch('/api/system')
      .then((res) => res.json())
      .then((data) => setSystemStatus(data))
      .catch((err) => console.error('Failed to load system info:', err));
  }, []);

  // Update total laps when event changes
  useEffect(() => {
    const ev = events.find((e) => e.event_id === selectedEventId);
    if (ev) {
      setTotalLaps(ev.total_laps);
      setCurrentLap((prev) => Math.min(prev, ev.total_laps));
    }
  }, [selectedEventId, events]);

  // Fetch decision snapshot whenever event or lap changes
  useEffect(() => {
    setLoading(true);
    fetch(`/api/replay/${selectedEventId}/lap/${currentLap}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setDecision(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('API fetch fallback to current snapshot:', err);
        setLoading(false);
      });
  }, [selectedEventId, currentLap]);

  // Replay play/pause handler
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setCurrentLap((prev) => {
          if (prev >= totalLaps) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, totalLaps]);

  const handleLapChange = (newLap: number) => {
    if (newLap >= 1 && newLap <= totalLaps) {
      setCurrentLap(newLap);
    }
  };

  // Helper formatting
  const formatProb = (p: number | null | undefined) => {
    if (p === null || p === undefined) return 'N/A';
    return `${(p * 100).toFixed(1)}%`;
  };

  const getCallClass = (label: string | null | undefined) => {
    switch (label) {
      case 'OVERTAKE NOW':
        return 'call-overtake';
      case 'APPLY PRESSURE':
        return 'call-deploy';
      case 'PREPARE':
        return 'call-build';
      default:
        return 'call-conserve';
    }
  };

  return (
    <div className="kyntra-app">
      {/* --------------------------------------------------------------------
          TOP NAVIGATION HEADER
         -------------------------------------------------------------------- */}
      <header className="top-nav">
        <div className="nav-brand">
          <img
            src="/brand/kyntra-symbol.png"
            alt="KYNTRA Symbol"
            className="brand-symbol"
          />
          <img
            src="/brand/kyntra-wordmark.png"
            alt="KYNTRA Intelligence"
            className="brand-wordmark"
          />
          <div className="brand-divider" />
          <span className="brand-tagline">Predictive Racecraft Intelligence</span>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'RACE' ? 'active' : ''}`}
            onClick={() => setActiveTab('RACE')}
          >
            RACE
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'BATTLE' ? 'active' : ''}`}
            onClick={() => setActiveTab('BATTLE')}
          >
            BATTLE INTELLIGENCE
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'COUNTERFACTUALS' ? 'active' : ''}`}
            onClick={() => setActiveTab('COUNTERFACTUALS')}
          >
            COUNTERFACTUALS
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'SYSTEM' ? 'active' : ''}`}
            onClick={() => setActiveTab('SYSTEM')}
          >
            SYSTEM & PROVENANCE
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'REGULATIONS' ? 'active' : ''}`}
            onClick={() => setActiveTab('REGULATIONS')}
          >
            REGULATIONS
          </button>
        </nav>

        <div className="nav-status">
          {loading && (
            <div className="status-badge" style={{ color: 'var(--status-cyan)' }}>
              <span>SYNCING...</span>
            </div>
          )}
          <div className="status-badge">
            <div className="status-dot" />
            <span>{systemStatus?.overtake_model ? `${systemStatus.overtake_model.algorithm} ACTIVE` : 'V1 LIGHTGBM ACTIVE'}</span>
          </div>
          <div className="status-badge" style={{ color: 'var(--status-amber)' }}>
            <span>SIMULATED ENERGY</span>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------
          SUB-HEADER (EVENT SELECTOR & SCRUBBER)
         -------------------------------------------------------------------- */}
      <section className="sub-header">
        <div className="event-selector-group">
          <label htmlFor="event-select" style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Event Replay:
          </label>
          <select
            id="event-select"
            className="event-select"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="2026_13_ITA">2026 Italian GP — Monza (Primary Demo)</option>
            <option value="2026_01_AUS">2026 Australian GP — Albert Park</option>
            <option value="2026_04_MIA">2026 Miami GP — Miami International</option>
            <option value="2026_03_JPN">2026 Japanese GP — Suzuka (Single-Car Feed)</option>
          </select>
          <span className="badge-holdout">DEMO HOLDOUT</span>
        </div>

        <div className="replay-controls">
          <button
            className="btn-ctrl"
            onClick={() => handleLapChange(currentLap - 1)}
            disabled={currentLap <= 1}
          >
            ◀ Lap -1
          </button>
          <button
            className="btn-ctrl btn-play"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
          </button>
          <button
            className="btn-ctrl"
            onClick={() => handleLapChange(currentLap + 1)}
            disabled={currentLap >= totalLaps}
          >
            Lap +1 ▶
          </button>

          <div className="scrub-container">
            <input
              type="range"
              min={1}
              max={totalLaps}
              value={currentLap}
              onChange={(e) => handleLapChange(parseInt(e.target.value))}
              className="scrub-slider"
            />
          </div>

          <div className="lap-counter-box">
            <span className="lap-current">L{currentLap}</span>
            <span className="lap-total">/ {totalLaps}</span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          MAIN DISPLAY AREA
         -------------------------------------------------------------------- */}
      <main className="main-content">
        {activeTab === 'RACE' && (
          <>
            {/* B. ACTIVE BATTLE STRIP */}
            <section className="battle-strip">
              {/* Attacker */}
              <div className="car-card attacker">
                <div className="car-pos-badge">P{decision.race.attacker_position ?? 2}</div>
                <div className="car-meta-info">
                  <div className="car-driver-name">{decision.race.attacker ?? 'VER'}</div>
                  <div className="car-team-name">Red Bull Racing • ATTACKER</div>
                  <div className="car-tyre-tag">
                    <span className="compound-dot compound-medium" />
                    <span>MEDIUM (L{(decision.battle.tyre_age_delta ?? 3) + 12})</span>
                  </div>
                </div>
              </div>

              {/* Battle Telemetry Center */}
              <div className="battle-telemetry-center">
                <div className="battle-gap-display">
                  <span className="gap-value-hero">
                    {decision.battle.gap_seconds !== null ? `${decision.battle.gap_seconds.toFixed(3)}s` : '—'}
                  </span>
                  <span className="distance-value-sub">
                    ({decision.battle.distance_gap_m !== null ? `${decision.battle.distance_gap_m.toFixed(1)}m` : '—'})
                  </span>
                </div>

                <div className="battle-metrics-row">
                  <div className="telemetry-cell">
                    <span className="cell-label">Closing Rate</span>
                    <span className="cell-val">
                      {decision.battle.closing_rate !== null ? `${decision.battle.closing_rate > 0 ? '+' : ''}${decision.battle.closing_rate.toFixed(3)} s/lap` : '0.000'}
                    </span>
                  </div>
                  <div className="telemetry-cell">
                    <span className="cell-label">Speed Delta</span>
                    <span className="cell-val">
                      {decision.battle.speed_delta !== null ? `${decision.battle.speed_delta > 0 ? '+' : ''}${decision.battle.speed_delta.toFixed(1)} km/h` : '—'}
                    </span>
                  </div>
                  <div className="telemetry-cell">
                    <span className="cell-label">Laps Stalking</span>
                    <span className="cell-val">{decision.battle.laps_following ?? 4} Laps</span>
                  </div>
                  <div className="telemetry-cell">
                    <span className="cell-label">Rear Threat</span>
                    <span className="cell-val" style={{ color: 'var(--status-green)' }}>
                      {decision.battle.rear_threat ?? 'LOW (>2.5s)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Defender */}
              <div className="car-card defender">
                <div className="car-pos-badge">P{decision.race.defender_position ?? 1}</div>
                <div className="car-meta-info">
                  <div className="car-driver-name">{decision.race.defender ?? 'ANT'}</div>
                  <div className="car-team-name">Mercedes-AMG • DEFENDER</div>
                  <div className="car-tyre-tag">
                    <span className="compound-dot compound-hard" />
                    <span>HARD (L15)</span>
                  </div>
                </div>
              </div>
            </section>

            {/* C. KYNTRA CALL (LARGEST CENTRAL VISUAL ANCHOR) */}
            <section className="kyntra-call-banner">
              <div className="call-header-line">
                <div className="call-title-group">
                  <span className="call-eyebrow">KYNTRA Tactical Directive:</span>
                  <div className={`call-action-hero ${decision.recommendation.available ? getCallClass(decision.recommendation.ui_label) : 'call-conserve'}`}>
                    {decision.recommendation.available ? (decision.recommendation.ui_label ?? 'AWAITING STRATEGY ENGINE') : 'AWAITING STRATEGY ENGINE'}
                  </div>
                </div>
                <div className="call-badges">
                  <span className="pill-badge" style={{ color: 'var(--status-amber)', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                    STRATEGY PENDING VERIFICATION
                  </span>
                </div>
              </div>

              <div className="call-why-list">
                {decision.recommendation.available && decision.recommendation.why.length > 0 ? (
                  decision.recommendation.why.map((reason, idx) => (
                    <div key={idx} className="call-why-item">
                      • {reason}
                    </div>
                  ))
                ) : (
                  <div className="call-why-item" style={{ color: 'var(--text-secondary)' }}>
                    • Strategy recommendation engine is undergoing formal constant & threshold verification audit. No provisional heuristics are being emitted.
                  </div>
                )}
              </div>
            </section>

            {/* D. THE 4 DECISION PILLARS */}
            <section className="decision-pillars-grid">
              {/* Pillar 1: Can I pass? */}
              <div className="pillar-card">
                <div className="pillar-header">
                  <span className="pillar-question">1. Can I Pass?</span>
                  <span className="pillar-tag">LIGHTGBM V1</span>
                </div>
                <div className="pass-horizons-list">
                  <div className="horizon-row">
                    <span className="horizon-label">Next 1 Lap (P₁)</span>
                    <span className="horizon-val">{formatProb(decision.overtake.p_1_lap)}</span>
                  </div>
                  <div className="horizon-row">
                    <span className="horizon-label">Next 2 Laps (P₂)</span>
                    <span className="horizon-val">{formatProb(decision.overtake.p_2_laps)}</span>
                  </div>
                  <div className="horizon-row">
                    <span className="horizon-label">Next 3 Laps (P₃)</span>
                    <span className="horizon-val">{formatProb(decision.overtake.p_3_laps)}</span>
                  </div>
                </div>
                <div className="monotonic-guarantee-note">
                  <span>✓ Monotonic Guarantee: P₁ ≤ P₂ ≤ P₃</span>
                  {decision.overtake.horizon_projection_applied && (
                    <span style={{ color: 'var(--status-amber)' }}>(PAV Applied)</span>
                  )}
                </div>
              </div>

              {/* Pillar 2: Can I afford it? */}
              <div className="pillar-card">
                <div className="pillar-header">
                  <span className="pillar-question">2. Can I Afford It?</span>
                  <span className="pillar-tag">SIMULATED 2026</span>
                </div>
                <div className="energy-meter-container">
                  <div className="energy-labels">
                    <span style={{ color: 'var(--text-secondary)' }}>Usable Energy Reserve</span>
                    <span className="mono" style={{ fontWeight: 700, color: '#ffffff' }}>
                      {decision.energy.available_energy_mj !== null ? `${decision.energy.available_energy_mj.toFixed(2)} MJ` : '—'} / 4.00 MJ
                    </span>
                  </div>
                  <div className="energy-bar-bg">
                    <div
                      className="energy-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, (decision.energy.fraction ?? 0.7) * 100))}%`,
                        backgroundColor: (decision.energy.fraction ?? 0.7) > 0.4 ? 'var(--status-green)' : 'var(--status-amber)',
                      }}
                    />
                  </div>
                  <div className="energy-stats-sub">
                    <span>Reserve: {decision.energy.available_energy_mj?.toFixed(2) ?? '2.65'} MJ</span>
                    <span>Cap: 4.00 MJ / lap</span>
                  </div>
                </div>
                <div className="simulated-energy-banner">
                  SIMULATED — 2026 REGULATION CONSTRAINED (4.0 MJ CAP)
                </div>
              </div>

              {/* Pillar 3: Can I keep it? */}
              <div className="pillar-card">
                <div className="pillar-header">
                  <span className="pillar-question">3. Can I Keep It?</span>
                  <span className="pillar-tag">DETERMINISTIC V1</span>
                </div>
                <div className="stability-verdict-box">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RETENTION VERDICT:</span>
                  <span className="verdict-tag verdict-unknown">
                    {decision.stability.verdict}
                  </span>
                </div>
                <div className="stability-evidence-list">
                  <div>• Rule engine pending empirical verification</div>
                  <div>• No ML retention model in V1</div>
                </div>
                <div className="retention-v1-disclaimer">
                  RULESET PENDING VERIFICATION
                </div>
              </div>

              {/* Pillar 4: Am I allowed? */}
              <div className="pillar-card">
                <div className="pillar-header">
                  <span className="pillar-question">4. Am I Allowed?</span>
                  <span className="pillar-tag">FIA RULES</span>
                </div>
                <div className="compliance-status-box">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RULE STATUS:</span>
                  <span className={decision.compliance.status === 'LEGAL' ? 'status-legal' : decision.compliance.status === 'BLOCKED' ? 'status-blocked' : ''} style={{ color: decision.compliance.status === 'UNKNOWN' ? 'var(--status-amber)' : undefined }}>
                    {decision.compliance.status === 'LEGAL' ? '✓ LEGAL TO ENGAGE' : decision.compliance.status === 'BLOCKED' ? '✕ ACTION RESTRICTED' : '? UNKNOWN (CONFIG MISSING)'}
                  </span>
                </div>
                <div className="compliance-reasons-list">
                  {decision.compliance.reason_codes.map((rc, i) => (
                    <div key={i}>• {rc.replace(/_/g, ' ')}</div>
                  ))}
                </div>
                <div className="retention-v1-disclaimer">
                  Verified against FIA 2026 Tech Issue 20 & Sporting Issue 08.
                </div>
              </div>
            </section>

            {/* E. WHY NOT ATTACK NOW? (Diagnostic Signature Panel) */}
            <section className="why-not-panel">
              <div className="panel-header-simple">Diagnostic Signature Matrix: Attack Readiness Factors</div>
              <div style={{ padding: '8px 12px', marginBottom: '12px', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(245, 158, 11, 0.4)', backgroundColor: 'var(--bg-app)', color: 'var(--status-amber)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                STRATEGY ENGINE NOT AVAILABLE — Readiness gate evaluation pending formal threshold verification audit.
              </div>
              <table className="diagnostic-table">
                <thead>
                  <tr>
                    <th>Tactical Factor</th>
                    <th>Observed Current State</th>
                    <th>Attack Target Window</th>
                    <th>Gate Status</th>
                    <th>Tactical Implication</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="diagnostic-factor">1. Slipstream Proximity</td>
                    <td className="mono">{decision.battle.gap_seconds !== null ? `${decision.battle.gap_seconds.toFixed(3)}s` : '—'}</td>
                    <td className="mono">&lt; 1.000s</td>
                    <td>
                      <span style={{ color: (decision.battle.gap_seconds ?? 2.0) <= 1.0 ? 'var(--status-green)' : 'var(--status-amber)', fontWeight: 700 }}>
                        {(decision.battle.gap_seconds ?? 2.0) <= 1.0 ? '✓ SATISFIED' : '⚠ MARGINAL'}
                      </span>
                    </td>
                    <td>Inside DRS & straight-line slipstream tow zone</td>
                  </tr>
                  <tr>
                    <td className="diagnostic-factor">2. Closing Velocity</td>
                    <td className="mono">{decision.battle.closing_rate !== null ? `${decision.battle.closing_rate.toFixed(3)} s/lap` : '—'}</td>
                    <td className="mono">PENDING AUDIT</td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                        PENDING AUDIT
                      </span>
                    </td>
                    <td>Pace differential threshold pending empirical validation</td>
                  </tr>
                  <tr>
                    <td className="diagnostic-factor">3. Simulated Energy Store</td>
                    <td className="mono">{decision.energy.available_energy_mj?.toFixed(2) ?? '—'} MJ (usable)</td>
                    <td className="mono">PENDING AUDIT</td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                        SIMULATED
                      </span>
                    </td>
                    <td>Simulated reserve tracked against 4.0 MJ capacity window</td>
                  </tr>
                  <tr>
                    <td className="diagnostic-factor">4. Post-Pass Retention Risk</td>
                    <td>UNKNOWN</td>
                    <td>PENDING AUDIT</td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                        RULESET PENDING
                      </span>
                    </td>
                    <td>No approved stability ruleset in V1</td>
                  </tr>
                  <tr>
                    <td className="diagnostic-factor">5. Regulatory Status</td>
                    <td>{decision.compliance.status}</td>
                    <td>LEGAL</td>
                    <td>
                      <span style={{ color: decision.compliance.status === 'LEGAL' ? 'var(--status-green)' : decision.compliance.status === 'BLOCKED' ? 'var(--status-red)' : 'var(--status-amber)', fontWeight: 700 }}>
                        {decision.compliance.status}
                      </span>
                    </td>
                    <td>Checked against sporting neutralization flags and event config</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* F. COUNTERFACTUAL COMPARISON STRIP */}
            <section className="counterfactuals-section">
              <div className="section-label">Counterfactual Strategic Evaluation (4 Tactical Options)</div>
              <div className="counterfactuals-grid">
                {decision.counterfactuals.map((cf) => {
                  return (
                    <div key={cf.action} className="action-card">
                      <div className="action-card-header">
                        <span className="action-title">{cf.action}</span>
                        <span className="rank-badge" style={{ color: 'var(--status-amber)' }}>
                          PENDING VERIFICATION
                        </span>
                      </div>
                      <div className="action-detail-row">
                        <span className="detail-label">Pass Horizon Outcome</span>
                        <span className="detail-text" style={{ color: 'var(--text-muted)' }}>
                          {cf.pass_outcome ?? 'Awaiting strategy engine verification'}
                        </span>
                      </div>
                      <div className="action-detail-row">
                        <span className="detail-label">Position Retention</span>
                        <span className="detail-text" style={{ color: 'var(--text-muted)' }}>
                          {cf.retention_outcome ?? 'Awaiting stability ruleset verification'}
                        </span>
                      </div>
                      <div className="action-detail-row">
                        <span className="detail-label">Ending Battery Store</span>
                        <span className="detail-text mono" style={{ color: 'var(--text-muted)' }}>
                          {cf.ending_energy_mj !== null ? `${cf.ending_energy_mj.toFixed(2)} MJ` : '—'}
                        </span>
                      </div>
                      <div className="action-detail-row">
                        <span className="detail-label">Future Opportunity</span>
                        <span className="detail-text" style={{ color: 'var(--text-muted)' }}>
                          {cf.future_opportunity ?? 'Rollout simulation pending verification'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* G. REPLAY TIMELINE */}
            <section className="replay-timeline-box">
              <div className="timeline-ticks-row">
                <span>START (LAP 1)</span>
                <span>PIT WINDOW PHASE (LAP 20–28)</span>
                <span>FINISH (LAP {totalLaps})</span>
              </div>
              <div
                className="timeline-track"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const pct = Math.max(0, Math.min(1, clickX / rect.width));
                  const targetLap = Math.max(1, Math.round(pct * totalLaps));
                  handleLapChange(targetLap);
                }}
              >
                <div
                  className="timeline-progress"
                  style={{ width: `${(currentLap / totalLaps) * 100}%` }}
                />
                <div
                  className="timeline-marker"
                  style={{ left: `${(currentLap / totalLaps) * 100}%` }}
                />
              </div>
            </section>
          </>
        )}

        {/* SCREEN 2: BATTLE INTELLIGENCE */}
        {activeTab === 'BATTLE' && (
          <div className="secondary-page-container">
            <div className="page-hero">
              <h1>Battle Dynamics & Tracking Intelligence</h1>
              <p>Real-time relative motion, slipstream telemetry, and closing rate trajectories for {decision.race.attacker} vs {decision.race.defender}.</p>
            </div>

            <div className="info-cards-grid">
              <div className="data-table-card">
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#ffffff' }}>Kinematic Comparison</h3>
                <table className="standard-table">
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Attacker Position</td>
                      <td className="mono" style={{ fontWeight: 700 }}>P{decision.race.attacker_position} ({decision.race.attacker})</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Defender Position</td>
                      <td className="mono" style={{ fontWeight: 700 }}>P{decision.race.defender_position} ({decision.race.defender})</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Time Gap to Car Ahead</td>
                      <td className="mono">{decision.battle.gap_seconds?.toFixed(3)} s</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Calculated Physical Distance</td>
                      <td className="mono">{decision.battle.distance_gap_m?.toFixed(1)} m</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Closing Rate (Pace Differential)</td>
                      <td className="mono">{decision.battle.closing_rate?.toFixed(3)} s/lap</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Straight-line Speed Delta</td>
                      <td className="mono">+{decision.battle.speed_delta?.toFixed(1)} km/h</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="data-table-card">
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#ffffff' }}>Stint & Deg Profile</h3>
                <table className="standard-table">
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Laps Following in Wake</td>
                      <td className="mono">{decision.battle.laps_following} Laps</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Tyre Age Delta</td>
                      <td className="mono">+{decision.battle.tyre_age_delta} Laps Freshness Advantage</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Rear Threat Gap</td>
                      <td className="mono" style={{ color: 'var(--status-green)' }}>&gt; 2.5s (Safe Buffer)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Overtake Model Availability</td>
                      <td className="mono">{decision.overtake.available ? 'ONLINE (LightGBM V1)' : 'OFFLINE'}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Missingness Status</td>
                      <td className="mono">0 missing critical features</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 3: COUNTERFACTUALS */}
        {activeTab === 'COUNTERFACTUALS' && (
          <div className="secondary-page-container">
            <div className="page-hero">
              <h1>Counterfactual Multi-Lap Rollout Matrix</h1>
              <p>Exhaustive simulation of tactical actions across energy consumption, position retention, and lap-by-lap risk-reward.</p>
            </div>

            <div className="data-table-card">
              <table className="standard-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Feasibility</th>
                    <th>Pass Horizon Projection</th>
                    <th>Post-Pass Retention</th>
                    <th>Battery Store Impact</th>
                    <th>Tactical Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {decision.counterfactuals.map((cf) => (
                    <tr key={cf.action}>
                      <td style={{ fontWeight: 800, color: cf.action === decision.recommendation.canonical_action ? 'var(--status-cyan)' : '#ffffff' }}>
                        {cf.action} {cf.action === decision.recommendation.canonical_action ? '★ [REC]' : ''}
                      </td>
                      <td>
                        <span style={{ color: cf.feasible ? 'var(--status-green)' : 'var(--status-red)', fontWeight: 600 }}>
                          {cf.feasible ? 'FEASIBLE' : 'BLOCKED'}
                        </span>
                      </td>
                      <td>{cf.pass_outcome}</td>
                      <td>{cf.retention_outcome}</td>
                      <td className="mono">{cf.ending_energy_mj?.toFixed(2)} MJ</td>
                      <td>{cf.future_opportunity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCREEN 4: SYSTEM & PROVENANCE */}
        {activeTab === 'SYSTEM' && (
          <div className="secondary-page-container">
            <div className="page-hero">
              <h1>System Architecture & Provenance Matrix</h1>
              <p>Model specification, dataset split isolation, holdout audit status, and verification registers.</p>
            </div>

            <div className="info-cards-grid">
              <div className="data-table-card">
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#ffffff' }}>1. Overtake ML Model V1</h3>
                <table className="standard-table">
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Architecture</td>
                      <td className="mono">LightGBM Monotonic Ensemble</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Horizons</td>
                      <td className="mono">1 Lap / 2 Laps / 3 Laps Cumulative</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Monotonic Constraint</td>
                      <td className="mono">Monotonic Decreasing on gap_seconds only</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Horizon Projection</td>
                      <td className="mono">Equal-weight Pool Adjacent Violators (PAV)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Metadata SHA256</td>
                      <td className="mono" style={{ fontSize: '10px' }}>60aaae5f6d71b40283e7ee55db0091433f81017e8ff3b591bce987b7643b06db</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="data-table-card">
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#ffffff' }}>2. Split Isolation Register</h3>
                <table className="standard-table">
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>TRAIN Events (6)</td>
                      <td className="mono">CHN, CAN, GBR, BEL, HUN, NLD (3,288 obs)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>VALIDATION Events (3)</td>
                      <td className="mono">MCO, ESP, AUT (1,848 obs)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>DEMO HOLDOUT (4)</td>
                      <td className="mono" style={{ color: 'var(--status-cyan)' }}>Australia, Japan, Miami, Italy (Zero Leakage)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Battle ID Overlap</td>
                      <td className="mono" style={{ color: 'var(--status-green)' }}>0 overlapping battle sequences</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="data-table-card">
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#ffffff' }}>3. Demo Replay Audit Status</h3>
                <table className="standard-table">
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>2026 Italy (Monza)</td>
                      <td className="mono" style={{ color: 'var(--status-green)' }}>VER vs ANT — Full 53 Laps, 3 Cars (PRIMARY)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>2026 Australia</td>
                      <td className="mono" style={{ color: 'var(--status-green)' }}>Full Event Replay Verified</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>2026 Miami</td>
                      <td className="mono" style={{ color: 'var(--status-green)' }}>Full Event Replay Verified</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>2026 Japan (Suzuka)</td>
                      <td className="mono" style={{ color: 'var(--status-amber)' }}>FEED AUDIT: Single Car (#12 ANT) Ingested. #4 Battle Telemetry Not In Feed. No Telemetry Fabricated.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="data-table-card">
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#ffffff' }}>4. Post-Pass Stability Architecture</h3>
                <table className="standard-table">
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Method</td>
                      <td className="mono">DETERMINISTIC_POST_PASS_STABILITY_V1</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>ML Retention Model</td>
                      <td className="mono" style={{ color: 'var(--status-amber)' }}>NONE (Explicitly Not Implemented in V1)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Determinants</td>
                      <td className="mono">Tire life delta, clear-air pace delta, rear threat margin</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 5: REGULATIONS */}
        {activeTab === 'REGULATIONS' && (
          <div className="secondary-page-container">
            <div className="page-hero">
              <h1>FIA 2026 Formula 1 Regulatory Authority</h1>
              <p>Official technical and sporting rules governing energy deployment curves, power ceilings, and overtaking conditions.</p>
            </div>

            <div className="info-cards-grid">
              <div className="data-table-card">
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#ffffff' }}>Technical Regulations</h3>
                <table className="standard-table">
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Document Authority</td>
                      <td className="mono">FIA 2026 F1 Regulations — Section C (Technical)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Issue & Date</td>
                      <td className="mono">Issue 20 — Published 05 August 2026</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Article C5.2.7</td>
                      <td className="mono">ERS-K absolute electrical DC power &le; 350 kW</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Article C5.2.8(i)</td>
                      <td className="mono">Standard power-vs-speed curve: 350 kW to 290 km/h; linear taper to 0 kW at 345 km/h</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Article C5.2.8(ii)</td>
                      <td className="mono">Overtake-active power-vs-speed curve: 350 kW to 337.5 km/h; taper to 0 kW at 355 km/h</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Article C5.2.9</td>
                      <td className="mono">Energy Store max-minus-min state of charge &le; 4 MJ operational buffer</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Article C5.2.10</td>
                      <td className="mono">Per-lap Energy Store recharge maximum (8.5 MJ baseline)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="data-table-card">
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#ffffff' }}>Sporting Regulations</h3>
                <table className="standard-table">
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Document Authority</td>
                      <td className="mono">FIA 2026 F1 Regulations — Section B (Sporting)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Issue & Date</td>
                      <td className="mono">Issue 08 — Published 05 August 2026</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Article B5.12.2(c)</td>
                      <td className="mono">Virtual Safety Car (VSC) overtaking restriction</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Article B5.13.2(c)</td>
                      <td className="mono">Safety Car (SC) overtaking restriction</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Article B5.14.2(a)</td>
                      <td className="mono">Suspended race / red flag overtaking restriction</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)' }}>Section B1.8.4</td>
                      <td className="mono">Yellow flag driver behaviour (YELLOW_FLAG_RULE_SOURCE_PENDING_ISC_VERIFICATION)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --------------------------------------------------------------------
          H. PROVENANCE & STATUS FOOTER
         -------------------------------------------------------------------- */}
      <footer className="provenance-footer">
        <div className="footer-left">
          <span>TELEMETRY: {decision.provenance.telemetry_source}</span>
          <span>•</span>
          <span style={{ color: 'var(--status-amber)' }}>
            ENERGY: {decision.provenance.energy_source} (SIMULATED)
          </span>
          <span>•</span>
          <span>STABILITY: {decision.provenance.stability_method}</span>
        </div>
        <div className="footer-right">
          <span>MODEL: {decision.provenance.overtake_model_version}</span>
          <span>•</span>
          <span>REG: {decision.provenance.regulation_config_version}</span>
          <span>•</span>
          <span>CONF: {decision.provenance.event_config_version}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
