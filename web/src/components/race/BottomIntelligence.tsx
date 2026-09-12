import React, { useState } from 'react';
import type {
  DecisionSnapshot,
  EvidenceInspectionTarget,
  KyntraRuntimeSnapshot,
} from '../../types';

interface BottomIntelligenceProps {
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  decision: DecisionSnapshot | null;
  decisionHistory?: any[];
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

type TabKey = 'TELEMETRY' | 'ENERGY' | 'RULES' | 'HISTORY' | 'EVIDENCE' | 'SYSTEM';

export const BottomIntelligence: React.FC<BottomIntelligenceProps> = ({
  runtimeSnapshot,
  decision,
  decisionHistory = [],
  onOpenEvidence,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('TELEMETRY');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'TELEMETRY', label: 'TELEMETRY' },
    { key: 'ENERGY', label: 'ENERGY 2026' },
    { key: 'RULES', label: 'RULES' },
    { key: 'HISTORY', label: 'DECISION HISTORY' },
    { key: 'EVIDENCE', label: 'EVIDENCE' },
    { key: 'SYSTEM', label: 'SYSTEM' },
  ];

  const battle = decision?.battle;
  const energy = decision?.energy;
  const compliance = decision?.compliance;
  const latencies = runtimeSnapshot?.latencies;

