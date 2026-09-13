import type { DecisionSnapshot, EvidenceInspectionTarget } from '../../types';
import { metric, publishedLabel, sameBattle } from '../../domain/presentation';
interface Props { currentSnapshot: DecisionSnapshot | null; previousSnapshot: DecisionSnapshot | null; onOpenEvidence: (target: EvidenceInspectionTarget) => void }
export function DecisionDiffPanel({ currentSnapshot: current, previousSnapshot, onOpenEvidence }: Props) {
  const previous = sameBattle(current, previousSnapshot) ? previousSnapshot : null;
  const rows = [
    ['Time gap', metric(previous?.battle.gap_seconds, 's'), metric(current?.battle.gap_seconds, 's')],
    ['Closing rate', metric(previous?.battle.closing_rate, ' m/s'), metric(current?.battle.closing_rate, ' m/s')],
    ...(['p_1_lap', 'p_2_laps', 'p_3_laps'] as const).map((key, i) => [`P${i + 1} · pass within ${i + 1} laps`, metric(previous?.overtake[key] == null ? null : previous.overtake[key]! * 100, '%', 1), metric(current?.overtake[key] == null ? null : current.overtake[key]! * 100, '%', 1)]),
    ['Simulated energy', metric(previous?.energy.available_energy_mj, ' MJ'), metric(current?.energy.available_energy_mj, ' MJ')],
    ['Rules', previous?.compliance.status || 'UNKNOWN', current?.compliance.status || 'UNKNOWN'],
    ['Stability', previous?.stability.verdict || 'UNKNOWN', current?.stability.verdict || 'UNKNOWN'],
    ['Candidate', previous?.recommendation.ui_label || 'UNKNOWN', current?.recommendation.ui_label || 'UNKNOWN'],
  ];
  return <section className="astra-diff" data-spotlight="decision-diff"><span className="astra-eyebrow">DECISION MEMORY</span><h2>What changed?</h2>
    <div className="astra-call-transition"><b>{previous ? publishedLabel(previous) : 'UNRECORDED'}</b><span>→</span><strong>{publishedLabel(current)}</strong></div>
    {!previous && <p className="astra-notice">No earlier comparable snapshot recorded for this battle.</p>}
    {rows.map(([name, before, after]) => <div className="astra-diff-row" key={name}><span>{name}</span><span>{before}</span><b>→</b><strong className={previous && before !== after ? 'astra-changed' : ''}>{after}</strong></div>)}
    <p className="astra-caption">Observed changes are not proof of causality. Historical outcomes are known after this moment and never used as inference inputs.</p>
    <button className="astra-button" disabled={!current} onClick={() => onOpenEvidence({ title: 'Decision comparison', value: publishedLabel(current), status: 'INFO', provenance: 'STATE TRANSITION DIFF', rawObject: { previous, current } })}>Inspect evidence ↗</button>
  </section>;
}

