// History: "effective" is derived (status scheduled and releaseAt reached), never stored, so there is no job to run
// (nothing in the platform fires when a date arrives).
import { userInfo } from 'node:os';
import type { ReleaseRecord } from './types';

export function defaultOperator(): string {
  try {
    return userInfo().username || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function isEffective(record: ReleaseRecord, at: Date): boolean {
  if (record.status !== 'scheduled') return false;
  const t = at.getTime();
  if (Date.parse(record.releaseAt) > t) return false;
  return !(record.endsAt && Date.parse(record.endsAt) <= t);
}

/** Releases in effect at `at`: scheduled, reached, not ended, and not undone by a rollback that was itself effective by then. */
export function inEffectAt(records: ReleaseRecord[], at: Date): ReleaseRecord[] {
  const effective = records.filter((r) => isEffective(r, at));
  const undone = new Set(effective.flatMap((r) => (r.rollbackOf ? [r.rollbackOf] : [])));
  return effective.filter((r) => !undone.has(r.key)).sort((a, b) => Date.parse(a.releaseAt) - Date.parse(b.releaseAt));
}

export interface PriceInEffect {
  offerKey: string;
  field: string;
  centAmount: number;
  release: string;
}

/** Per touched offer, the price recorded for `at`: the last effective release that set it wins. A rolled-back release contributes nothing. */
export function pricesInEffectAt(records: ReleaseRecord[], at: Date): PriceInEffect[] {
  const latest = new Map<string, PriceInEffect>();
  for (const record of inEffectAt(records, at)) {
    for (const change of record.changes) {
      if (change.resource !== 'price' || typeof change.after !== 'number') continue;
      latest.set(`${change.key}|${change.field}`, { offerKey: change.key, field: change.field, centAmount: change.after, release: record.key });
    }
  }
  return [...latest.values()];
}

export function renderHistory(records: ReleaseRecord[], at?: Date): string[] {
  const lines: string[] = [];
  if (!at) {
    lines.push(`Releases (${records.length}):`);
    for (const r of [...records].sort((a, b) => Date.parse(a.releaseAt) - Date.parse(b.releaseAt))) {
      lines.push(`  ${r.key}  ${r.status}  releaseAt ${r.releaseAt}  author "${r.author}"  appliedBy "${r.appliedBy}"  appliedAt ${r.appliedAt}${r.expedited ? '  EXPEDITED' : ''}${r.rollbackOf ? `  rollback of ${r.rollbackOf}` : ''}`);
    }
    return lines;
  }
  const active = inEffectAt(records, at);
  lines.push(`In effect at ${at.toISOString()} (${active.length}):`);
  for (const r of active) lines.push(`  ${r.key}  releaseAt ${r.releaseAt}  author "${r.author}"  appliedBy "${r.appliedBy}"  appliedAt ${r.appliedAt}`);
  const prices = pricesInEffectAt(records, at);
  if (prices.length > 0) {
    lines.push('Prices set by those releases:');
    for (const p of prices) lines.push(`  ${p.offerKey}  ${p.field}  ${(p.centAmount / 100).toFixed(2)}  (${p.release})`);
  }
  return lines;
}
