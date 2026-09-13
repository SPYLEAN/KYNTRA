import React, { useEffect } from 'react';
import type { ContextWorkspace } from '../../types';

export interface JudgeStep {
  number: string;
  stepIndex: number;
  totalSteps: number;
  headline: string;
  sentence: string;
  targetWorkspace: ContextWorkspace;
  targetHighlight?: string;
}

interface JudgeModeTourProps {
  isActive: boolean;
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onClose: () => void;
  onNavigateWorkspace: (workspace: ContextWorkspace) => void;
}

export const JUDGE_STEPS: JudgeStep[] = [
  {
    number: '01',
    stepIndex: 1,
    totalSteps: 10,
    headline: 'PROBLEM — An overtake can be possible and still be the wrong decision.',
    sentence: 'Energy is scarce under FIA 2026 regulations (4.00 MJ usable SOC window) and track position durability is fragile. Attacking prematurely destroys stint pace.',
    targetWorkspace: 'STRATEGY',
    targetHighlight: 'strategy-matrix',
  },
  {
    number: '02',
    stepIndex: 2,
    totalSteps: 10,
    headline: 'DATA — Public race state feeds tactical pairing.',
    sentence: 'KYNTRA ingests public telemetry intervals to track battles within 3.0s and extract 5 battle dynamics features without driver or circuit identifiers.',
    targetWorkspace: 'RACE',
    targetHighlight: 'battle-watchlist',
  },
  {
    number: '03',
    stepIndex: 3,
    totalSteps: 10,
    headline: 'AI MODEL — Frozen LightGBM V1 with PAV monotonic horizon projection.',
    sentence: 'Model weights are cryptographically verified (SHA: a368b020); Pool Adjacent Violators projection enforces mathematical monotonicity P1 <= P2 <= P3.',
    targetWorkspace: 'ANALYSIS',
    targetHighlight: 'model-card',
  },
  {
    number: '04',
    stepIndex: 4,
    totalSteps: 10,
    headline: 'WATCH IT ADAPT — Same frozen model, changing race dynamics.',
    sentence: 'Compare two captured snapshots. Changing inputs produce new inference with the same model hash; no online retraining.',
    targetWorkspace: 'ANALYSIS',
    targetHighlight: 'adaptive-panel',
  },
  {
    number: '05',
    stepIndex: 5,
    totalSteps: 10,
    headline: 'STRATEGY — Energy, regulations, and stability govern action feasibility.',
    sentence: 'MGU-K 350 kW maximum power limits, usable battery SOC, and flag rules strictly gate overtake viability before ranking can occur.',
    targetWorkspace: 'STRATEGY',
    targetHighlight: 'energy-rule-gate',
  },
  {
    number: '06',
    stepIndex: 6,
    totalSteps: 10,
    headline: 'FOUR FUTURES — Counterfactual evaluation across 4 discrete actions.',
    sentence: 'Inspect four configured futures and their reported energy, timing, and ordinal stability evidence. Unavailable consequences stay unknown.',
    targetWorkspace: 'STRATEGY',
    targetHighlight: 'strategy-matrix',
  },
  {
    number: '07',
    stepIndex: 7,
    totalSteps: 10,
    headline: 'DECISION — Published KYNTRA Call with 7-point publication gate.',
    sentence: 'Lexicographic ranking combined with state transition hysteresis separates the ranking candidate from the published instruction.',
    targetWorkspace: 'RACE',
    targetHighlight: 'call-banner',
  },
  {
    number: '08',
    stepIndex: 8,
    totalSteps: 10,
    headline: 'WHAT CHANGED? — Decision Diff and temporal battle memory.',
    sentence: 'Inspect consecutive decision snapshots to audit what triggered state, horizon, or recommendation shifts between laps.',
    targetWorkspace: 'EVENTS',
    targetHighlight: 'decision-diff',
  },
  {
    number: '09',
    stepIndex: 9,
    totalSteps: 10,
    headline: 'PROVE IT — Universal Evidence Drawer with cryptographic provenance.',
    sentence: 'Inspect the recorded evidence and distinguish known outcomes from unavailable post-moment data.',
    targetWorkspace: 'ANALYSIS',
    targetHighlight: 'outcome-ledger',
  },
  {
    number: '10',
    stepIndex: 10,
    totalSteps: 10,
    headline: 'SYSTEM TRUST — Canonical health and reported subsystem evidence.',
    sentence: 'Inspect actual module health, freshness, and provenance. Degraded services and unknown evidence remain visible.',
    targetWorkspace: 'SYSTEM',
    targetHighlight: 'system-matrix',
  },
];

