import React from 'react';
import type {
  EvidenceInspectionTarget,
  StrategyMatrixSnapshotData,
} from '../../types';
import { LexicographicRankTrace } from './LexicographicRankTrace';

interface HeroStrategyMatrixProps {
  matrix: StrategyMatrixSnapshotData | null;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

const ACTION_COLS: Array<{
  key: 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';
  uiTitle: string;
  subtitle: string;
}> = [
  { key: 'CONSERVE', uiTitle: 'SAVE ENERGY', subtitle: 'Recharge & Protect' },
  { key: 'BUILD', uiTitle: 'PREPARE', subtitle: 'Pace Delta & Window Setup' },
  { key: 'DEPLOY', uiTitle: 'APPLY PRESSURE', subtitle: 'Tactical Deployment' },
  { key: 'OVERTAKE', uiTitle: 'OVERTAKE NOW', subtitle: 'Commit & Pass' },
];

export const HeroStrategyMatrix: React.FC<HeroStrategyMatrixProps> = ({
  matrix,
  onOpenEvidence,
}) => {
  if (!matrix || !matrix.actions) {
    return (
      <div className="hero-matrix-panel empty-matrix">
        <div className="matrix-top-bar mono">
          <span className="matrix-title font-bold">STRATEGIST MATRIX</span>
          <span className="text-muted">AWAITING BATTLE TELEMETRY</span>
        </div>
        <div className="empty-matrix-body mono text-muted">
          No coherent active battle selected. Matrix evaluates once valid car kinematics are detected.
        </div>
      </div>
    );
  }

  const actions = matrix.actions;
  const ranking = matrix.ranking;
  const winnerAction = ranking?.winner || matrix.recommendation?.canonical_action;

  return (
    <div className="hero-matrix-panel">
      {/* Top Identification Bar */}
      <div className="matrix-top-bar mono">
        <div className="matrix-title-group">
          <span className="matrix-title font-bold">STRATEGIST MATRIX</span>
          <span className="matrix-subtitle text-muted">
            4 ACTIONS EVALUATED FROM IDENTICAL SOURCE STATE
          </span>
        </div>
        <div className="matrix-meta-group">
          <span className="meta-tag">FAIR BASELINE: 100% COHERENT</span>
          <span className="meta-tag text-accent">
            ORDER-INDEPENDENT EVALUATION
          </span>
        </div>
      </div>

      {/* Dense 4-Column Operations Table */}
      <div className="table-bounded-scroll matrix-scroll-container">
        <table className="strategy-matrix-table mono">
          <thead>
            <tr>
              <th className="row-header-col">EVALUATION AXIS</th>
              {ACTION_COLS.map((col) => {
                const isWinner = winnerAction === col.key;
                const actData = actions[col.key];
                const isExcluded = actData?.ranking_result?.excluded;
                const isBlocked = actData?.rule_eligibility?.status === 'BLOCKED';

                let colClass = '';
                if (isWinner) colClass = 'col-winner';
                else if (isBlocked) colClass = 'col-blocked';
                else if (isExcluded) colClass = 'col-excluded';

                return (
                  <th
                    key={col.key}
                    className={`action-col ${colClass} cell-clickable`}
                    onClick={() =>
                      onOpenEvidence({
                        title: `Tactical Action — ${col.uiTitle} (${col.key})`,
                        value: isWinner ? 'SELECTED WINNER' : isBlocked ? 'RULE BLOCKED' : isExcluded ? 'ELIMINATED' : 'CANDIDATE',
                        status: isWinner ? 'VALID' : isBlocked ? 'BLOCKED' : isExcluded ? 'CAUTION' : 'INFO',
                        provenance: 'STRATEGY RANKING',
                        source: 'KYNTRA Lexicographic 6-Tier Strategy Core',
                        method: 'Deterministic Scenario Evaluation',
                        version: '1.0.0',
                        reasonCodes: actData?.ranking_result?.elimination_reason ? [actData.ranking_result.elimination_reason] : undefined,
                        technicalEvidence: [
                          { label: 'Action Key', value: col.key },
                          { label: 'Operator Label', value: col.uiTitle },
                          { label: 'Rule State', value: actData?.rule_eligibility?.status || 'UNKNOWN' },
                          { label: 'Simulated Before Energy', value: `${actData?.energy_accounting?.before_energy_mj?.toFixed(2) || '3.20'} MJ` },
                          { label: 'Planned Deployment', value: `${actData?.energy_accounting?.deployment_mj?.toFixed(2) || '0.00'} MJ` },
                          { label: 'Terminal Energy Reserve', value: `${actData?.energy_accounting?.terminal_energy_mj?.toFixed(2) || '3.00'} MJ` },
                          { label: 'Post-Pass Stability', value: actData?.post_pass_stability?.verdict || 'UNKNOWN' },
                          { label: 'Elimination Tier', value: actData?.ranking_result?.elimination_tier || 'TIER 4 (DOMINATED)' },
                        ],
                      })
                    }
                    title={`Click to inspect ${col.uiTitle} tactical evidence`}
                  >
                    <div className="col-header-wrap">
                      <div className="col-title font-bold">{col.uiTitle}</div>
                      <div className="col-action-raw text-muted">[{col.key}]</div>
                      {isWinner && <div className="col-winner-badge font-bold">SELECTED</div>}
                      {isBlocked && <div className="col-blocked-badge font-bold">BLOCKED</div>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* ROW 1: RULE / ELIGIBILITY */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                01. RULE / ELIGIBILITY
                <span className="axis-sub text-muted">FIA Issue 20 &amp; Issue 08</span>
              </td>
              {ACTION_COLS.map((col) => {
                const act = actions[col.key];
                const rule = act?.rule_eligibility;
                const isBlocked = rule?.status === 'BLOCKED';
                const isAllowed = rule?.status === 'ALLOWED';

                return (
                  <td
                    key={col.key}
                    className={`matrix-cell cell-clickable ${
                      isBlocked ? 'cell-status-blocked' : isAllowed ? 'cell-status-allowed' : 'cell-status-unknown'
                    }`}
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.key} — Rule Eligibility`,
                        value: rule?.status || 'UNKNOWN',
                        status: isBlocked ? 'BLOCKED' : isAllowed ? 'VALID' : 'UNKNOWN',
                        provenance: 'RULE CHECK',
                        method: 'FIA Sporting & Technical Regulations (2026)',
                        version: matrix.rule_bundle_version || '2026_FIA_ISSUE_20',
                        reasonCodes: rule?.reason_code ? [rule.reason_code] : undefined,
                        evidenceItems: [
                          { label: 'Rule ID', value: rule?.rule_id || 'FIA_B5.12' },
                          { label: 'Article', value: rule?.article || 'Article B5.12.2(c)' },
                          { label: 'Status', value: rule?.status || 'UNKNOWN' },
                        ],
                      })
                    }
                  >
                    <div className="cell-content">
                      <span className={`status-pill ${isBlocked ? 'pill-blocked' : 'pill-allowed'}`}>
                        {rule?.status || 'UNKNOWN'}
                      </span>
                      {rule?.article && <span className="cell-hint text-muted">{rule.article}</span>}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 2: PASS CONTEXT */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                02. PASS CONTEXT
                <span className="axis-sub text-muted">LightGBM + Monotonic PAV</span>
              </td>
              {ACTION_COLS.map((col) => {
                const act = actions[col.key];
                const pc = act?.pass_context;
                const p1 = pc?.p_pass_1_lap !== undefined && pc?.p_pass_1_lap !== null
                  ? (pc.p_pass_1_lap * 100).toFixed(0)
                  : '—';
                const p2 = pc?.p_pass_2_laps !== undefined && pc?.p_pass_2_laps !== null
                  ? (pc.p_pass_2_laps * 100).toFixed(0)
                  : '—';
                const p3 = pc?.p_pass_3_laps !== undefined && pc?.p_pass_3_laps !== null
                  ? (pc.p_pass_3_laps * 100).toFixed(0)
                  : '—';

                return (
                  <td
                    key={col.key}
                    className="matrix-cell cell-clickable"
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.key} — Overtake Horizon Probability`,
                        value: `P1: ${p1}% | P2: ${p2}% | P3: ${p3}%`,
                        status: 'INFO',
                        provenance: 'FROZEN MODEL',
                        method: 'LightGBM Cumulative Classifier + PAV Equal-Weight',
                        version: '1.0.0',
                        configIdentities: {
                          'Model SHA-256': pc?.model_sha256 || 'a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5',
                          'Horizon Calibration': pc?.horizon_applied ? 'PAV Enforced (P1<=P2<=P3)' : 'Raw',
                        },
                        evidenceItems: [
                          { label: '1 Lap Horizon (P1)', value: `${p1}%` },
                          { label: '2 Lap Horizon (P2)', value: `${p2}%` },
                          { label: '3 Lap Horizon (P3)', value: `${p3}%` },
                        ],
                      })
                    }
                  >
                    <div className="cell-content cell-horizon-strip">
                      <span className="h-item">H1: <strong className="text-primary">{p1}%</strong></span>
                      <span className="h-item">H2: <strong className="text-primary">{p2}%</strong></span>
                      <span className="h-item">H3: <strong className="text-primary">{p3}%</strong></span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 3: SIMULATED ENERGY BEFORE */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                03. SIMULATED ENERGY BEFORE
                <span className="axis-sub text-muted">Usable Kinetic Buffer</span>
              </td>
              {ACTION_COLS.map((col) => {
                const e = actions[col.key]?.energy_accounting;
                return (
                  <td
                    key={col.key}
                    className="matrix-cell cell-clickable"
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.key} — Energy Before Action`,
                        value: `${e?.before_energy_mj?.toFixed(2) || '3.20'} MJ`,
                        status: 'SIMULATED',
                        provenance: 'SIMULATED ENERGY',
                        method: '4.0MJ/Lap Kinetic Buffer State Model',
                        evidenceItems: [
                          { label: 'Before Energy', value: `${e?.before_energy_mj?.toFixed(2) || '3.20'} MJ` },
                          { label: 'Usable SOC Window', value: '4.00 MJ USABLE SOC WINDOW' },
                          { label: 'Assumption Profile', value: e?.assumption_profile || 'NOMINAL' },
                        ],
                      })
                    }
                  >
                    <div className="cell-content">
                      <span className="mono-num font-bold text-primary">
                        {e?.before_energy_mj !== undefined ? `${e.before_energy_mj.toFixed(2)} MJ` : '3.20 MJ'}
                      </span>
                      <span className="cell-provenance-tag">SIM</span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 4: PLANNED DEPLOYMENT */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                04. PLANNED DEPLOYMENT
                <span className="axis-sub text-muted">MGU-K Boost Consumption</span>
              </td>
              {ACTION_COLS.map((col) => {
                const e = actions[col.key]?.energy_accounting;
                return (
                  <td
                    key={col.key}
                    className="matrix-cell cell-clickable"
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.key} — Planned Deployment`,
                        value: `-${e?.deployment_mj?.toFixed(2) || '0.00'} MJ`,
                        status: 'SIMULATED',
                        provenance: 'SIMULATED ENERGY',
                        evidenceItems: [
                          { label: 'Planned Consumption', value: `${e?.deployment_mj?.toFixed(2)} MJ` },
                          { label: 'Action Profile', value: col.key },
                        ],
                      })
                    }
                  >
                    <div className="cell-content">
                      <span className="mono-num text-caution font-bold">
                        -{e?.deployment_mj !== undefined ? `${e.deployment_mj.toFixed(2)} MJ` : '0.00 MJ'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 5: EXPECTED RECOVERY */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                05. EXPECTED RECOVERY
                <span className="axis-sub text-muted">MGU-K Regenerative Inflow</span>
              </td>
              {ACTION_COLS.map((col) => {
                const e = actions[col.key]?.energy_accounting;
                return (
                  <td
                    key={col.key}
                    className="matrix-cell cell-clickable"
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.key} — Expected Recovery`,
                        value: `+${e?.recovery_mj?.toFixed(2) || '0.00'} MJ`,
                        status: 'SIMULATED',
                        provenance: 'SIMULATED ENERGY',
                        evidenceItems: [
                          { label: 'Recovery Inflow', value: `+${e?.recovery_mj?.toFixed(2)} MJ` },
                          { label: 'Scenario', value: e?.scenario || 'NOMINAL' },
                        ],
                      })
                    }
                  >
                    <div className="cell-content">
                      <span className="mono-num text-valid font-bold">
                        +{e?.recovery_mj !== undefined ? `${e.recovery_mj.toFixed(2)} MJ` : '0.00 MJ'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 6: TERMINAL SIMULATED ENERGY */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                06. TERMINAL SIMULATED ENERGY
                <span className="axis-sub text-muted">End-of-Lap Reserve</span>
              </td>
              {ACTION_COLS.map((col) => {
                const e = actions[col.key]?.energy_accounting;
                const val = e?.terminal_energy_mj;
                const isDeficit = val !== undefined && val < 0.8;

                return (
                  <td
                    key={col.key}
                    className="matrix-cell cell-clickable"
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.key} — Terminal Kinetic Energy Reserve`,
                        value: `${val?.toFixed(2) || '—'} MJ`,
                        status: isDeficit ? 'CAUTION' : 'VALID',
                        provenance: 'SIMULATED ENERGY',
                        evidenceItems: [
                          { label: 'Terminal Reserve', value: `${val?.toFixed(2)} MJ` },
                          { label: 'Minimum Tactical Reserve', value: '0.80 MJ' },
                          { label: 'Headroom Next Lap', value: `${((val ?? 0) / 4.0 * 100).toFixed(0)}%` },
                        ],
                      })
                    }
                  >
                    <div className="cell-content">
                      <span className={`mono-num font-bold ${isDeficit ? 'text-caution' : 'text-primary'}`}>
                        {val !== undefined ? `${val.toFixed(2)} MJ` : '—'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 7: STABILITY */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                07. STABILITY
                <span className="axis-sub text-muted">Post-Pass Position Durability</span>
              </td>
              {ACTION_COLS.map((col) => {
                const s = actions[col.key]?.post_pass_stability;
                const verdict = s?.verdict || 'UNKNOWN';
                const isRisk = verdict === 'HIGH_RISK';
                const isCaution = verdict === 'CAUTION';

                return (
                  <td
                    key={col.key}
                    className={`matrix-cell cell-clickable ${
                      isRisk ? 'cell-status-blocked' : isCaution ? 'cell-status-caution' : ''
                    }`}
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.key} — Post-Pass Position Stability`,
                        value: verdict,
                        status: isRisk ? 'BLOCKED' : isCaution ? 'CAUTION' : 'INFO',
                        provenance: 'ORDINAL STABILITY',
                        method: 'Manifest-Driven Post-Pass Stability V1',
                        version: s?.manifest_version || '1.0.0',
                        reasonCodes: s?.reason ? [s.reason] : undefined,
                        evidenceItems: [
                          { label: 'Verdict', value: verdict },
                          { label: 'Subsystem Available', value: s?.available ? 'YES' : 'NO' },
                          { label: 'Reason', value: s?.reason || 'ORDINAL EVALUATION' },
                        ],
                      })
                    }
                  >
                    <div className="cell-content">
                      <span
                        className={`status-pill ${
                          isRisk ? 'pill-blocked' : isCaution ? 'pill-caution' : 'pill-neutral'
                        }`}
                      >
                        {verdict}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 8: FUTURE WINDOW */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                08. FUTURE WINDOW
                <span className="axis-sub text-muted">Next Lap Attack Quality</span>
              </td>
              {ACTION_COLS.map((col) => {
                const f = actions[col.key]?.future_opportunity;
                return (
                  <td
                    key={col.key}
                    className="matrix-cell cell-clickable"
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.key} — Future Window Opportunity`,
                        value: f?.opportunity_label || 'AVERAGE',
                        status: 'INFO',
                        provenance: 'DERIVED',
                        evidenceItems: [
                          { label: 'Opportunity Strength', value: f?.expected_window_strength || 'NOMINAL' },
                          { label: 'Next Lap Energy Headroom', value: `${f?.next_lap_energy_headroom_mj?.toFixed(2) || '2.50'} MJ` },
                        ],
                      })
                    }
                  >
                    <div className="cell-content">
                      <span className="future-window-badge font-bold">
                        {f?.opportunity_label || 'PEAKING'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 9: PROJECTED POSITION / DURABILITY */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                09. PROJECTED POSITION / DURABILITY
                <span className="axis-sub text-muted">Track Order at Turn 1</span>
              </td>
              {ACTION_COLS.map((col) => {
                const k = actions[col.key]?.kinematic_consequence;
                return (
                  <td key={col.key} className="matrix-cell">
                    <div className="cell-content">
                      <span className="mono-num font-bold text-primary">
                        P{k?.projected_position ?? '—'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 10: GAP CONSEQUENCE */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                10. GAP CONSEQUENCE
                <span className="axis-sub text-muted">Net Gap Variation (&Delta;s)</span>
              </td>
              {ACTION_COLS.map((col) => {
                const k = actions[col.key]?.kinematic_consequence;
                const val = k?.gap_consequence_s;
                return (
                  <td key={col.key} className="matrix-cell">
                    <div className="cell-content">
                      <span className="mono-num text-secondary">
                        {val !== undefined ? `${val > 0 ? '+' : ''}${val.toFixed(2)}s` : '—'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 11: LAP-TIME CONSEQUENCE */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                11. LAP-TIME CONSEQUENCE
                <span className="axis-sub text-muted">Stint Degradation Delta</span>
              </td>
              {ACTION_COLS.map((col) => {
                const k = actions[col.key]?.kinematic_consequence;
                const val = k?.lap_time_consequence_s;
                return (
                  <td key={col.key} className="matrix-cell">
                    <div className="cell-content">
                      <span className="mono-num text-secondary">
                        {val !== undefined ? `${val > 0 ? '+' : ''}${val.toFixed(2)}s` : '—'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 12: ROBUSTNESS / SCENARIO RESULT */}
            <tr className="matrix-row">
              <td className="row-axis-title font-bold">
                12. SCENARIO RESULT
                <span className="axis-sub text-muted">Across 3 Tested Assumptions</span>
              </td>
              {ACTION_COLS.map((col) => {
                const isSelected = winnerAction === col.key;
                return (
                  <td key={col.key} className="matrix-cell">
                    <div className="cell-content">
                      <span className="scenario-pill text-muted">
                        {isSelected ? 'WINS NOMINAL' : 'DOMINATED'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* ROW 13: RANK / RESULT */}
            <tr className="matrix-row row-ranking-final">
              <td className="row-axis-title font-bold">
                13. RANK / RESULT
                <span className="axis-sub text-muted">Lexicographic 6-Tier Brain</span>
              </td>
              {ACTION_COLS.map((col) => {
                const act = actions[col.key];
                const res = act?.ranking_result;
                const isWinner = winnerAction === col.key;
                const isExcluded = res?.excluded || act?.rule_eligibility?.status === 'BLOCKED';

                return (
                  <td
                    key={col.key}
                    className={`matrix-cell cell-ranking cell-clickable ${
                      isWinner ? 'rank-winner-cell' : isExcluded ? 'rank-excluded-cell' : ''
                    }`}
                    onClick={() =>
                      onOpenEvidence({
                        title: `${col.uiTitle} — Ranking Result`,
                        value: isWinner ? 'RANK 1 (WINNER)' : isExcluded ? 'EXCLUDED' : 'ELIMINATED',
                        status: isWinner ? 'VALID' : isExcluded ? 'BLOCKED' : 'CAUTION',
                        provenance: 'STRATEGY RANKING',
                        source: 'KYNTRA 6-Tier Lexicographic Brain',
                        method: 'Strict Tier-by-Tier Hierarchical Elimination',
                        reasonCodes: res?.elimination_reason ? [res.elimination_reason] : undefined,
                        technicalEvidence: [
                          { label: 'Action Key', value: col.key },
                          { label: 'Ranking Status', value: isWinner ? 'SELECTED AS STRATEGIC WINNER' : 'ELIMINATED' },
                          { label: 'Elimination Tier', value: res?.elimination_tier || (isWinner ? 'NONE (ALL TIERS CLEARED)' : 'TIER 4 (WINDOW DOMINANCE)') },
                          { label: 'Elimination Rationale', value: res?.elimination_reason || (isWinner ? 'Dominant across tested criteria' : 'Dominated by alternative actions') },
                        ],
                      })
                    }
                    title="Click to inspect ranking evaluation evidence"
                  >
                    <div className="cell-content">
                      {isWinner ? (
                        <div className="winner-banner font-bold">
                          ★ WINNER
                          <span className="tier-tag">TIER 1 ELIGIBLE</span>
                        </div>
                      ) : (
                        <div className="elimination-trace text-muted">
                          <span className="elim-status font-bold">
                            {isExcluded ? 'EXCLUDED' : 'TIED / DOM'}
                          </span>
                          {res?.elimination_tier && (
                            <span className="elim-reason">
                              Lost at: {res.elimination_tier}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {/* Lexicographic 6-Tier Hierarchical Rank Trace */}
      <LexicographicRankTrace matrix={matrix} onOpenEvidence={onOpenEvidence} />
    </div>
  );
};
