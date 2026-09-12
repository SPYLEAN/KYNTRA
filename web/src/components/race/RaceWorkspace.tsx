import React, { useState } from 'react';
import type {
  ActiveBattleTracker,
  BattleWatchlistItem,
  CarState,
  DecisionSnapshot,
  EvidenceInspectionTarget,
  KyntraRuntimeSnapshot,
  TrackGeometry,
} from '../../types';
import { TimingTower } from './TimingTower';
import { BattleWatchlistPanel } from '../BattleWatchlistPanel';
import { DigitalTrackTwin } from '../DigitalTrackTwin';
import { KyntraCallPanel } from './KyntraCallPanel';
import { WhyWhyNotPanel } from './WhyWhyNotPanel';
import { PassWindowStrip } from './PassWindowStrip';
import { ProvenanceChip } from '../common/ProvenanceChip';

interface RaceWorkspaceProps {
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  decision: DecisionSnapshot | null;
  cars: Record<string, CarState>;
  geometry: TrackGeometry | null;
  watchlist: BattleWatchlistItem[];
  activeBattles: ActiveBattleTracker[];
  selectedBattleId?: string | null;
  decisionHistory?: any[];
  trackStatus?: string;
  circuitName?: string;
  isStale?: boolean;
  connectionStatus?: string;
  onSelectBattle: (battleId: string) => void;
  onSelectCar?: (driver: string) => void;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

export const RaceWorkspace: React.FC<RaceWorkspaceProps> = ({
  runtimeSnapshot,
  decision,
  cars,
  geometry,
  watchlist,
  activeBattles,
  selectedBattleId,
  decisionHistory = [],
  trackStatus = '1',
  circuitName = 'Monza',
  isStale = false,
  connectionStatus = 'CONNECTED',
  onSelectBattle,
  onSelectCar,
  onOpenEvidence,
}) => {
  const [bottomTab, setBottomTab] = useState<'GAP_TREND' | 'SPEED' | 'ENERGY' | 'TIMELINE'>('GAP_TREND');

  const publishedCall = runtimeSnapshot?.published_call || (decision?.published_call as any) || null;
  const candidateCall = runtimeSnapshot?.candidate_call || (decision?.recommendation as any) || null;
  const callLifecycle = runtimeSnapshot?.call_lifecycle || publishedCall?.lifecycle_state || 'WITHHELD';

  const attackerCode = decision?.race.attacker || (selectedBattleId ? selectedBattleId.split('-')[0] : null);
  const defenderCode = decision?.race.defender || (selectedBattleId ? selectedBattleId.split('-')[1] : null);
  const gapSeconds = decision?.battle.gap_seconds ?? null;
  const closingRate = decision?.battle.closing_rate ?? null;
  const distanceGapM = decision?.battle.distance_gap_m ?? (gapSeconds != null ? Math.round(gapSeconds * 65) : null);

  const overtake = decision?.overtake;
  const currentMatrix = runtimeSnapshot?.current_matrix;
  const p1 = overtake?.p_1_lap ?? currentMatrix?.actions?.['OVERTAKE']?.pass_context?.p_pass_1_lap ?? null;
  const p2 = overtake?.p_2_laps ?? currentMatrix?.actions?.['OVERTAKE']?.pass_context?.p_pass_2_laps ?? null;
  const p3 = overtake?.p_3_laps ?? currentMatrix?.actions?.['OVERTAKE']?.pass_context?.p_pass_3_laps ?? null;

  const energy = decision?.energy;
  const availEnergyMj = energy?.available_energy_mj ?? null;
  const ruleStatus = decision?.compliance?.status || 'ALLOWED';
  const stabilityVerdict = decision?.stability?.verdict || 'FAVORABLE';

  const whySelected = publishedCall?.why_selected || candidateCall?.why_selected || [];
  const whyNot = publishedCall?.why_not || candidateCall?.why_not || {};

  // Selected battle tracker object
  const currentTracker = activeBattles.find((b) => b.battle_id === selectedBattleId) || null;

  return (
    <div
      className={`race-permanent-layout ${isStale ? 'is-stale-workstation' : ''}`}
      data-connection-status={connectionStatus}
    >
      {/* =========================================================================
          COLUMN 1: LEFT (18%) — TIMING TOWER & BATTLE WATCHLIST
          ========================================================================= */}
      <aside className="race-col-left" aria-label="Timing and Watchlist Sector">
        {/* Upper Left: Timing Tower */}
        <div className="left-panel-timing">
          <div className="panel-header-strip">
            <span className="panel-title font-bold">TIMING TOWER</span>
            <ProvenanceChip type={isStale ? 'DEGRADED' : 'LIVE'} />
          </div>
          <div className="panel-content-scroll">
            <TimingTower
              cars={cars}
              attackerCode={attackerCode || undefined}
              defenderCode={defenderCode || undefined}
              selectedBattleId={selectedBattleId}
              onSelectCar={onSelectCar}
            />
          </div>
        </div>

        {/* Lower Left: Battle Watchlist */}
        <div className="left-panel-watchlist">
          <div className="panel-header-strip">
            <span className="panel-title font-bold">BATTLE WATCH</span>
            <span className="count-badge mono">{watchlist.length}</span>
          </div>
          <div className="panel-content-scroll">
            <BattleWatchlistPanel
              watchlist={watchlist}
              selectedBattleId={selectedBattleId}
              onSelectBattle={onSelectBattle}
            />
          </div>
        </div>
      </aside>

      {/* =========================================================================
          COLUMN 2: CENTER (50–55%) — DIGITAL TRACK TWIN & ANALYTICS STRIP
          ========================================================================= */}
      <main className="race-col-center" aria-label="Digital Track Twin & Analytics Sector">
        {/* Hero Digital Track Twin */}
        <div className="center-twin-hero">
          <div className="twin-overlay-header">
            <div className="twin-title-group">
              <span className="circuit-name font-bold">{circuitName.toUpperCase()} CIRCUIT</span>
              <span className="circuit-status mono text-accent">2D DIGITAL TWIN</span>
            </div>
            <div className="twin-meta-group mono">
              {attackerCode && defenderCode ? (
                <span className="battle-focus-pill">
                  TRACKING: <strong className="text-threat">{attackerCode}</strong> vs{' '}
                  <strong className="text-primary">{defenderCode}</strong>
                </span>
              ) : (
                <span className="battle-focus-pill text-muted">SELECT BATTLE TO FOCUS</span>
              )}
            </div>
          </div>

          <div className="twin-svg-canvas">
            <DigitalTrackTwin
              geometry={geometry}
              cars={cars}
              attackerCode={attackerCode}
              defenderCode={defenderCode}
              gapSeconds={gapSeconds}
              closingRate={closingRate}
              trackStatus={trackStatus}
              circuitName={circuitName}
              onSelectCar={onSelectCar}
              spatialGapMeters={distanceGapM}
            />
          </div>
        </div>

        {/* Bottom Analytics Strip */}
        <div className="center-bottom-analytics">
          <div className="analytics-tabs-header mono">
            <button
              type="button"
              className={`analytics-tab-btn ${bottomTab === 'GAP_TREND' ? 'active' : ''}`}
              onClick={() => setBottomTab('GAP_TREND')}
            >
              GAP TREND
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${bottomTab === 'SPEED' ? 'active' : ''}`}
              onClick={() => setBottomTab('SPEED')}
            >
              RELATIVE SPEED
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${bottomTab === 'ENERGY' ? 'active' : ''}`}
              onClick={() => setBottomTab('ENERGY')}
            >
              ENERGY FORECAST
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${bottomTab === 'TIMELINE' ? 'active' : ''}`}
              onClick={() => setBottomTab('TIMELINE')}
            >
              DECISION TIMELINE
            </button>
          </div>

          <div className="analytics-tab-viewport mono">
            {bottomTab === 'GAP_TREND' && (
              <div className="analytics-pane gap-pane">
                <div className="metric-quad">
                  <div className="quad-item">
                    <span className="q-lbl text-muted">TEMPORAL GAP</span>
                    <span className="q-val font-bold mono-num">
                      {gapSeconds != null ? `${gapSeconds.toFixed(2)}s` : '—'}
                    </span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">DISTANCE DELTA</span>
                    <span className="q-val font-bold mono-num">
                      {distanceGapM != null ? `${distanceGapM} m` : '—'}
                    </span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">CLOSING RATE</span>
                    <span className="q-val font-bold mono-num text-accent">
                      {closingRate != null ? `${closingRate > 0 ? '+' : ''}${closingRate.toFixed(2)} m/s` : '—'}
                    </span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">BATTLE CONTINUITY</span>
                    <span className="q-val font-bold mono-num">
                      {currentTracker?.laps_active != null ? `${currentTracker.laps_active} LAPS` : '1 LAP'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {bottomTab === 'SPEED' && (
              <div className="analytics-pane speed-pane">
                <div className="metric-quad">
                  <div className="quad-item">
                    <span className="q-lbl text-muted">ATTACKER SPEED</span>
                    <span className="q-val font-bold mono-num">
                      {attackerCode && cars[attackerCode]?.speed != null
                        ? `${cars[attackerCode].speed} km/h`
                        : '—'}
                    </span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">DEFENDER SPEED</span>
                    <span className="q-val font-bold mono-num">
                      {defenderCode && cars[defenderCode]?.speed != null
                        ? `${cars[defenderCode].speed} km/h`
                        : '—'}
                    </span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">SPEED DELTA</span>
                    <span className="q-val font-bold mono-num text-accent">
                      {decision?.battle.speed_delta != null
                        ? `${decision.battle.speed_delta > 0 ? '+' : ''}${decision.battle.speed_delta.toFixed(1)} km/h`
                        : '—'}
                    </span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">DRS ACTIVE</span>
                    <span className="q-val font-bold mono-num">
                      {attackerCode && cars[attackerCode]?.drs_active ? 'YES' : 'NO'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {bottomTab === 'ENERGY' && (
              <div className="analytics-pane energy-pane">
                <div className="metric-quad">
                  <div className="quad-item">
                    <span className="q-lbl text-muted">AVAILABLE ENERGY (MGU-K)</span>
                    <span className="q-val font-bold mono-num text-accent">
                      {availEnergyMj != null ? `${availEnergyMj.toFixed(2)} MJ` : '—'}
                    </span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">MGU-K DEPLOYMENT CAP</span>
                    <span className="q-val font-bold mono-num">4.00 MJ / LAP</span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">POWER LIMIT (2026 TR)</span>
                    <span className="q-val font-bold mono-num">350 kW</span>
                  </div>
                  <div className="quad-item">
                    <span className="q-lbl text-muted">PROVENANCE</span>
                    <span className="q-val font-bold text-muted">SIMULATED ENERGY</span>
                  </div>
                </div>
              </div>
            )}

            {bottomTab === 'TIMELINE' && (
              <div className="analytics-pane timeline-pane">
                <div className="timeline-strip-list">
                  {decisionHistory.length === 0 ? (
                    <div className="empty-text text-muted font-bold">INSUFFICIENT HISTORY</div>
                  ) : (
                    decisionHistory.slice(0, 5).map((d, i) => (
                      <div key={d.decision_id || i} className="timeline-micro-item">
                        <span className="micro-lap">L{d.lap || '—'}</span>
                        <span className="micro-act font-bold text-accent">
                          {d.published_action || d.published_call?.action || 'CALL'}
                        </span>
                        <span className="micro-id text-muted">[{d.decision_id?.slice(0, 8)}]</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* =========================================================================
          COLUMN 3: RIGHT (27–30%) — ACTIVE BATTLE, HORIZONS, RULES, CALL, WHY
          ========================================================================= */}
      <aside className="race-col-right" aria-label="Tactical Intelligence Sector">
        {/* Sector 1: Active / Tracked Battle Card */}
        <div className="right-panel-battle">
          <div className="panel-header-strip">
            <span className="panel-title font-bold">
              01. {watchlist.some((w) => w.battle_id === selectedBattleId) ? 'ACTIVE BATTLE' : 'TRACKED BATTLE'}
            </span>
            <ProvenanceChip
              type={
                watchlist.some((w) => w.battle_id === selectedBattleId)
                  ? (runtimeSnapshot?.mode === 'HISTORICAL_REPLAY' ? 'HISTORICAL OUTCOME' : 'LIVE')
                  : 'HISTORICAL OUTCOME'
              }
            />
          </div>
          <div
            className="battle-card-content clickable"
            onClick={() => {
              if (attackerCode && defenderCode) {
                onOpenEvidence({
                  title: `Tactical Battle State: ${attackerCode} vs ${defenderCode}`,
                  value: gapSeconds != null ? `${gapSeconds.toFixed(2)}s` : 'TRACKED',
                  status: 'INFO',
                  provenance: 'LIVE',
                  method: 'Live Timing Proximity Tracker',
                  evidenceItems: [
                    { label: 'Attacker Car', value: `${attackerCode} (P${cars[attackerCode]?.position || '—'})` },
                    { label: 'Defender Car', value: `${defenderCode} (P${cars[defenderCode]?.position || '—'})` },
                    { label: 'Interval Gap', value: gapSeconds != null ? `${gapSeconds.toFixed(2)}s` : 'N/A' },
                    { label: 'Closing Rate', value: closingRate != null ? `${closingRate > 0 ? '+' : ''}${closingRate.toFixed(1)} m/s` : 'N/A' },
                    { label: 'Distance Gap', value: distanceGapM != null ? `${distanceGapM} m` : 'N/A' },
                  ],
                });
              }
            }}
            title="Click to inspect battle kinematics evidence"
          >
            {attackerCode && defenderCode ? (
              <div className="battle-vs-row">
                <div className="fighter att-fighter">
                  <span className="role-tag text-threat font-bold">ATTACKER</span>
                  <span className="code font-bold text-threat mono-num">{attackerCode}</span>
                  <span className="pos text-muted mono-num">P{cars[attackerCode]?.position || '—'}</span>
                </div>
                <div className="vs-divider">
                  <span className="gap-text font-bold text-primary mono-num">
                    {gapSeconds != null ? `${gapSeconds.toFixed(2)}s` : '—'}
                  </span>
                  <span className="rate-text text-muted mono-num">
                    {closingRate != null ? `${closingRate > 0 ? '+' : ''}${closingRate.toFixed(1)} m/s` : ''}
                  </span>
                </div>
                <div className="fighter def-fighter">
                  <span className="role-tag text-target font-bold">DEFENDER</span>
                  <span className="code font-bold text-target mono-num">{defenderCode}</span>
                  <span className="pos text-muted mono-num">P{cars[defenderCode]?.position || '—'}</span>
                </div>
              </div>
            ) : (
              <div className="empty-selection text-muted">No battle selected. Select from watchlist.</div>
            )}
          </div>
        </div>

        {/* Sector 2: Overtake Horizon Strip (P1, P2, P3) */}
        <div className="right-panel-horizon">
          <div className="panel-header-strip">
            <span className="panel-title font-bold">02. OVERTAKE HORIZON</span>
            <ProvenanceChip type="FROZEN MODEL" />
          </div>
          <PassWindowStrip
            p1={p1}
            p2={p2}
            p3={p3}
            pavApplied={true}
            onOpenEvidence={onOpenEvidence}
          />
        </div>

        {/* Sector 3: 03. ENERGY CONSEQUENCE (Simulated Energy + Inline Rule & Stability Consequence) */}
        <div className="right-panel-energy">
          <div className="panel-header-strip">
            <span className="panel-title font-bold">03. ENERGY CONSEQUENCE</span>
            <ProvenanceChip type="SIMULATED ENERGY" />
          </div>
          <div
            className="energy-technical-card clickable"
            onClick={() =>
              onOpenEvidence({
                title: 'Simulated 2026 Energy State & Usable SoC Window',
                value: availEnergyMj != null ? `${availEnergyMj.toFixed(2)} MJ` : '—',
                status: 'SIMULATED',
                provenance: 'SIMULATED ENERGY',
                method: 'FIA 2026 Technical Regulations Straightline Power Taper Model (290-345 km/h)',
                version: 'FIA_TR_ISSUE_20_2026',
                evidenceItems: [
                  { label: 'Energy State', value: 'SIMULATED — REGULATION CONSTRAINED' },
                  { label: 'Usable SoC Window', value: availEnergyMj != null ? `${availEnergyMj.toFixed(2)} MJ` : 'UNAVAILABLE' },
                  { label: 'Lap Deployment Cap', value: '4.00 MJ (Regulation Cap)' },
                  { label: 'MGU-K Power Limit', value: '350 kW' },
                  { label: 'Rule Eligibility', value: ruleStatus === 'LEGAL' ? 'ALLOWED' : ruleStatus || 'UNKNOWN' },
                  { label: 'Stability V1', value: stabilityVerdict },
                ],
              })
            }
            title="Click to inspect simulated energy state & regulation evidence"
          >
            <div className="energy-stat-row">
              <div className="stat-col">
                <span className="stat-lbl text-muted">USABLE SOC WINDOW</span>
                <div className="stat-num-line">
                  <span className="stat-num mono-num font-bold text-primary">
                    {availEnergyMj != null ? `${availEnergyMj.toFixed(2)} MJ` : '—'}
                  </span>
                  <span className="stat-sub text-muted mono-num">/ 4.00 MJ REGULATION WINDOW</span>
                </div>
              </div>
              <div className="stat-col text-right">
                <span className="stat-lbl text-muted">MGU-K LIMIT</span>
                <span className="stat-num mono-num font-bold text-secondary">350 kW</span>
                <span className="stat-sub text-muted">2026 TR</span>
              </div>
            </div>

            {/* Inline Regulatory & Stability Summary */}
            <div className="dual-status-grid energy-inline-rules" style={{ marginTop: '8px', marginBottom: '8px' }}>
              <div
                className="status-summary-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEvidence({
                    title: 'FIA Sporting & Technical Regulations Compliance',
                    value: ruleStatus === 'LEGAL' ? 'ALLOWED' : ruleStatus || 'UNKNOWN',
                    status: ruleStatus === 'ALLOWED' || ruleStatus === 'LEGAL' ? 'VALID' : ruleStatus === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCKED',
                    provenance: 'RULE CHECK',
                    method: 'Deterministic FIA 2026 Code C5.2.7 Check',
                  });
                }}
                title="Click to inspect regulatory evidence"
              >
                <span className="item-label text-muted">RULE ELIGIBILITY</span>
                <span
                  className={`item-status-val font-bold ${
                    ruleStatus === 'ALLOWED' || ruleStatus === 'LEGAL'
                      ? 'text-valid'
                      : ruleStatus === 'UNKNOWN'
                      ? 'text-neutral'
                      : 'text-blocked'
                  }`}
                >
                  {ruleStatus === 'LEGAL' ? 'ALLOWED' : ruleStatus || 'UNKNOWN'}
                </span>
              </div>

              <div
                className="status-summary-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEvidence({
                    title: 'Stability V1 Post-Pass Degradation Verdict',
                    value: stabilityVerdict,
                    status: stabilityVerdict === 'FAVORABLE' ? 'VALID' : stabilityVerdict === 'UNKNOWN' ? 'UNKNOWN' : 'CAUTION',
                    provenance: 'ORDINAL STABILITY',
                    method: 'Rank Conservation Metric',
                  });
                }}
                title="Click to inspect stability evidence"
              >
                <span className="item-label text-muted">STABILITY V1</span>
                <span
                  className={`item-status-val font-bold ${
                    stabilityVerdict === 'FAVORABLE'
                      ? 'text-valid'
                      : stabilityVerdict === 'UNKNOWN'
                      ? 'text-neutral'
                      : 'text-caution'
                  }`}
                >
                  {stabilityVerdict}
                </span>
              </div>
            </div>

            <div className="energy-context-footer">
              <span className="ctx-scenario text-secondary">
                SCENARIO: <strong className="text-primary">Nominal 2026 TR</strong>
              </span>
              <span className="ctx-disclaimer text-muted">
                SIMULATED — REGULATION CONSTRAINED
              </span>
            </div>
          </div>
        </div>

        {/* Sector 5: KYNTRA Call Hero Banner */}
        <div className="right-panel-call">
          <KyntraCallPanel
            publishedCall={publishedCall}
            callLifecycle={callLifecycle}
            candidateCall={candidateCall}
            decisionSnapshotId={runtimeSnapshot?.decision_snapshot_id}
            onOpenEvidence={onOpenEvidence}
          />
        </div>

        {/* Sector 6: Deterministic Why / Why Not */}
        <div className="right-panel-whynot">
          <WhyWhyNotPanel
            whySelected={whySelected}
            whyNot={whyNot}
            ruleStatus={ruleStatus}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      </aside>
    </div>
  );
};