export const JudgeModeTour: React.FC<JudgeModeTourProps> = ({
  isActive,
  currentStepIndex,
  onStepChange,
  onClose,
  onNavigateWorkspace,
}) => {
  const currentStep = JUDGE_STEPS[currentStepIndex] || JUDGE_STEPS[0];

  // Navigate workspace whenever step changes
  useEffect(() => {
    if (!isActive) return;
    onNavigateWorkspace(currentStep.targetWorkspace);
    document.documentElement.dataset.judgeActive = 'true';
    const focus = () => {
      document.querySelectorAll('.astra-spotlight').forEach(node => node.classList.remove('astra-spotlight'));
      const target = document.querySelector('[data-spotlight="' + currentStep.targetHighlight + '"]');
      target?.classList.add('astra-spotlight');
      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const timer = setTimeout(focus, 150);
    return () => {
      clearTimeout(timer);
      delete document.documentElement.dataset.judgeActive;
      document.querySelectorAll('.astra-spotlight').forEach(node => node.classList.remove('astra-spotlight'));
    };
  }, [isActive, currentStepIndex, currentStep, onNavigateWorkspace]);

  // Keyboard navigation: ArrowLeft (back), ArrowRight (next), Escape (close)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentStepIndex < JUDGE_STEPS.length - 1) {
          onStepChange(currentStepIndex + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStepIndex > 0) {
          onStepChange(currentStepIndex - 1);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStepIndex, onStepChange, onClose]);

  if (!isActive) return null;

  return (
    <aside
      className="judge-mode-hud-strip mono"
      aria-label="Judge Guided Mode Tour"
      role="region"
    >
      <div className="judge-hud-inner">
        {/* Step Badge & Progress */}
        <div className="judge-step-indicator">
          <span className="judge-badge font-bold">JUDGE MODE</span>
          <span className="judge-counter font-bold text-accent">
            STEP {currentStep.number} / {String(currentStep.totalSteps).padStart(2, '0')}
          </span>
        </div>

        {/* Narrative Content */}
        <div className="judge-narrative-block">
          <h4 className="judge-headline font-bold text-primary">
            {currentStep.headline}
          </h4>
          <p className="judge-sentence text-muted">
            {currentStep.sentence}
          </p>
        </div>

        {/* Navigation Controls */}
        <div className="judge-controls-group">
          <button
            type="button"
            className="judge-btn judge-prev-btn"
            onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0}
            title="Previous Step [Left Arrow]"
          >
            &larr; BACK
          </button>

          <button
            type="button"
            className="judge-btn judge-next-btn font-bold"
            onClick={() => {
              if (currentStepIndex < JUDGE_STEPS.length - 1) {
                onStepChange(currentStepIndex + 1);
              } else {
                onClose();
              }
            }}
            title="Next Step [Right Arrow]"
          >
            {currentStepIndex < JUDGE_STEPS.length - 1 ? 'NEXT \u2192' : 'FINISH \u2713'}
          </button>

          <button
            type="button"
            className="judge-btn judge-exit-btn"
            onClick={onClose}
            title="Exit Judge Mode [ESC]"
          >
            EXIT
          </button>
        </div>
      </div>
    </aside>
  );
};
