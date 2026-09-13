import type { DecisionSnapshot, EvidenceInspectionTarget, KyntraRuntimeSnapshot, CarState, TrackGeometry, BattleWatchlistItem, ActiveBattleTracker } from '../../types';
import { DigitalTrackTwin } from '../DigitalTrackTwin';
import { TimingTower } from './TimingTower';
import { KyntraCallPanel } from './KyntraCallPanel';
import { metric } from '../../domain/presentation';
interface Props { runtimeSnapshot: KyntraRuntimeSnapshot | null; decision: DecisionSnapshot | null; cars: Record<string,CarState>; geometry: TrackGeometry | null; watchlist: BattleWatchlistItem[]; activeBattles: ActiveBattleTracker[]; selectedBattleId?: string | null; decisionHistory?: DecisionSnapshot[]; trackStatus?: string; circuitName?: string; isStale?: boolean; connectionStatus?: string; onSelectBattle: (id:string)=>void; onSelectCar?: (driver:string)=>void; onOpenEvidence: (target:EvidenceInspectionTarget)=>void }
export function RaceWorkspace({ runtimeSnapshot: runtime, decision, cars, geometry, watchlist, selectedBattleId, decisionHistory = [], trackStatus, circuitName, onSelectBattle, onSelectCar, onOpenEvidence }: Props) {
  const attacker = decision?.race.attacker, defender = decision?.race.defender;
  const spatialBattle = watchlist.find(b => b.attacker === attacker && b.defender === defender);
  const pub = decision?.published_call || null;
  const matrix = decision?.strategy_matrix;
  const actionKey = pub?.backend_action || decision?.recommendation.canonical_action;
  const action = actionKey ? matrix?.actions?.[actionKey] : null;
  const energy = action?.energy;
  const why = pub?.why_selected || decision?.recommendation.why || [];
  const gap = decision?.battle.gap_seconds;
  const closing = decision?.battle.closing_rate;
  const samples = decisionHistory.filter(d => d.race.event_id === decision?.race.event_id && d.race.attacker === attacker && d.race.defender === defender && typeof d.battle.gap_seconds === 'number').slice(0,30).reverse();
  const values = samples.map(d => d.battle.gap_seconds!);
  const max = Math.max(...values, 0.01), min = Math.min(...values, 0);
  const inspect = (title:string, rawObject: any, provenance: EvidenceInspectionTarget['provenance'] = 'DERIVED') => onOpenEvidence({title, value:title, status:'INFO', provenance, rawObject});
  return <div className="astra-race">
    <aside className="astra-field-rail" data-spotlight="battle-watchlist">
      <div className="astra-rail-title"><span>RACE ORDER</span><b>{Object.keys(cars).length}</b></div>
      <div className="astra-timing-scroll"><TimingTower cars={cars} attackerCode={attacker || undefined} defenderCode={defender || undefined} onSelectCar={onSelectCar}/></div>
      <div className="astra-rail-title"><span>DETECTED BATTLES</span><b>{watchlist.length}</b></div>
      <div className="astra-battles">{watchlist.map(b => <button key={b.battle_id} aria-pressed={selectedBattleId === b.battle_id} onClick={() => onSelectBattle(b.battle_id)}><span><b className="text-threat">{b.attacker}</b><span> → </span><b className="text-target">{b.defender}</b></span><strong>{metric(b.gap_seconds,'s')}</strong><small>{b.gap_trend || b.closing_state || 'TREND UNKNOWN'}</small></button>)}
        {!watchlist.length && <p className="astra-caption">No active battles reported.</p>}</div>
      <div className="astra-rail-foot">SOURCE FIELD ONLY<br/>{runtime?.mode || 'UNKNOWN'}</div>
    </aside>
    <section className="astra-spatial">
      <DigitalTrackTwin key={geometry?.event_id} geometry={geometry} cars={cars} attackerCode={attacker} defenderCode={defender} gapSeconds={spatialBattle?.gap_seconds ?? gap} closingRate={closing} trackStatus={trackStatus} circuitName={circuitName} onSelectCar={onSelectCar}/>
      <div className="astra-race-pulse"><div><span className="astra-eyebrow">BATTLE INTERVAL</span><strong>{metric(gap,'s')}</strong><small>{closing == null ? 'Closing rate unknown' : `${metric(closing,' m/s')} · ${closing > 0 ? 'closing' : closing < 0 ? 'opening' : 'steady'}`}</small></div>
        <div className="astra-gap-chart">{values.length > 1 ? <svg viewBox="0 0 300 65" role="img" aria-label="Observed interval history"><path d={values.map((v,i) => `${i ? 'L' : 'M'} ${i/(values.length-1)*300} ${58-(v-min)/(max-min || 1)*48}`).join(' ')} fill="none" stroke="#b6c1ca" strokeWidth="2"/></svg> : <p>Collecting observed interval history…</p>}<small>{values.length} observed snapshots · session memory</small></div>
        <button className="astra-button" disabled={!decision} onClick={() => inspect('Battle kinematics', decision?.battle)}>Inspect battle ↗</button></div>
    </section>
    <aside className="astra-decision-rail">
      <div data-spotlight="call-banner"><span className="astra-eyebrow">WHAT SHOULD I DO? · SNAPSHOT L{decision?.race.lap ?? '—'}</span><KyntraCallPanel publishedCall={pub} callLifecycle={pub?.lifecycle_state || 'WITHHELD'} candidateCall={decision?.recommendation} decisionSnapshotId={decision?.decision_id} onOpenEvidence={onOpenEvidence}/></div>
      <div className="astra-battle-heading"><span><small>ATTACKER</small><b className="text-threat">{attacker || '—'}</b></span><span className="astra-versus">→</span><span><small>DEFENDER</small><b className="text-target">{defender || '—'}</b></span><strong>{metric(gap,'s')}</strong></div>
      <button className="astra-opportunity" disabled={!decision} onClick={() => inspect('Cumulative overtake horizons', decision?.overtake, 'FROZEN MODEL')}><span className="astra-eyebrow">CAN I PASS? <small>FROZEN MODEL</small></span><div className="astra-race-horizons">{(['p_1_lap','p_2_laps','p_3_laps'] as const).map((key,i) => <div key={key}><small>P{i+1} / {i+1} LAP{i ? 'S' : ''}</small><strong className={decision?.overtake[key] == null ? 'is-unknown' : ''}>{metric(decision?.overtake[key] == null ? null : decision.overtake[key]! * 100,'%',1)}</strong><div className="astra-prob-track"><i style={{width:`${(decision?.overtake[key] ?? 0)*100}%`}}/></div></div>)}</div></button>
      <button className="astra-energy-summary" disabled={!decision} onClick={() => inspect('Simulated energy trajectory', {energy:decision?.energy, action}, 'SIMULATED ENERGY')}><span className="astra-eyebrow">CAN I AFFORD IT? <small>SIMULATED ENERGY</small></span><div><strong>{metric(decision?.energy.available_energy_mj,' MJ')}</strong><span>→</span><strong>{metric(energy?.after_mj,' MJ')}</strong></div><p>Current → after {actionKey || 'candidate'} · Deploy {metric(energy?.planned_deployment_mj,' MJ')} / Recover {metric(energy?.expected_recovery_mj,' MJ')}</p></button>
      <div className="astra-constraints" data-spotlight="energy-rule-gate">{[['CAN I KEEP IT?',decision?.stability.verdict || 'UNKNOWN',decision?.stability],['AM I ALLOWED?',decision?.compliance.status || 'UNKNOWN',decision?.compliance]].map(([label,value,raw]) => <button key={String(label)} onClick={() => inspect(String(label),raw)}><small>{String(label)}</small><b className={value === 'LEGAL' ? 'text-legal' : value === 'HIGH_RISK' || value === 'BLOCKED' ? 'text-threat' : ''}>{String(value)}</b></button>)}</div>
      <div className="astra-rationale"><span className="astra-eyebrow">WHY THIS CALL</span>{why.length ? <ol>{why.slice(0,3).map((reason:string,i:number) => <li key={i}>{reason}</li>)}</ol> : <p>No reasoning published for the current state.</p>}</div>
    </aside>
  </div>;
}

