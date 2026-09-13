import { useState } from 'react';
import type { DecisionSnapshot, EvidenceInspectionTarget } from '../../types';
import { KyntraCallPanel } from '../race/KyntraCallPanel';
import { metric } from '../../domain/presentation';
const ACTIONS = [['CONSERVE','SAVE ENERGY','Protect the next opportunity'],['BUILD','PREPARE','Build the attack window'],['DEPLOY','APPLY PRESSURE','Spend to close the gap'],['OVERTAKE','OVERTAKE NOW','Commit to track position']] as const;
const TIERS = ['REGULATORY_ELIGIBILITY','PHYSICAL_ENERGY_FEASIBILITY','DURABLE_TRACK_POSITION','FUTURE_WINDOW_DOMINANCE','CUMULATIVE_LAP_TIME','TERMINAL_SIMULATED_ENERGY'];
export function StrategyWorkspace({ decision, onOpenEvidence }: { decision:DecisionSnapshot|null; onOpenEvidence:(target:EvidenceInspectionTarget)=>void }) {
  const [details,setDetails] = useState(false);
  const matrix = decision?.strategy_matrix, ranking = matrix?.ranking;
  const traces:any[] = [...(ranking?.ranked_actions || []),...(ranking?.excluded_actions || [])];
  const candidate = matrix?.recommendation?.backend_action || decision?.recommendation.canonical_action;
  return <div className="astra-workspace astra-strategy">
    <div className="astra-section-heading"><div><span className="astra-eyebrow">02 / STRATEGY</span><h2>A possible pass is only the beginning.</h2><p>Four futures from one observed state. Constraints first, publication last.</p></div><button className="astra-button" onClick={() => setDetails(!details)}>{details ? 'Hide' : 'Inspect'} engineering matrix</button></div>
    <div className="astra-futures" data-spotlight="strategy-matrix">{ACTIONS.map(([key,title,subtitle],i) => {
      const action = matrix?.actions?.[key], trace = traces.find(row => row.action === key);
      const eliminated = trace?.excluded_at;
      const rule = action?.rule_check?.result || 'UNKNOWN';
      const status = !action ? 'UNAVAILABLE' : eliminated ? 'ELIMINATED' : candidate === key ? 'CANDIDATE' : action.eligible === true ? 'ELIGIBLE' : action.eligible === false ? 'INELIGIBLE' : 'UNKNOWN';
      return <button key={key} className={`astra-future ${status.toLowerCase()}`} onClick={() => onOpenEvidence({title, value:status, status:rule === 'BLOCKED' ? 'BLOCKED' : 'INFO', provenance:'STRATEGY RANKING', rawObject:{action,trace}, reasonCodes:trace?.exclusion_reasons || []})}>
        <span className="astra-future-number">0{i+1}<small>{status}</small></span><h3>{title}</h3><p>{subtitle}</p>
        <div className="astra-future-metric"><small>TERMINAL ENERGY · SIMULATED</small><strong>{metric(action?.forecast?.terminal_energy_mj,' MJ')}</strong></div>
        <dl><dt>Rules</dt><dd className={rule === 'ALLOWED' ? 'text-legal' : rule === 'BLOCKED' ? 'text-threat' : ''}>{rule}</dd><dt>Stability</dt><dd>{action?.stability?.verdict || 'UNKNOWN'}</dd><dt>Future window</dt><dd>{action?.forecast?.future_window_quality || 'UNKNOWN'}</dd><dt>Lap-time consequence</dt><dd>{metric(action?.forecast?.cumulative_lap_time_consequence_s,'s')}</dd></dl>
        <div className="astra-elimination-track">{TIERS.map((tier,index) => <span key={tier} className={eliminated === tier ? 'failed' : ''} title={tier}>{index+1}</span>)}</div>
        <p className="astra-elimination-reason">{eliminated ? `Lost at ${eliminated.replaceAll('_',' ').toLowerCase()}` : candidate === key ? 'Ranking candidate · final gate still required' : (trace?.exclusion_reasons || action?.exclusion_reasons || []).join(' · ') || 'No elimination trace reported'}</p>
      </button>;
    })}</div>
    <div className="astra-strategy-bottom"><div data-spotlight="energy-rule-gate"><span className="astra-eyebrow">LEXICOGRAPHIC ELIMINATION</span><h3>Each tier has priority over every tier below it.</h3><div className="astra-tier-labels">{['Rules','Energy','Durability','Future window','Lap time','Terminal energy'].map((tier,i)=><span key={tier}><b>{i+1}</b>{tier}</span>)}</div><ul className="astra-trace">{(ranking?.scenario_rankings?.NOMINAL?.comparison_trace || ranking?.comparison_trace || []).map((line:string,i:number)=><li key={i}>{line}</li>)}</ul><p className="astra-caption">Forecast consequences are configuration-based simulations. Candidate selection is not a published instruction.</p></div><KyntraCallPanel publishedCall={decision?.published_call || null} callLifecycle={decision?.published_call?.lifecycle_state || 'WITHHELD'} candidateCall={decision?.recommendation} decisionSnapshotId={decision?.decision_id} onOpenEvidence={onOpenEvidence}/></div>
    {details && <div className="astra-table-wrap"><table className="astra-table"><thead><tr><th>Evidence axis</th>{ACTIONS.map(([key,title])=><th key={key}>{title}</th>)}</tr></thead><tbody>{[['Starting energy','energy','before_mj'],['Planned deployment','energy','planned_deployment_mj'],['Expected recovery','energy','expected_recovery_mj'],['After action energy','energy','after_mj'],['Projected gap change','forecast','projected_gap_delta'],['Projected position delta','forecast','projected_position_delta']].map(([label,group,field])=><tr key={label}><th>{label}</th>{ACTIONS.map(([key])=><td key={key}>{metric(matrix?.actions?.[key]?.[group]?.[field])}</td>)}</tr>)}</tbody></table><button className="astra-button" onClick={()=>onOpenEvidence({title:'Complete strategy matrix',value:matrix?.snapshot_id || 'UNAVAILABLE',status:'INFO',provenance:'STRATEGY RANKING',rawObject:matrix || {}})}>Open complete matrix and ranking evidence ↗</button></div>}
  </div>;
}

