import { EXIT } from './config';
import type { ItemResult } from './reconcile';
import type { Plan } from './types';

export interface Counts {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
}

export function countOutcomes(results: ItemResult[]): Counts {
  const counts: Counts = { created: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0 };
  for (const r of results) counts[r.outcome.status] += 1;
  return counts;
}

function show(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function formatLine(r: ItemResult): string {
  const label = `${r.kind} ${r.key}`;
  const o = r.outcome;
  switch (o.status) {
    case 'updated':
      return `updated    ${label}\n${o.changes.map((c) => `             ${c.path}: ${show(c.from)} -> ${show(c.to)}`).join('\n')}`;
    case 'skipped':
      return `skipped    ${label}  (${o.reason})`;
    case 'failed':
      return `failed     ${label}  (${o.error})`;
    default:
      return `${o.status.padEnd(10)} ${label}`;
  }
}

export function summaryLine(counts: Counts): string {
  return `SUMMARY created=${counts.created} updated=${counts.updated} unchanged=${counts.unchanged} skipped=${counts.skipped} failed=${counts.failed}`;
}

export function exitCodeFor(counts: Counts): number {
  if (counts.failed > 0) return EXIT.FAILED;
  if (counts.skipped > 0) return EXIT.SKIPPED;
  return EXIT.OK;
}

export function renderReport(results: ItemResult[]): { text: string; counts: Counts; exitCode: number } {
  const counts = countOutcomes(results);
  const lines = [...results.map(formatLine), summaryLine(counts)];
  return { text: lines.join('\n'), counts, exitCode: exitCodeFor(counts) };
}

export function renderPlan(plan: Plan): string {
  const word = { create: 'would create', update: 'would update', unchanged: 'unchanged', skip: 'would skip' } as const;
  const lines = plan.map((p) => {
    const head = `${word[p.action].padEnd(13)} ${p.kind} ${p.key}`;
    if (p.action === 'update') return `${head}\n${p.changes.map((c) => `               ${c.path}: ${show(c.from)} -> ${show(c.to)}`).join('\n')}`;
    if (p.action === 'skip') return `${head}  (${p.reason ?? ''})`;
    return head;
  });
  const count = (a: string): number => plan.filter((p) => p.action === a).length;
  lines.push(`PLAN create=${count('create')} update=${count('update')} unchanged=${count('unchanged')} skip=${count('skip')}`);
  return lines.join('\n');
}
