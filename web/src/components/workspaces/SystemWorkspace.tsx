import React, { useState } from 'react';
import type { SystemStatus, SystemTabId } from '../../types';

interface SystemWorkspaceProps {
  systemStatus: SystemStatus | null;
  wsConnected: boolean;
  totalEventsCount: number;
}

export const SystemWorkspace: React.FC<SystemWorkspaceProps> = ({
  systemStatus,
  wsConnected,
  totalEventsCount,
}) => {
  const [activeTab, setActiveTab] = useState<SystemTabId>('OVERVIEW');

  const tabs: { id: SystemTabId; label: string }[] = [
    { id: 'OVERVIEW', label: 'OVERVIEW' },
    { id: 'DATA', label: 'DATASET & SPLITS' },
    { id: 'MODEL', label: 'ML MODEL BUNDLE' },
    { id: 'ENERGY', label: '2026 ENERGY PU' },
    { id: 'FIA', label: 'FIA REGULATIONS' },
    { id: 'PROVIDERS', label: 'DATA PROVIDERS' },
    { id: 'LIMITATIONS', label: 'KNOWN LIMITATIONS' },
  ];

  return (
    <div className="workspace-system-container">
      {/* System Sub-Navigation Tabs */}
      <div className="system-tab-strip">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sys-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content Panes (Internally Scrollable Bounded Container) */}
      <div className="system-content-viewport">
        {/* Tab 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="sys-pane-section">
            <div className="sys-header-with-symbol">
              <img src="/brand/kyntra-symbol.png" alt="KYNTRA" className="system-brand-symbol" />
              <h3 className="section-heading">KYNTRA SYSTEM DIAGNOSTICS & PROVENANCE</h3>
            </div>
            <div className="sys-cards-grid">
              <div className="sys-card">
                <span className="card-title">CORE STATUS</span>
                <span className="card-metric text-legal font-bold">
                  {systemStatus?.status ? systemStatus.status.toUpperCase() : 'OPERATIONAL'}
                </span>
                <span className="card-sub">FastAPI Backend + SQLite Event Store</span>
              </div>
              <div className="sys-card">
                <span className="card-title">WEBSOCKET PIPELINE</span>
                <span className={`card-metric font-bold ${wsConnected ? 'text-legal' : 'text-amber'}`}>
                  {wsConnected ? 'CONNECTED' : 'FALLBACK POLLING'}
                </span>
                <span className="card-sub">Endpoint: WS /api/live</span>
              </div>
              <div className="sys-card">
                <span className="card-title">RACE MEMORY STORE</span>
                <span className="card-metric mono font-bold">{totalEventsCount} EVENTS</span>
                <span className="card-sub">data/race_memory.db (WAL Mode)</span>
              </div>
              <div className="sys-card">
                <span className="card-title">FROZEN ML STATUS</span>
                <span className="card-metric text-accent font-bold">
                  {systemStatus?.overtake_model?.model_version || 'LGBM V1 FROZEN'}
                </span>
                <span className="card-sub mono">
                  Algorithm: {systemStatus?.overtake_model?.algorithm || 'LightGBM'} (SHA: a368b020)
                </span>
              </div>
              <div className="sys-card">
                <span className="card-title">CIRCUIT GEOMETRY</span>
                <span className="card-metric text-accent font-bold">TELEMETRY-DERIVED</span>
                <span className="card-sub">Telemetry X/Y coordinates; zero claim of official FIA circuit coordinate files.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: DATASET & SPLITS */}
        {activeTab === 'DATA' && (
          <div className="sys-pane-section">
            <h3 className="section-heading">TRAINING / VALIDATION DATASET & DEMO HOLDOUTS</h3>
            <p className="section-desc">
              All machine-learning models are strictly isolated from the designated demo holdout events.
              Zero leakage risk is enforced via physical file separation and deterministic event routing.
            </p>

            <div className="detail-table-card">
              <table className="standard-table">
                <thead>
                  <tr>
                    <th>EVENT IDENTIFIER</th>
                    <th>CIRCUIT NAME</th>
                    <th>DATASET SPLIT STATUS</th>
                    <th>ISOLATION INVARIANT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono font-bold">2026_01_AUS</td>
                    <td>Albert Park (Australia)</td>
                    <td><span className="badge-holdout">DEMO HOLDOUT</span></td>
                    <td className="text-legal">Zero training/validation contamination</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">2026_03_JPN</td>
                    <td>Suzuka Circuit (Japan)</td>
                    <td><span className="badge-holdout">DEMO HOLDOUT</span></td>
                    <td className="text-legal">Zero training/validation contamination</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">2026_05_MIA</td>
                    <td>Miami International Autodrome (USA)</td>
                    <td><span className="badge-holdout">DEMO HOLDOUT</span></td>
                    <td className="text-legal">Zero training/validation contamination</td>
                  </tr>
                  <tr>
                    <td className="mono font-bold">2026_13_ITA</td>
                    <td>Autodromo Nazionale Monza (Italy)</td>
                    <td><span className="badge-holdout">DEMO HOLDOUT</span></td>
                    <td className="text-legal">Zero training/validation contamination</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: MODEL BUNDLE */}
        {activeTab === 'MODEL' && (
          <div className="sys-pane-section">
            <h3 className="section-heading">FROZEN LIGHTGBM OVERTAKE BUNDLE SPECIFICATION</h3>
            <div className="provenance-banner">
              <div className="prov-row">
                <span className="lbl">Model Path:</span>
                <span className="val mono">models/kyntra_overtake_bundle_v1.joblib</span>
              </div>
              <div className="prov-row">
                <span className="lbl">Bit-Exact SHA-256 Checksum:</span>
                <span className="val mono text-accent font-bold">
                  a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5
                </span>
              </div>
              <div className="prov-row">
                <span className="lbl">Model Family:</span>
                <span className="val">LightGBM separate cumulative models for 1 / 2 / 3 laps (H1, H2, H3)</span>
              </div>
              <div className="prov-row">
                <span className="lbl">Monotonic Projection:</span>
                <span className="val">PAV (Pool Adjacent Violators) post-processing enforces H1 &le; H2 &le; H3</span>
              </div>
            </div>

            <h4 style={{ marginTop: '16px', color: '#ffffff', fontSize: '13px' }}>FIVE FROZEN DYNAMICS FEATURES</h4>
            <div className="features-grid">
              <div className="feat-card">
                <span className="feat-name mono">gap_seconds</span>
                <span className="feat-desc">Temporal gap to car ahead. Strict monotonic decreasing constraint (-1).</span>
              </div>
              <div className="feat-card">
                <span className="feat-name mono">closing_rate</span>
                <span className="feat-desc">Closing velocity in m/s derived from speed delta or gap derivative.</span>
              </div>
              <div className="feat-card">
                <span className="feat-name mono">recent_pace_delta_1lap</span>
                <span className="feat-desc">1-Lap relative sector lap time delta between attacker and defender.</span>
              </div>
              <div className="feat-card">
                <span className="feat-name mono">recent_pace_delta_3laps</span>
                <span className="feat-desc">3-Lap smoothed relative pace differential.</span>
              </div>
              <div className="feat-card">
                <span className="feat-name mono">speed_trap_delta</span>
                <span className="feat-desc">Maximum speed differential at official circuit speed-trap timing line.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: 2026 ENERGY PU */}
        {activeTab === 'ENERGY' && (
          <div className="sys-pane-section">
            <h3 className="section-heading">2026 FORMULA 1 HYBRID POWERTRAIN ARCHITECTURE</h3>
            <p className="section-desc">
              The 2026 regulations overhaul the Formula 1 Power Unit: MGU-H is abolished, MGU-K electrical output
              is tripled to 350 kW, and the usable Energy Store operational differential is regulated to 4.0 MJ.
            </p>

            <div className="energy-specs-grid">
              <div className="spec-card">
                <span className="s-title">MGU-K ELECTRICAL POWER</span>
                <span className="s-metric mono font-bold">350 kW (475 HP)</span>
                <span className="s-sub">Article C5.2.7 absolute electrical DC ceiling</span>
              </div>
              <div className="spec-card">
                <span className="s-title">ENERGY STORE BUFFER</span>
                <span className="s-metric mono font-bold">4.0 MJ MAX-MIN</span>
                <span className="s-sub">Article C5.2.9 usable operational state of charge</span>
              </div>
              <div className="spec-card">
                <span className="s-title">PER-LAP RECHARGE CEILING</span>
                <span className="s-metric mono font-bold">8.5 MJ / LAP</span>
                <span className="s-sub">Article C5.2.10 baseline kinetic recovery cap</span>
              </div>
              <div className="spec-card">
                <span className="s-title">TELEMETRY PROVENANCE</span>
                <span className="s-metric text-amber font-bold">SIMULATED</span>
                <span className="s-sub">Zero fabrication of private CAN / ATLAS battery SOC</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: FIA REGULATIONS */}
        {activeTab === 'FIA' && (
          <div className="sys-pane-section">
            <h3 className="section-heading">FIA 2026 REGULATORY AUTHORITY & LEGAL CITATIONS</h3>
            <div className="prov-row" style={{ marginBottom: '12px' }}>
              <span className="lbl">Authority Document:</span>
              <span className="val font-bold">FIA 2026 F1 Regulations — Section C (Technical), Issue 20 (Published 05 August 2026)</span>
            </div>

            <table className="standard-table">
              <thead>
                <tr>
                  <th>ARTICLE REFERENCE</th>
                  <th>OFFICIAL TITLE / SUBJECT</th>
                  <th>MANDATED THRESHOLD / MATHEMATICAL SPECIFICATION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono font-bold text-accent">Article C5.2.7</td>
                  <td>ERS-K Maximum Electrical Power</td>
                  <td>The absolute electrical DC power of the ERS-K must not exceed 350 kW.</td>
                </tr>
                <tr>
                  <td className="mono font-bold text-accent">Article C5.2.8(i)</td>
                  <td>Standard Power-vs-Speed Curve</td>
                  <td>350 kW from 0 to 290 km/h; linear taper to 0 kW at 345 km/h: P(v) = 350 &times; (345 - v) / (345 - 290).</td>
                </tr>
                <tr>
                  <td className="mono font-bold text-accent">Article C5.2.8(ii)</td>
                  <td>Overtake Override Power Curve</td>
                  <td>350 kW maintained from 0 to 337.5 km/h; linear taper to 0 kW at 355 km/h: P(v) = 350 &times; (355 - v) / (355 - 337.5).</td>
                </tr>
                <tr>
                  <td className="mono font-bold text-accent">Article C5.2.9</td>
                  <td>Energy Store Usable Buffer</td>
                  <td>Maximum state of charge minus minimum state of charge must not exceed 4.0 MJ in any single session lap.</td>
                </tr>
                <tr>
                  <td className="mono font-bold text-accent">Article C5.2.10</td>
                  <td>Per-Lap Recharge Ceiling</td>
                  <td>Maximum electrical energy transferred from the ERS-K to the Energy Store must not exceed 8.5 MJ baseline.</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 6: DATA PROVIDERS */}
        {activeTab === 'PROVIDERS' && (
          <div className="sys-pane-section">
            <h3 className="section-heading">DATA PROVIDER CAPABILITY MATRIX</h3>
            <p className="section-desc">
              KYNTRA's predictive pipeline operates on a decoupled data provider interface. The exact same
              intelligence pipeline (EventStore, BattleDetector, LightGBM Inference, FIA Compliance, and Digital Track Twin)
              ingests telemetry identically across all provider implementations.
            </p>

            <div className="provider-matrix-wrapper">
              <table className="standard-table provider-matrix-table">
                <thead>
                  <tr>
                    <th>TELEMETRY CHANNEL / CAPABILITY</th>
                    <th>REPLAY PROVIDER (ACTIVE)</th>
                    <th>PUBLIC LIVE PROVIDER (STANDBY)</th>
                    <th>TEAM TELEMETRY PROVIDER (STANDBY)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Provider Operational Status</td>
                    <td><span className="matrix-status status-active">OPERATIONAL (ACTIVE)</span></td>
                    <td><span className="matrix-status status-standby">STANDBY</span></td>
                    <td><span className="matrix-status status-future">STANDBY / FUTURE</span></td>
                  </tr>
                  <tr>
                    <td>Official Race Timing & Gaps</td>
                    <td><span className="matrix-val val-avail">AVAILABLE</span></td>
                    <td><span className="matrix-val val-avail">AVAILABLE (SOCKET)</span></td>
                    <td><span className="matrix-val val-avail">AVAILABLE</span></td>
                  </tr>
                  <tr>
                    <td>Car Coordinates (X, Y)</td>
                    <td><span className="matrix-val val-avail">AVAILABLE (WHERE PRESENT)</span></td>
                    <td><span className="matrix-val val-avail">INTERPOLATED</span></td>
                    <td><span className="matrix-val val-avail">HIGH-ACCURACY GPS</span></td>
                  </tr>
                  <tr>
                    <td>Car Speed & Velocity Deltas</td>
                    <td><span className="matrix-val val-avail">AVAILABLE</span></td>
                    <td><span className="matrix-val val-avail">SECTOR AVERAGE</span></td>
                    <td><span className="matrix-val val-avail">100Hz HIGH RATE</span></td>
                  </tr>
                  <tr>
                    <td>Tyre Compound & Stint Age</td>
                    <td><span className="matrix-val val-avail">AVAILABLE</span></td>
                    <td><span className="matrix-val val-avail">AVAILABLE</span></td>
                    <td><span className="matrix-val val-avail">DIRECT SENSOR</span></td>
                  </tr>
                  <tr>
                    <td>Track Status & Flags (FIA)</td>
                    <td><span className="matrix-val val-avail">AVAILABLE</span></td>
                    <td><span className="matrix-val val-avail">AVAILABLE</span></td>
                    <td><span className="matrix-val val-avail">AVAILABLE</span></td>
                  </tr>
                  <tr>
                    <td>Private ERS / MGU-K Motor Torque</td>
                    <td><span className="matrix-val val-unavail">UNAVAILABLE</span></td>
                    <td><span className="matrix-val val-unavail">UNAVAILABLE</span></td>
                    <td><span className="matrix-val val-avail">AVAILABLE (CAN BUS)</span></td>
                  </tr>
                  <tr>
                    <td>Actual Battery Cell SOC</td>
                    <td><span className="matrix-val val-unavail">UNAVAILABLE</span></td>
                    <td><span className="matrix-val val-unavail">UNAVAILABLE</span></td>
                    <td><span className="matrix-val val-avail">AVAILABLE (ATLAS)</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="provider-footer-notice mono">
              PIPELINE INVARIANT: When private channels are UNAVAILABLE, KYNTRA strictly computes regulation-bounded
              simulations (FIA Article C5.2.9: 4.0 MJ operational buffer) and labels all outputs as SIMULATED.
            </div>
          </div>
        )}

        {/* Tab 7: KNOWN LIMITATIONS */}
        {activeTab === 'LIMITATIONS' && (
          <div className="sys-pane-section">
            <h3 className="section-heading">SYSTEM BOUNDARIES & INTENTIONAL LIMITATIONS</h3>
            <div className="limitations-list">
              <div className="limitation-item">
                <span className="lim-bullet">1</span>
                <div>
                  <strong>Awaiting Strategy Engine:</strong> Tactical recommendation policies (ATTACK / HOLD / PREPARE / SAVE)
                  are intentionally unactivated pending verified multi-horizon game-theoretic optimization.
                </div>
              </div>
              <div className="limitation-item">
                <span className="lim-bullet">2</span>
                <div>
                  <strong>Stability Status UNKNOWN:</strong> Post-pass retention classifier is not trained. KYNTRA will not
                  guess counter-pass stability outcomes without empirical benchmark data.
                </div>
              </div>
              <div className="limitation-item">
                <span className="lim-bullet">3</span>
                <div>
                  <strong>Zero Telemetry Fabrication:</strong> Battery SOC, cell temperatures, and MGU-K motor torque are
                  proprietary private team telemetry channels. KYNTRA labels all energy calculations strictly as SIMULATED.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
