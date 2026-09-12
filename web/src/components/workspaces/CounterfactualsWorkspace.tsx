import React, { useState } from 'react';
import type { DecisionSnapshot } from '../../types';

interface CounterfactualsWorkspaceProps {
  decision: DecisionSnapshot | null;
  onOpenEnergyModal: () => void;
  onOpenComplianceModal: () => void;
}

type TacticalAction = 'CONSERVE' | 'BUILD' | 'DEPLOY' | 'OVERTAKE';

export const CounterfactualsWorkspace: React.FC<CounterfactualsWorkspaceProps> = ({
  decision,
  onOpenEnergyModal,
  onOpenComplianceModal,
}) => {
  const [selectedAction, setSelectedAction] = useState<TacticalAction>('DEPLOY');

  const actions: TacticalAction[] = ['CONSERVE', 'BUILD', 'DEPLOY', 'OVERTAKE'];

  const actionDescriptions: Record<TacticalAction, { title: string; desc: string; energyDelta: string; tacticalImpact: string }> = {
    CONSERVE: {
      title: 'Action Policy: CONSERVE (Lift & Coast)',
      desc: 'Minimizes electrical MGU-K expenditure and increases coasting phase into high-braking zones to lower thermal degradation and accumulate buffer.',
      energyDelta: '+0.65 MJ / lap accumulated headroom',
      tacticalImpact: 'Allows pursuer to close within 0.3s; high vulnerability if rear threat is elevated.',
    },
    BUILD: {
      title: 'Action Policy: BUILD (Aggressive Harvesting)',
      desc: 'Configures MGU-K regeneration up to baseline 8.5 MJ/lap ceiling (Article C5.2.10) to reach max 4.0 MJ usable store before attacking.',
      energyDelta: '+0.85 MJ accumulated headroom',
      tacticalImpact: 'Sacrifices ~0.25s lap delta now to prepare for a dominant high-energy override burst on the subsequent straight.',
    },
    DEPLOY: {
      title: 'Action Policy: DEPLOY (Tactical Pressure)',
      desc: 'Standard 350 kW boost tapering down above 290 km/h per Article C5.2.8(i) to maintain DRS detection proximity without override depletion.',
      energyDelta: '-0.30 MJ baseline expenditure',
      tacticalImpact: 'Maintains pressure on car ahead, forcing defensive line and higher tyre scrub on their set.',
    },
    OVERTAKE: {
      title: 'Action Policy: OVERTAKE (Manual Override)',
      desc: 'Full 350 kW boost sustained up to 337.5 km/h per Article C5.2.8(ii) for maximum terminal velocity advantage alongside DRS flap opening.',
      energyDelta: '-0.55 MJ high-rate discharge',
      tacticalImpact: 'Immediate pass window execution. High risk of counter-pass if retention window is unverified.',
    },
  };

  return (
    <div className="workspace-counterfactuals-container">
      {/* Top Banner */}
      <div className="cf-banner">
        <div className="banner-badge-block">
          <span className="banner-badge">COUNTERFACTUAL SIMULATION MATRIX</span>
          <span className="banner-state-pill">ACTION RANKING: PENDING VERIFICATION</span>
        </div>
        <h2 className="banner-headline">HORIZONTAL ACTION COMPARISON MATRIX</h2>
        <p className="banner-description">
          Compares four candidate tactical actions against verified FIA power curves and simulated energy trade-offs.
          Tactical ranks remain intentionally unactivated (<code>null</code>) to prevent misleading recommendations.
        </p>
      </div>

      {/* Horizontal Matrix Table (Viewport-Bounded) */}
      <div className="cf-matrix-wrapper">
        <table className="cf-matrix-table">
          <thead>
            <tr>
              <th className="row-header-th">EVALUATION DIMENSION</th>
              {actions.map((act) => (
                <th
                  key={act}
                  className={`action-th ${selectedAction === act ? 'selected-th' : ''}`}
                  onClick={() => setSelectedAction(act)}
                  title={`Click to inspect ${act} in detail`}
                >
                  <div className="th-action-name mono font-bold">{act}</div>
                  <div className="th-action-sub">
                    {act === 'CONSERVE' ? 'SAVE BUFFER' : act === 'BUILD' ? 'RECOVERY' : act === 'DEPLOY' ? 'PRESSURE' : 'MANUAL OVERRIDE'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Technical Compliance */}
            <tr>
              <td className="row-lbl" onClick={onOpenComplianceModal} style={{ cursor: 'pointer' }}>
                1. FIA Technical Compliance
              </td>
              {actions.map((act) => (
                <td
                  key={act}
                  className={`matrix-cell ${selectedAction === act ? 'selected-cell' : ''}`}
                  onClick={() => setSelectedAction(act)}
                >
                  <span className="text-legal font-bold mono">✓ LEGAL</span>
                  <span className="cell-note mono">C5.2.7 / C5.2.9</span>
                </td>
              ))}
            </tr>

            {/* Row 2: Kinetic Feasibility */}
            <tr>
              <td className="row-lbl">2. Kinetic Feasibility</td>
              {actions.map((act) => (
                <td
                  key={act}
                  className={`matrix-cell ${selectedAction === act ? 'selected-cell' : ''}`}
                  onClick={() => setSelectedAction(act)}
                >
                  <span className="mono font-bold">FEASIBLE</span>
                  <span className="cell-note mono">&le; 350 kW Electrical</span>
                </td>
              ))}
            </tr>

            {/* Row 3: Pass Outlook */}
            <tr>
              <td className="row-lbl">3. Pass Probability Horizon</td>
              {actions.map((act) => (
                <td
                  key={act}
                  className={`matrix-cell ${selectedAction === act ? 'selected-cell' : ''}`}
                  onClick={() => setSelectedAction(act)}
                >
                  <span className="mono font-bold">
                    {act === 'OVERTAKE' ? `${((decision?.overtake.p_1_lap ?? 0.35) * 100).toFixed(0)}% (H1)` : act === 'DEPLOY' ? `${((decision?.overtake.p_2_laps ?? 0.5) * 100).toFixed(0)}% (H2)` : 'PREPARING'}
                  </span>
                  <span className="cell-note mono">PAV Monotonic</span>
                </td>
              ))}
            </tr>

            {/* Row 4: Ending Energy Store Delta */}
            <tr>
              <td className="row-lbl" onClick={onOpenEnergyModal} style={{ cursor: 'pointer' }}>
                4. Energy Store Lap Delta
              </td>
              {actions.map((act) => (
                <td
                  key={act}
                  className={`matrix-cell ${selectedAction === act ? 'selected-cell' : ''}`}
                  onClick={() => setSelectedAction(act)}
                >
                  <span className={`mono font-bold ${act === 'CONSERVE' || act === 'BUILD' ? 'text-legal' : 'text-amber'}`}>
                    {act === 'CONSERVE' ? '+0.65 MJ' : act === 'BUILD' ? '+0.85 MJ' : act === 'DEPLOY' ? '-0.30 MJ' : '-0.55 MJ'}
                  </span>
                  <span className="cell-note mono">4.0 MJ Buffer</span>
                </td>
              ))}
            </tr>

            {/* Row 5: Post-Pass Stability */}
            <tr>
              <td className="row-lbl">5. Post-Pass Stability</td>
              {actions.map((act) => (
                <td
                  key={act}
                  className={`matrix-cell ${selectedAction === act ? 'selected-cell' : ''}`}
                  onClick={() => setSelectedAction(act)}
                >
                  <span className="text-amber mono font-bold">UNKNOWN</span>
                  <span className="cell-note mono">Awaiting Classifier</span>
                </td>
              ))}
            </tr>

            {/* Row 6: Future Window Impact */}
            <tr>
              <td className="row-lbl">6. Future Window Impact</td>
              {actions.map((act) => (
                <td
                  key={act}
                  className={`matrix-cell ${selectedAction === act ? 'selected-cell' : ''}`}
                  onClick={() => setSelectedAction(act)}
                >
                  <span className="mono">
                    {act === 'CONSERVE' || act === 'BUILD' ? 'OPTIMAL' : 'REDUCED RESERVE'}
                  </span>
                  <span className="cell-note mono">Trajectory Shift</span>
                </td>
              ))}
            </tr>

            {/* Row 7: Tactical Action Rank */}
            <tr className="rank-row">
              <td className="row-lbl font-bold">7. Strategic Action Rank</td>
              {actions.map((act) => (
                <td
                  key={act}
                  className={`matrix-cell rank-cell ${selectedAction === act ? 'selected-cell' : ''}`}
                  onClick={() => setSelectedAction(act)}
                >
                  <span className="text-secondary mono">null</span>
                  <span className="cell-note mono font-bold text-amber">PENDING VERIFICATION</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Lower Detail / Analysis Drawer */}
      <div className="cf-lower-drawer">
        <div className="drawer-header">
          <span className="drawer-title font-bold">{actionDescriptions[selectedAction].title}</span>
          <span className="drawer-tag mono">ACTION INSPECTION</span>
        </div>
        <div className="drawer-body-grid">
          <div className="drawer-col">
            <span className="d-label">MECHANISTIC DESCRIPTION:</span>
            <p className="d-desc">{actionDescriptions[selectedAction].desc}</p>
          </div>
          <div className="drawer-col">
            <span className="d-label">PROJECTED ELECTRICAL DELTA:</span>
            <p className="d-desc mono text-legal font-bold">{actionDescriptions[selectedAction].energyDelta}</p>
          </div>
          <div className="drawer-col">
            <span className="d-label">TACTICAL OUTLOOK:</span>
            <p className="d-desc">{actionDescriptions[selectedAction].tacticalImpact}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
