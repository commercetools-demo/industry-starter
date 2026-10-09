import { BOOKINGS } from '../seed/data/bookings';
import { LABS } from '../seed/data/labs';
import { PRESCRIPTIONS } from '../seed/data/prescriptions';
import { getAdminRoot, isMain, queryAll, type Rec, type Root } from './lib';

/**
 * Live audit (spec "Order carries a reference not a condition"): after the seed and a purchase, reads the
 * commerce resources and fails if any value contains a clinical fixture string (a sig, a lab name or result name, a lab note,
 * a booking reason) or if a custom field carries a clinical-looking name.
 *
 *   npx tsx scripts/privacy/audit-live.ts
 *
 * Read-only; the seed project-key guard applies. Prints resource ids, the JSON path and the fixture CLASS (sig, lab, reason ...)
 * of a hit, never the matched value. Exit 1 on any hit.
 */
export interface Fixture { label: 'sig' | 'lab' | 'reason'; text: string }

/** Strings that must never appear in commerce data. Short strings are skipped (they would match ordinary words). */
export function clinicalFixtures(): Fixture[] {
  const out: Fixture[] = [];
  for (const rx of PRESCRIPTIONS) for (const line of rx.lines) out.push({ label: 'sig', text: line.sig });
  for (const lab of LABS) {
    out.push({ label: 'lab', text: lab.name }, { label: 'lab', text: lab.note }, { label: 'lab', text: lab.laboratory });
    for (const r of lab.results) out.push({ label: 'lab', text: r.name });
  }
  for (const b of BOOKINGS) out.push({ label: 'reason', text: b.reason });
  const seen = new Set<string>();
  return out.filter((f) => f.text.trim().length >= 8 && !seen.has(f.text.toLowerCase()) && seen.add(f.text.toLowerCase()));
}

const CLINICAL_FIELD = /sig|diagnosis|condition|result|reason/i;

export interface Finding { kind: string; id: string; path: string; label: string }

function scan(node: unknown, pathSoFar: string, fixtures: Fixture[], visit: (path: string, label: string) => void): void {
  if (typeof node === 'string') {
    const lower = node.toLowerCase();
    for (const f of fixtures) if (lower.includes(f.text.toLowerCase())) visit(pathSoFar, f.label);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => scan(v, `${pathSoFar}[${i}]`, fixtures, visit));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      // a custom field named like a clinical value is a finding whatever it holds
      if (/(^|\.)custom\.fields$/.test(pathSoFar) && CLINICAL_FIELD.test(k)) visit(`${pathSoFar}.${k}`, 'field-name');
      scan(v, pathSoFar ? `${pathSoFar}.${k}` : k, fixtures, visit);
    }
  }
}

const KINDS: { kind: string; collection: string }[] = [
  { kind: 'order', collection: 'orders' },
  { kind: 'cart', collection: 'carts' },
  { kind: 'payment', collection: 'payments' },
  { kind: 'customer', collection: 'customers' },
  { kind: 'shopping-list', collection: 'shoppingLists' },
  { kind: 'recurring-order', collection: 'recurringOrders' },
];

export async function auditLive(root: Root, fixtures: Fixture[] = clinicalFixtures()): Promise<{ checked: Record<string, number>; findings: Finding[] }> {
  const findings: Finding[] = [];
  const checked: Record<string, number> = {};
  for (const { kind, collection } of KINDS) {
    const rows: Rec[] = await queryAll(root, collection);
    checked[kind] = rows.length;
    for (const r of rows) scan(r, '', fixtures, (path, label) => findings.push({ kind, id: String(r.id), path, label }));
  }
  return { checked, findings };
}

async function main() {
  const { root } = await getAdminRoot();
  const { checked, findings } = await auditLive(root);
  console.log(`checked ${Object.entries(checked).map(([k, n]) => `${n} ${k}(s)`).join(', ')}`);
  for (const f of findings) console.log(`FOUND ${f.label} in ${f.kind} ${f.id} at ${f.path}`);
  console.log(findings.length === 0 ? 'clean: no clinical fixture string in commerce data' : `${findings.length} finding(s)`);
  if (findings.length > 0) process.exit(1);
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
