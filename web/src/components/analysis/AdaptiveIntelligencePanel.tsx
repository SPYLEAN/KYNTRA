import type { DecisionSnapshot, EvidenceInspectionTarget } from '../../types';
import { featureValue, metric, modelHash, publishedLabel, sameBattle } from '../../domain/presentation';
interface Props { decision: DecisionSnapshot | null; previousDecision?: DecisionSnapshot | null; onOpenEvidence?: (target: EvidenceInspectionTarget) => void }
const FEATURES = [
  ['gap_seconds', 'Gap to defender', 's'], ['closing_rate', 'Closing rate', ' m/s'],
  ['recent_pace_delta_1lap', 'Pace · last lap', 's'], ['recent_pace_delta_3laps', 'Pace · three laps', 's'],
  ['speed_trap_delta', 'Speed-trap delta', ' km/h'],
] as const;
export function AdaptiveIntelligencePanel({ decision, previousDecision = null, onOpenEvidence }: Props) {
  const earlier = sameBattle(decision, previousDecision) ? previousDecision : null;
  const sha = modelHash(decision);
  const unchanged = Boolean(sha && earlier && sha === modelHash(earlier));
  return <section className="astra-adaptive" data-spotlight="adaptive-panel">
    <div className="astra-section-heading"><div><span className="astra-eyebrow">02 / ADAPTIVE INTELLIGENCE</span>
      <h2>The race changes. The model stays frozen.</h2><p>New observed state → new inference → a new strategy evaluation.</p></div>
      <span className={`astra-seal ${unchanged ? 'verified' : ''}`} title={sha || 'No model hash reported'}>
        {unchanged ? 'SAME MODEL SHA · SAME WEIGHTS' : 'FROZEN MODEL · COMPARISON PENDING'}<small>{sha?.slice(0, 16) || 'HASH UNKNOWN'}</small>
      </span></div>
    {!earlier && <p className="astra-notice">Waiting for a second distinct snapshot of this battle. Resume replay to collect a comparison.</p>}
    <div className="astra-compare-labels"><span>OBSERVED INPUT</span><span>EARLIER · L{earlier?.race.lap ?? '—'}</span><span>CURRENT · L{decision?.race.lap ?? '—'}</span><span>CHANGE</span></div>
    {FEATURES.map(([key, label, unit]) => {
      const before = featureValue(earlier, key), now = featureValue(decision, key);
      const delta = before !== null && now !== null ? now - before : null;
      return <div className="astra-compare-row" key={key} title={key}><span>{label}<small>{key}</small></span><span>{metric(before, unit)}</span><strong>{metric(now, unit)}</strong>
        <span className={delta !== null && delta !== 0 ? 'astra-changed' : ''}>{delta !== null ? `${delta > 0 ? '+' : ''}${metric(delta, unit)}` : '—'}</span></div>;
    })}
    <p className="astra-caption">UNKNOWN: this input is not exposed in the snapshot. No substitute value is used.</p>
    <div className="astra-horizons">{(['p_1_lap', 'p_2_laps', 'p_3_laps'] as const).map((key, i) => {
      const before = earlier?.overtake[key], now = decision?.overtake[key];
      return <div key={key}><span>P{i + 1} <small>PASS WITHIN {i + 1} LAP{i ? 'S' : ''}</small></span>
        <div className="astra-prob-pair"><span>{metric(before == null ? null : before * 100, '%', 1)}</span><b>→</b><strong>{metric(now == null ? null : now * 100, '%', 1)}</strong></div>
        <div className="astra-prob-track"><i style={{ width: `${Math.max(0, Math.min(100, (now ?? 0) * 100))}%` }} /></div></div>;
    })}</div>
    <div className="astra-call-transition"><span>PUBLISHED CALL</span><b>{earlier ? publishedLabel(earlier) : 'UNRECORDED'}</b><span>→</span><strong>{publishedLabel(decision)}</strong></div>
    <button className="astra-button" disabled={!decision} onClick={() => onOpenEvidence?.({ title: 'Observed snapshot comparison', value: unchanged ? 'MODEL HASH UNCHANGED' : 'COMPARISON INCOMPLETE', status: 'INFO', provenance: 'STATE TRANSITION DIFF', rawObject: { earlier, current: decision } })}>Inspect both snapshots ↗</button>
  </section>;
}

