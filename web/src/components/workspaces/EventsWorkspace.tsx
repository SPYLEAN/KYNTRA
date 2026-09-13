import { useState } from 'react';
import type { DecisionSnapshot, EvidenceInspectionTarget, KyntraRuntimeSnapshot, OperatingMode, RaceEvent } from '../../types';
import { DecisionDiffPanel } from '../events/DecisionDiffPanel';
import { sameBattle, publishedLabel, metric } from '../../domain/presentation';
interface Props { events:RaceEvent[]; runtimeSnapshot?:KyntraRuntimeSnapshot|null; decision?:DecisionSnapshot|null; decisionHistory?:any[]; observedHistory?:DecisionSnapshot[]; selectedBattleId?:string|null; operatingMode?:OperatingMode; onJumpToLap:(lap:number)=>void; onOpenEvidence?:(target:EvidenceInspectionTarget)=>void }
export function EventsWorkspace({events,decision=null,decisionHistory=[],observedHistory=[],operatingMode='REPLAY',onJumpToLap,onOpenEvidence=()=>{}}:Props) {
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const recorded = decisionHistory.filter(d=>d.race && d.battle && sameBattle(d,decision));
  const history = observedHistory.filter(d=>sameBattle(d,decision));
  const index = Math.max(0,history.findIndex(d=>d.decision_id===selectedId));
  const selected = history[index] || decision;
  const previous = history[index+1] || null;
  return <div className="astra-workspace astra-events"><div className="astra-section-heading"><div><span className="astra-eyebrow">03 / DECISION MEMORY</span><h2>Every call has a before and an after.</h2><p>Inspect observed decisions, their transitions, and the evidence available at that moment.</p></div><span className="astra-seal">{recorded.length} MATCHING STORE RECORDS<small>{history.length} captured in session memory</small></span></div>
    <div className="astra-memory-timeline">{history.length ? history.slice(0,20).map((d,i)=><button className={index===i?'active':''} key={d.decision_id || i} onClick={()=>setSelectedId(d.decision_id || null)}><small>LAP {d.race.lap ?? '—'}</small><b>{publishedLabel(d)}</b><span>{metric(d.battle.gap_seconds,'s')}</span></button>):<p className="astra-notice">UNRECORDED — waiting for observed decision snapshots.</p>}</div>
    <div className="astra-memory-grid"><section className="astra-memory-context"><span className="astra-eyebrow">SELECTED MOMENT</span><h2><span className="text-threat">{selected?.race.attacker || '—'}</span> → <span className="text-target">{selected?.race.defender || '—'}</span></h2><p>Lap {selected?.race.lap ?? '—'} · {selected?.race.event_id || 'UNKNOWN'}</p><p className="astra-caption">{selected?.decision_id || 'NO SNAPSHOT'}</p><button className="astra-button" disabled={operatingMode!=='REPLAY' || selected?.race.lap == null} onClick={()=>selected?.race.lap != null && onJumpToLap(selected.race.lap)}>Seek to this lap ↗</button><div className="astra-notice"><b>HISTORICAL OUTCOME</b><small>KNOWN AFTER THIS MOMENT</small><p>No verified outcome attached. Passing, retention, and future race results remain UNKNOWN.</p></div></section><DecisionDiffPanel currentSnapshot={selected} previousSnapshot={previous} onOpenEvidence={onOpenEvidence}/></div>
    <details className="astra-details"><summary>Runtime event log · {events.length} received</summary><div className="astra-table-wrap"><table className="astra-table"><thead><tr><th>Lap</th><th>Event</th><th>Cars</th><th>Source</th><th>Evidence</th></tr></thead><tbody>{events.map(ev=><tr key={ev.event_id}><td>{ev.lap ?? '—'}</td><td>{ev.event_type}</td><td>{ev.cars.join(' / ')}</td><td>{ev.provenance || ev.source}</td><td><button className="astra-button" onClick={()=>onOpenEvidence({title:ev.event_type,value:ev.event_id,status:'INFO',provenance:'DERIVED',rawObject:ev})}>Inspect</button></td></tr>)}</tbody></table></div></details>
  </div>;
}

