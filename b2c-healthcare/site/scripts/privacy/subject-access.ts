import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectSubject, findCustomer, type QueryNote } from './collect';
import { assertOutsideRepo, GDPR_KINDS, getAdminRoot, isMain, type Rec, type Root } from './lib';

/**
 * Subject access: everything held about one customer, from all 13 resource kinds of the GDPR page (Customer, Cart, Order,
 * Payment, Review, ShoppingList, DiscountCode, CustomObject, Message, BusinessUnit, Quote, QuoteRequest, StagedQuote; there is no
 * single endpoint) plus the recurring orders. Custom Objects are read from every `malva-*` container: the standard model knows
 * nothing about them.
 *
 *   npx tsx scripts/privacy/subject-access.ts <customerId|email> [--out <file outside the repo>]
 *
 * The report holds personal data: it goes to stdout, or to `--out`, which must be outside the repository. Read-only; the
 * seed project-key guard applies.
 */
export interface AccessReport {
  generatedAt: string;
  customerId: string;
  /** The queries run, in the GDPR page's order. */
  queries: QueryNote[];
  /** One entry per GDPR resource kind. */
  resources: Record<string, Rec[]>;
  customObjects: Record<string, { key: string; value: unknown }[]>;
  recurringOrders: Rec[];
}

export async function subjectAccess(root: Root, idOrEmail: string, now: Date = new Date()): Promise<AccessReport | null> {
  const customer = await findCustomer(root, idOrEmail);
  if (!customer) return null;
  const subject = await collectSubject(root, customer);
  const customObjects = Object.fromEntries(Object.entries(subject.objects).map(([container, hits]) => [container, hits.map((h) => ({ key: h.key, value: h.value }))]));
  const resources: Record<string, Rec[]> = {};
  for (const kind of GDPR_KINDS) resources[kind] = kind === 'CustomObject' ? Object.values(subject.objects).flat().map((h) => ({ container: h.container, key: h.key })) : subject.resources[kind];
  return { generatedAt: now.toISOString(), customerId: subject.customerId, queries: subject.queries, resources, customObjects, recurringOrders: subject.recurringOrders };
}

async function main() {
  const argv = process.argv.slice(2);
  const outAt = argv.indexOf('--out');
  const out = outAt >= 0 ? argv[outAt + 1] : undefined;
  const target = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
  if (!target) throw new Error('Usage: subject-access.ts <customerId|email> [--out <file>]');
  const file = out ? assertOutsideRepo(out) : undefined;
  const { root } = await getAdminRoot();
  const report = await subjectAccess(root, target);
  if (!report) throw new Error('no customer found');
  const json = JSON.stringify(report, null, 2);
  if (file) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, json, { mode: 0o600 });
    console.log(`report written (${Object.values(report.resources).reduce((n, r) => n + r.length, 0)} item(s))`);
  } else {
    console.log(json);
  }
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
