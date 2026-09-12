import React from 'react';

interface RobustnessPanelProps {
  scenarioWinners?: Record<string, string>;
  robustnessVerdict?: string;
  onClickEvidence?: () => void;
}

export const RobustnessPanel: React.FC<RobustnessPanelProps> = ({
  scenarioWinners = {},
  robustnessVerdict,
  onClickEvidence,
}) => {
  const conservativeWinner = scenarioWinners['CONSERVATIVE'] || 'BUILD';
  const nominalWinner = scenarioWinners['NOMINAL'] || 'BUILD';
  const favorableWinner = scenarioWinners['FAVORABLE'] || 'BUILD';

  let verdictLabel = 'ROBUST WITHIN TESTED ASSUMPTIONS';
  let verdictClass = 'verdict-robust';

  if (robustnessVerdict) {
    if (robustnessVerdict.includes('ENERGY_SENSITIVE')) {
      verdictLabel = 'ENERGY-SENSITIVE';
      verdictClass = 'verdict-sensitive';
    } else if (robustnessVerdict.includes('INSUFFICIENT')) {
      verdictLabel = 'INSUFFICIENT INFORMATION';
      verdictClass = 'verdict-insufficient';
    } else {
      verdictLabel = 'ROBUST WITHIN TESTED ASSUMPTIONS';
      verdictClass = 'verdict-robust';
    }
  }

  return (
    <div
      className={`robustness-panel mono ${onClickEvidence ? 'clickable' : ''}`}
      onClick={onClickEvidence}
      title="Click to inspect scenario assumptions"
    >
      <div className="robustness-header">
        <span className="r-title font-bold">SCENARIO ROBUSTNESS</span>
        <span className="r-sub text-muted">3 BATTERY ASSUMPTIONS</span>
      </div>

      <div className="scenario-winners-row">
        <div className="scenario-item">
          <span className="scen-lbl text-muted">CONSERVATIVE</span>
          <span className="scen-val font-bold text-primary">{conservativeWinner}</span>
        </div>
        <div className="scenario-divider">&bull;</div>
        <div className="scenario-item">
          <span className="scen-lbl text-muted">NOMINAL</span>
          <span className="scen-val font-bold text-accent">{nominalWinner}</span>
        </div>
        <div className="scenario-divider">&bull;</div>
        <div className="scenario-item">
          <span className="scen-lbl text-muted">FAVORABLE</span>
          <span className="scen-val font-bold text-primary">{favorableWinner}</span>
        </div>
      </div>

      <div className="verdict-banner-row">
        <span className="v-lbl text-muted">VERDICT:</span>
        <span className={`v-text font-bold ${verdictClass}`}>{verdictLabel}</span>
      </div>
    </div>
  );
};