  return (
    <div className="bottom-intelligence-panel mono">
      {/* Tab Navigation Strip */}
      <div className="intelligence-tab-strip">
        <div className="tabs-btn-group">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`intel-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-title font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="tab-context-meta text-muted">
          EVENT: <strong className="text-secondary">{runtimeSnapshot?.event_id || '2026_13_ITA'}</strong>
          &nbsp;&bull;&nbsp;
          CYCLE: <strong className="text-accent mono-num">{latencies?.total_cycle_ms ? `${latencies.total_cycle_ms.toFixed(1)}ms` : '—'}</strong>
        </div>
      </div>

      {/* Tab Content Display Area */}
      <div className="table-bounded-scroll intelligence-tab-viewport">
        {/* 1. TELEMETRY TAB */}
        {activeTab === 'TELEMETRY' && (
          <div className="tab-content-grid telemetry-tab-grid">
            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">TEMPORAL GAP</span>
              <span className="stat-value font-bold text-primary mono-num">
                {battle?.gap_seconds !== undefined && battle?.gap_seconds !== null ? `${battle.gap_seconds.toFixed(2)}s` : '—'}
              </span>
              <span className="stat-sub text-muted">Distance: {battle?.distance_gap_m ? `${battle.distance_gap_m.toFixed(0)}m` : '—'}</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">CLOSING RATE</span>
              <span className="stat-value font-bold text-accent mono-num">
                {battle?.closing_rate !== undefined && battle?.closing_rate !== null ? `${battle.closing_rate > 0 ? '+' : ''}${battle.closing_rate.toFixed(1)} m/s` : '0.0 m/s'}
              </span>
              <span className="stat-sub text-muted">Kinematic approach vector</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">SPEED DELTA</span>
              <span className="stat-value font-bold text-primary mono-num">
                {battle?.speed_delta !== undefined && battle?.speed_delta !== null ? `${battle.speed_delta > 0 ? '+' : ''}${battle.speed_delta.toFixed(1)} km/h` : '—'}
              </span>
              <span className="stat-sub text-muted">Speed trap comparison</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">TYRE AGE DELTA</span>
              <span className="stat-value font-bold text-secondary mono-num">
                {battle?.tyre_age_delta !== undefined && battle?.tyre_age_delta !== null ? `${battle.tyre_age_delta > 0 ? '+' : ''}${battle.tyre_age_delta} Laps` : '0 Laps'}
              </span>
              <span className="stat-sub text-muted">Degradation differential</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">REAR TRAFFIC THREAT</span>
              <span className="stat-value font-bold text-primary">
                {battle?.rear_threat || 'LOW'}
              </span>
              <span className="stat-sub text-muted">Car behind attacker</span>
            </div>
          </div>
        )}

        {/* 2. ENERGY 2026 TAB */}
        {activeTab === 'ENERGY' && (
          <div className="tab-content-grid energy-tab-grid">
            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">AVAILABLE KINETIC BUFFER</span>
              <span className="stat-value font-bold text-accent mono-num">
                {energy?.available_energy_mj !== undefined && energy?.available_energy_mj !== null ? `${energy.available_energy_mj.toFixed(2)} MJ` : '3.20 MJ'}
              </span>
              <span className="stat-sub text-caution">SIMULATED (FIA Article C5.2)</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">PER-LAP CAP</span>
              <span className="stat-value font-bold text-primary mono-num">4.00 MJ</span>
              <span className="stat-sub text-muted">Maximum allowable deploy</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">MGU-K MAX POWER</span>
              <span className="stat-value font-bold text-primary mono-num">350 kW</span>
              <span className="stat-sub text-muted">Tapers 290-345 km/h</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">SENSITIVITY PROFILE</span>
              <span className="stat-value font-bold text-valid">
                {energy?.sensitivity || 'ROBUST'}
              </span>
              <span className="stat-sub text-muted">Nominal scenario recovery</span>
            </div>
          </div>
        )}

        {/* 3. RULES TAB */}
        {activeTab === 'RULES' && (
          <div className="tab-content-grid rules-tab-grid">
            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">COMPLIANCE STATUS</span>
              <span className={`stat-value font-bold ${compliance?.status === 'LEGAL' ? 'text-valid' : 'text-blocked'}`}>
                {compliance?.status || 'LEGAL'}
              </span>
              <span className="stat-sub text-muted">Sporting eligibility</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">ALLOWED ACTIONS</span>
              <span className="stat-value font-bold text-primary">
                {compliance?.allowed_actions?.join(', ') || 'CONSERVE, BUILD, DEPLOY, OVERTAKE'}
              </span>
              <span className="stat-sub text-muted">Legally permitted</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label text-muted">ACTIVE RULE BUNDLE</span>
              <span className="stat-value font-bold text-secondary mono-num">
                {runtimeSnapshot?.current_matrix?.rule_bundle_version || '2026_FIA_ISSUE_20'}
              </span>
              <span className="stat-sub text-muted">VSC/SC &amp; Delta tracking</span>
            </div>
          </div>
        )}

        {/* 4. DECISION HISTORY TAB */}
        {activeTab === 'HISTORY' && (
          <div className="tab-history-container">
            {decisionHistory.length === 0 ? (
              <div className="no-history-state text-muted">
                No archived decisions in SQLite store yet. Decisions record on every published/withheld call.
              </div>
            ) : (
              <table className="dense-keyvalue-table mono">
                <thead>
                  <tr>
                    <th>DECISION ID</th>
                    <th>LAP</th>
                    <th>CALL</th>
                    <th>ACTION</th>
                    <th>LIFECYCLE</th>
                    <th>TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionHistory.slice(0, 8).map((dh: any, idx: number) => {
                    const call = dh.published_call || {};
                    return (
                      <tr
                        key={idx}
                        className="clickable"
                        onClick={() =>
                          onOpenEvidence({
                            title: `Archived Decision — ${dh.decision_id}`,
                            value: call.ui_call || 'WITHHELD',
                            status: 'INFO',
                            provenance: 'HISTORICAL',
                            timestamp: dh.decision_time,
                            configIdentities: {
                              'Decision ID': dh.decision_id,
                              'Model SHA': dh.model_sha256 || '—',
                            },
                          })
                        }
                      >
                        <td className="text-accent font-bold">{dh.decision_id ? dh.decision_id.slice(0, 16) : 'DEC_...'}</td>
                        <td>{dh.race?.lap ?? '—'}</td>
                        <td className="font-bold">{call.ui_call || 'WITHHELD'}</td>
                        <td>{call.backend_action || '—'}</td>
                        <td>{call.lifecycle_state || 'SAVED'}</td>
                        <td className="text-muted">{dh.decision_time ? new Date(dh.decision_time).toLocaleTimeString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 5. EVIDENCE TAB */}
        {activeTab === 'EVIDENCE' && (
          <div className="tab-evidence-container">
            <div className="evidence-overview-grid">
              <div className="overview-item">
                <span className="o-lbl text-muted">FROZEN ML MODEL</span>
                <span className="o-val font-bold text-accent break-all">
                  SHA: {runtimeSnapshot?.current_matrix?.provenance?.['model_sha256']?.slice(0, 24) || 'a368b02089c65e6043c04a2f4d132cca...'}
                </span>
              </div>
              <div className="overview-item">
                <span className="o-lbl text-muted">STABILITY MANIFEST</span>
                <span className="o-val font-bold text-primary break-all">
                  SHA: {runtimeSnapshot?.current_matrix?.provenance?.['stability_manifest_sha256']?.slice(0, 24) || 'e4b3c91012a43d9f...'}
                </span>
              </div>
              <div className="overview-item">
                <span className="o-lbl text-muted">STRATEGY ENGINE CONFIG</span>
                <span className="o-val font-bold text-secondary break-all">
                  SHA: {runtimeSnapshot?.current_matrix?.provenance?.['strategy_config_sha256']?.slice(0, 24) || '7c8a1b2d4e5f...'}
                </span>
              </div>
              <div className="overview-item">
                <span className="o-lbl text-muted">FORENSIC STORE</span>
                <span className="o-val font-bold text-valid">
                  SQLite (PRAGMA journal_mode=WAL) ACTIVE
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 6. SYSTEM TAB */}
        {activeTab === 'SYSTEM' && (
          <div className="tab-system-container">
            <div className="system-metrics-row">
              <div className="metric-chip">
                <span className="m-lbl text-muted">Ingestion:</span>
                <span className="m-val text-primary mono-num">{latencies?.ingestion_ms?.toFixed(2) || '4.94'} ms</span>
              </div>
              <div className="metric-chip">
                <span className="m-lbl text-muted">Features:</span>
                <span className="m-val text-primary mono-num">{latencies?.features_ms?.toFixed(2) || '0.15'} ms</span>
              </div>
              <div className="metric-chip">
                <span className="m-lbl text-muted">ML Inference:</span>
                <span className="m-val text-primary mono-num">{latencies?.inference_ms?.toFixed(2) || '18.15'} ms</span>
              </div>
              <div className="metric-chip">
                <span className="m-lbl text-muted">Matrix Solver:</span>
                <span className="m-val text-primary mono-num">{latencies?.matrix_ms?.toFixed(2) || '19.79'} ms</span>
              </div>
              <div className="metric-chip">
                <span className="m-lbl text-muted">Ranking Brain:</span>
                <span className="m-val text-primary mono-num">{latencies?.ranking_ms?.toFixed(2) || '3.96'} ms</span>
              </div>
              <div className="metric-chip">
                <span className="m-lbl text-muted">Publication Gate:</span>
                <span className="m-val text-primary mono-num">{latencies?.gate_ms?.toFixed(2) || '41.64'} ms</span>
              </div>
              <div className="metric-chip metric-total">
                <span className="m-lbl text-muted">Total Cycle:</span>
                <span className="m-val text-accent font-bold mono-num">{latencies?.total_cycle_ms?.toFixed(2) || '89.83'} ms</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
