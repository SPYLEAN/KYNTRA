/**
 * Canonical ML Validation Metrics & Provenance Registry
 * 
 * Strict Truth Lock:
 * Every metric exposed here has verified mathematical provenance traced
 * directly to authoritative repository artifacts and models.
 * 
 * Evaluated Sets:
 * 1. TRAIN_OOF: 7 development events cross-validated via Leave-One-Event-Out (LOEO) in notebooks/KYNTRA_02_BASELINE.ipynb
 * 2. CONSUMED_VALIDATION: 2 pre-refit validation events (HUN, NLD; 1,951 usable rows) on models/kyntra_overtake_bundle_v1.joblib
 * 3. FULL_DEV_REFIT: 9 deployment refit events (7 TRAIN + 2 VALIDATION; 7,582 usable rows) on models/kyntra_overtake_bundle_v1.joblib
 */

export interface MetricEntry {
  id: string;
  name: string;
  value: number;
  displayValue: string;
  split: 'TRAIN_OOF' | 'CONSUMED_VALIDATION' | 'FULL_DEV_REFIT';
  horizon: 'H1 (1-Lap)' | 'H2 (2-Laps)' | 'H3 (3-Laps)';
  population: 'GLOBAL (All Usable Laps)' | 'TACTICAL <= 1.0s (Close Chase)';
  evaluationStage: string;
  sourceArtifact: string;
  benchmarkBaseline: string;
  interpretation: string;
}

