import type { DecisionSnapshot } from '../types';
export function metric(value: unknown, unit = '', digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : 'UNKNOWN';
}
export function publishedLabel(snapshot: DecisionSnapshot | null): string {
  const call = snapshot?.published_call;
  return call && ['VALID', 'AGING'].includes(call.lifecycle_state) ? call.ui_call || 'UNKNOWN' : `CALL ${call?.lifecycle_state || 'WITHHELD'}`;
}
export function sameBattle(a: DecisionSnapshot | null, b: DecisionSnapshot | null): boolean {
  return Boolean(a && b && a.race.event_id === b.race.event_id && a.race.attacker === b.race.attacker && a.race.defender === b.race.defender);
}
export function modelHash(snapshot: DecisionSnapshot | null): string | null {
  return snapshot?.strategy_matrix?.model_sha256 || snapshot?.published_call?.provenance?.model_sha256 || null;
}
export function featureValue(snapshot: DecisionSnapshot | null, key: string): number | null {
  if (!snapshot) return null;
  const battle = snapshot.battle as unknown as Record<string, unknown>;
  const value = battle[key] ?? snapshot.strategy_matrix?.current_state_summary?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

