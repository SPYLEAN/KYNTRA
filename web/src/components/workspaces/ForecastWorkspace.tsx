import React, { useEffect, useState } from 'react';
import type { BattleWatchlistItem, DecisionSnapshot, ForecastScenario } from '../../types';

interface ForecastWorkspaceProps {
  decision: DecisionSnapshot | null;
  watchlist: BattleWatchlistItem[];
  currentLap: number;
  circuitName?: string;
  eventId?: string;
  onSelectBattle?: (battleId: string) => void;
}

export const ForecastWorkspace: React.FC<ForecastWorkspaceProps> = ({
  decision,
  watchlist: _watchlist,
  currentLap,
  circuitName = '—',
  eventId = '2026_13_ITA',
}) => {
  const [forecastData, setForecastData] = useState<{
    status: string;
    run_count: number;
    scenarios: ForecastScenario[];
    provenance: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/forecast/${eventId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) setForecastData(data);
      })
      .catch(() => {
        if (isMounted) {
          setForecastData({
            status: 'UNAVAILABLE',
            run_count: 0,
            scenarios: [],
            provenance: 'FORECAST_SIMULATION',
            message: 'FORECAST NOT AVAILABLE',
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const runCount = forecastData?.run_count ?? 0;
  const isAvailable = forecastData?.status === 'AVAILABLE' && runCount > 0;

  const attacker = decision?.race.attacker || '—';
  const defender = decision?.race.defender || '—';
  const initialGap = decision?.battle.gap_seconds;

  return (
    <div className="workspace-forecast-container">
      {/* Top Truth Banner */}
      <div className="forecast-truth-header-strip">
        <div className="forecast-header-left">
          <span className="forecast-badge font-bold">FORWARD RACE SIMULATION</span>
          <span className="forecast-run-badge mono font-bold text-accent">RUNS: {runCount}</span>
          <span className={`forecast-status-tag mono ${isAvailable ? 'tag-legal' : 'tag-unavailable'}`}>
            {isAvailable ? 'SIMULATION ACTIVE' : 'FORECAST NOT AVAILABLE'}
          </span>
        </div>
        <div className="forecast-header-right mono">
          <span className="provenance-tag">PROVENANCE: {forecastData?.provenance || 'FORECAST_SIMULATION'}</span>
        </div>
      </div>

      {/* 3-Column Forecast Layout */}
      <div className="forecast-main-columns">
        {/* ==================== COLUMN 1: STARTING STATE ==================== */}
        <div className="forecast-col forecast-col-start">
          <div className="panel-inner-card">
            <div className="panel-header-row">
              <span className="panel-title font-bold">STARTING CONDITIONS</span>
              <span className="mono text-accent">STATE INGEST</span>
            </div>

            <div className="forecast-state-params">
              <div className="param-item">
                <span className="p-lbl">CIRCUIT:</span>
                <span className="p-val font-bold">{circuitName}</span>
              </div>
              <div className="param-item">
                <span className="p-lbl">START LAP:</span>
                <span className="p-val mono font-bold text-accent">Lap {currentLap > 0 ? currentLap : '—'}</span>
              </div>
              <div className="param-item">
                <span className="p-lbl">ENGAGEMENT:</span>
                <span className="p-val mono font-bold">{attacker} &rarr; {defender}</span>
              </div>
              <div className="param-item">
                <span className="p-lbl">INITIAL GAP:</span>
                <span className="p-val mono">
                  {initialGap !== null && initialGap !== undefined ? `${initialGap.toFixed(2)}s` : '—'}
                </span>
              </div>
              <div className="param-item">
                <span className="p-lbl">INITIAL SIMULATED ENERGY:</span>
                <span className="p-val mono">
                  {decision?.energy.available_energy_mj !== null && decision?.energy.available_energy_mj !== undefined
                    ? `${decision.energy.available_energy_mj.toFixed(2)} MJ`
                    : '—'}
                </span>
              </div>
              <div className="param-item">
                <span className="p-lbl">TRACK STATUS:</span>
                <span className="p-val mono text-legal">FLAG {decision?.compliance.status === 'LEGAL' ? '1 (GREEN)' : 'YELLOW / CAUTION'}</span>
              </div>
            </div>

            <div className="panel-header-row" style={{ marginTop: '14px' }}>
              <span className="panel-title font-bold">SIMULATION RUN PROVENANCE</span>
            </div>
            <div className="provenance-details-box mono">
              <div className="prov-item">
                <span>SIMULATOR ENGINE:</span>
                <strong>KYNTRA Forward Monte-Carlo Engine</strong>
              </div>
              <div className="prov-item">
                <span>BATCH RUN COUNT:</span>
                <strong className={runCount > 0 ? 'text-accent' : 'text-muted'}>RUNS: {runCount}</strong>
              </div>
              <div className="prov-item">
                <span>FIA CONSTRAINTS:</span>
                <strong>Articles C5.2.7 – C5.2.10</strong>
              </div>
              <div className="prov-item">
                <span>PROVENANCE CATEGORY:</span>
                <strong className="text-accent">FORECAST_SIMULATION</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== COLUMN 2: CENTER (SIMULATION RUNS OR UNAVAILABLE NOTICE) ==================== */}
        <div className="forecast-col forecast-col-center">
          <div className="panel-inner-card">
            <div className="panel-header-row">
              <div className="title-group">
                <span className="panel-title font-bold">
                  {isAvailable ? `OUTCOME DISTRIBUTIONS (${runCount} RUNS)` : 'SIMULATION OUTCOME DISTRIBUTIONS'}
                </span>
              </div>
              <span className="badge-runs mono">RUNS: {runCount}</span>
            </div>

            {isAvailable ? (
              <div className="distributions-grid">
                {/* Genuine outputs if executed */}
              </div>
            ) : (
              /* Honest Truth Gate Notice: No Fabricated Distributions */
              <div className="forecast-unavailable-box">
                <div className="unavail-icon">⚠</div>
                <h3 className="unavail-title font-bold">FORECAST NOT AVAILABLE</h3>
                <p className="unavail-text">
                  Forward Monte-Carlo simulation batch is uncalibrated on this session.
                  In accordance with KYNTRA Truth Gate requirements, hypothetical outcome distributions,
                  counter-pass probabilities, and battery depletion graphs are not fabricated.
                </p>
                <div className="unavail-metadata mono">
                  <div>SIMULATION BATCH: <strong>0 RUNS EXECUTED</strong></div>
                  <div>PROVENANCE: <strong className="text-accent">FORECAST_SIMULATION: UNAVAILABLE</strong></div>
                  <div>GOVERNANCE: <strong>EMPIRICAL CALIBRATION REQUIRED</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================== COLUMN 3: OUTCOME INSPECTOR / POLICY NOTICE ==================== */}
        <div className="forecast-col forecast-col-right">
          <div className="panel-inner-card">
            <div className="panel-header-row">
              <span className="panel-title font-bold">GOVERNANCE & POLICY SEPARATION</span>
              <span className="mono text-accent">TRUTH GATE</span>
            </div>

            <div className="scenario-detail-box">
              {/* Policy Separation Notice */}
              <div className="policy-notice-box mono">
                <span className="policy-badge font-bold">STRATEGIC RANKING: PENDING VERIFICATION</span>
                <p className="policy-text">
                  Forecasting is strictly decoupled from tactical recommendation. Even when forward simulations
                  are executed, KYNTRA computes empirical probability distributions without issuing prescriptive
                  orders until game-theoretic multi-agent policies are verified.
                </p>
              </div>

              <div className="provenance-rules-list mono">
                <div className="p-rule-item">
                  <span className="r-dot green" />
                  <span>Deterministic FIA Rule Check: <strong>OPERATIONAL</strong></span>
                </div>
                <div className="p-rule-item">
                  <span className="r-dot green" />
                  <span>Frozen LightGBM Overtake Model: <strong>VERIFIED</strong></span>
                </div>
                <div className="p-rule-item">
                  <span className="r-dot amber" />
                  <span>Regulation Energy Simulator: <strong>SIMULATED</strong></span>
                </div>
                <div className="p-rule-item">
                  <span className="r-dot gray" />
                  <span>Forward Scenario Simulation: <strong>UNAVAILABLE (RUNS: 0)</strong></span>
                </div>
                <div className="p-rule-item">
                  <span className="r-dot gray" />
                  <span>Multi-Horizon Strategy Ranking: <strong>PENDING</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