export const CANONICAL_ML_METRICS: MetricEntry[] = [
  // 1. CONSUMED VALIDATION (Pre-Refit Evaluation on Hungarian & Dutch Grands Prix)
  {
    id: 'val-h1-prauc-global',
    name: 'H1 PR-AUC (Average Precision)',
    value: 0.7608,
    displayValue: '0.7608',
    split: 'CONSUMED_VALIDATION',
    horizon: 'H1 (1-Lap)',
    population: 'GLOBAL (All Usable Laps)',
    evaluationStage: 'Pre-Refit Frozen Model Evaluation (HUN & NLD)',
    sourceArtifact: 'models/kyntra_overtake_bundle_v1.joblib + data/processed/kyntra_overtake_dataset.parquet',
    benchmarkBaseline: 'Prevalence: 0.0369 (3.69%)',
    interpretation: 'Measures discrimination & ranking quality on rare 1-lap overtake events against empirical base rate.',
  },
  {
    id: 'val-h1-prauc-tactical',
    name: 'H1 Tactical PR-AUC (Gap <= 1.0s)',
    value: 0.7918,
    displayValue: '0.7918',
    split: 'CONSUMED_VALIDATION',
    horizon: 'H1 (1-Lap)',
    population: 'TACTICAL <= 1.0s (Close Chase)',
    evaluationStage: 'Pre-Refit Frozen Model Evaluation (HUN & NLD close battle slice, n=400)',
    sourceArtifact: 'models/kyntra_overtake_bundle_v1.joblib + data/processed/kyntra_overtake_dataset.parquet',
    benchmarkBaseline: 'Tactical Prevalence: 0.1700 (17.0%)',
    interpretation: 'Validates that dynamics & delta pace features provide predictive power beyond simple proximity.',
  },
  {
    id: 'val-h1-brier',
    name: 'H1 Brier Score Loss',
    value: 0.0174,
    displayValue: '0.0174',
    split: 'CONSUMED_VALIDATION',
    horizon: 'H1 (1-Lap)',
    population: 'GLOBAL (All Usable Laps)',
    evaluationStage: 'Pre-Refit Frozen Model Evaluation (HUN & NLD)',
    sourceArtifact: 'models/kyntra_overtake_bundle_v1.joblib + data/processed/kyntra_overtake_dataset.parquet',
    benchmarkBaseline: 'Climatological Brier: 0.0355',
    interpretation: 'Measures probability calibration accuracy (lower is superior; 0.0 indicates perfect certainty).',
  },
  {
    id: 'val-h1-bss',
    name: 'H1 Brier Skill Score (BSS)',
    value: 0.5093,
    displayValue: '+0.5093 (+50.9%)',
    split: 'CONSUMED_VALIDATION',
    horizon: 'H1 (1-Lap)',
    population: 'GLOBAL (All Usable Laps)',
    evaluationStage: 'Pre-Refit Frozen Model Evaluation (HUN & NLD)',
    sourceArtifact: 'models/kyntra_overtake_bundle_v1.joblib + data/processed/kyntra_overtake_dataset.parquet',
    benchmarkBaseline: 'Naive Climatology: 0.0000',
    interpretation: 'Percentage improvement in probabilistic accuracy over static calendar base-rate predictions.',
  },

  // 2. FULL DEV REFIT (Production Deployment Bundle over all 9 Development Events)
  {
    id: 'dev-h1-prauc-global',
    name: 'H1 Refit PR-AUC',
    value: 0.6270,
    displayValue: '0.6270',
    split: 'FULL_DEV_REFIT',
    horizon: 'H1 (1-Lap)',
    population: 'GLOBAL (All Usable Laps)',
    evaluationStage: 'Production Deployment Bundle Refit (9 Development Events, 7,582 usable rows)',
    sourceArtifact: 'models/kyntra_overtake_bundle_v1.joblib',
    benchmarkBaseline: 'Prevalence: 0.0334 (3.34%)',
    interpretation: 'Refitted deployment bundle discrimination across all 9 pre-championship development events.',
  },
  {
    id: 'dev-h1-brier',
    name: 'H1 Refit Brier Score',
    value: 0.0191,
    displayValue: '0.0191',
    split: 'FULL_DEV_REFIT',
    horizon: 'H1 (1-Lap)',
    population: 'GLOBAL (All Usable Laps)',
    evaluationStage: 'Production Deployment Bundle Refit (9 Development Events)',
    sourceArtifact: 'models/kyntra_overtake_bundle_v1.joblib',
    benchmarkBaseline: 'Climatology: 0.0323',
    interpretation: 'Deployment model probability accuracy over the full 7,582 usable training observations.',
  },
  {
    id: 'dev-h1-bss',
    name: 'H1 Refit Brier Skill Score',
    value: 0.4079,
    displayValue: '+0.4079 (+40.8%)',
    split: 'FULL_DEV_REFIT',
    horizon: 'H1 (1-Lap)',
    population: 'GLOBAL (All Usable Laps)',
    evaluationStage: 'Production Deployment Bundle Refit (9 Development Events)',
    sourceArtifact: 'models/kyntra_overtake_bundle_v1.joblib',
    benchmarkBaseline: 'Naive Climatology: 0.0000',
    interpretation: 'Skill advantage of the production bundle across the entire development calendar.',
  },

  // 3. TRAIN OOF (Baseline Leave-One-Event-Out Cross-Validation across 7 Train Events)
  {
    id: 'oof-h1-prauc-baseline',
    name: 'H1 OOF PR-AUC (Baseline CV)',
    value: 0.1840,
    displayValue: '0.1840',
    split: 'TRAIN_OOF',
    horizon: 'H1 (1-Lap)',
    population: 'GLOBAL (All Usable Laps)',
    evaluationStage: 'LOEO Cross-Validation across 7 TRAIN events (CHN, CAN, MCO, ESP, AUT, GBR, BEL)',
    sourceArtifact: 'notebooks/KYNTRA_02_BASELINE.ipynb',
    benchmarkBaseline: 'TRAIN Prevalence: 0.0292 (2.92%)',
    interpretation: 'Early un-tuned cross-validation baseline benchmark; demonstrates positive signal before LightGBM hyperparameter optimization.',
  },
  {
    id: 'oof-h1-prauc-tactical',
    name: 'H1 OOF Tactical PR-AUC (Gap <= 1.0s)',
    value: 0.2410,
    displayValue: '0.2410',
    split: 'TRAIN_OOF',
    horizon: 'H1 (1-Lap)',
    population: 'TACTICAL <= 1.0s (Close Chase)',
    evaluationStage: 'LOEO Cross-Validation tactical battle slice across 7 TRAIN events',
    sourceArtifact: 'notebooks/KYNTRA_02_BASELINE.ipynb',
    benchmarkBaseline: 'Tactical Prevalence: 0.1340',
    interpretation: 'Out-of-fold close combat validation confirming feature sensitivity inside DRS range.',
  },
];

export const SPLIT_DEFINITIONS = [
  {
    split: 'TRAIN / OOF',
    events: ['2026_02_CHN', '2026_05_CAN', '2026_06_MCO', '2026_07_ESP', '2026_08_AUT', '2026_09_GBR', '2026_10_BEL'],
    count: '6,197 rows • 1,656 battle sequences',
    role: 'Leave-One-Event-Out (LOEO) cross-validation training fold.',
  },
  {
    split: 'CONSUMED VALIDATION',
    events: ['2026_11_HUN', '2026_12_NLD'],
    count: '2,160 rows • 1,951 usable H1 rows',
    role: 'Hyperparameter validation consumed before deployment refit. NOT untouched test data.',
  },
  {
    split: 'DEMO HOLDOUTS',
    events: ['2026_01_AUS', '2026_03_JPN', '2026_04_MIA', '2026_13_ITA'],
    count: 'Completely Isolated • 0 rows leakage',
    role: 'Untouched championship events reserved for objective demonstration & live replay forensics.',
  },
];
