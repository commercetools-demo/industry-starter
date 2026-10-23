// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import { sdkApi, orUndefined, type Api } from './api';
import { isSeedOwned } from './cleanup';
import { assertSafeProject, fail, isExampleEmail, isMainModule, loadEnv } from './lib';
import { connectRoot, type ApiRoot } from './order-ops';

/**
 * Removes the records the end-to-end journeys (workstream Q) created, and ONLY the ones named in the test-data register
 * (`plans/evidence/Q/test-data.md`, one row per record: `| kind | id | note |`). There is no query and no wildcard.
 *
 *   npm run seed:cleanup-tests -- --register ../plans/evidence/Q/test-data.md                                  (dry run: the default)
 *   npm run seed:cleanup-tests -- --register ../plans/evidence/Q/test-data.md --apply --confirm <projectKey>
 *
 * `kind` is `customer`, `review`, `recurring-order`, `shopping-list`, `order` or `cart`; `id` is the commercetools id (a cell may be
 * wrapped in backticks). The header row, the separator row and every line that is not a table row are ignored.
 *
 * Dry run (no `--apply`, or `--dry-run`): reads each record, prints what it would delete, deletes nothing, exits 0.
 * `--apply` needs `--confirm <projectKey>` equal to the configured key and to EXPECTED_PROJECT_KEY, and every guard of the
 * seed scripts (the configured key, then the key the API reports) runs first.
 *
 * Per row: `order` and `cart` are listed as "cannot be deleted" and skipped (commercetools cannot delete orders; carts expire).
 * A record that no longer exists is "already gone", not an error. Refused, never deleted: a customer whose email is not an
 * `@example.com` address, any record whose key starts with `mcf-` (seed data, for example a demo customer), an unknown kind, an
 * id that is not an id. A recurring order must be Canceled or Expired to be deleted (commercetools rule), so an active or paused
 * one named in the register is canceled first. Deletion order: reviews, shopping lists, recurring orders, customers.
 *
 * Output has ids only: never an email, a name or the note column. Summary: `N deletion(s), N skipped, N refused`.
 */
export const REGISTER_KINDS = ['customer', 'review', 'recurring-order', 'shopping-list', 'order', 'cart'] as const;
export type RegisterKind = (typeof REGISTER_KINDS)[number];

/** Dependants before what they reference. */
export const DELETE_SEQUENCE = ['review', 'shopping-list', 'recurring-order', 'customer'] as const;
export type DeletableKind = (typeof DELETE_SEQUENCE)[number];

const NOT_DELETABLE: Record<'order' | 'cart', string> = {
  order: 'commercetools cannot delete orders',
  cart: 'carts are not deleted here, an unused cart expires on its own',
};

const isRegisterKind = (k: string): k is RegisterKind => (REGISTER_KINDS as readonly string[]).includes(k);
const isDeletable = (k: RegisterKind): k is DeletableKind => (DELETE_SEQUENCE as readonly string[]).includes(k);

export interface RegisterRow { line: number; kind: string; id: string }

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const cell = (c: string): string => c.trim().replace(/^`+|`+$/g, '').trim();

/**
 * Reads the table rows of the register. Ignored: prose, headings, blank lines, the header row (`kind | id | note`), the separator
 * row (`---`) and rows with nothing in the kind and id cells. Every other row is returned, even with an unknown kind, so the run
 * can refuse it by line number instead of dropping it silently.
 */
export function parseRegister(text: string): RegisterRow[] {
  const rows: RegisterRow[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line.startsWith('|')) return;
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell);
    if (cells.every((c) => c === '' || /^:?-{2,}:?$/.test(c))) return; // separator or empty row
    const kind = (cells[0] ?? '').toLowerCase();
    const id = cells[1] ?? '';
    if (kind === 'kind' && id.toLowerCase() === 'id') return; // header
    rows.push({ line: i + 1, kind, id });
  });
  return rows;
}

/** What the tool needs from commercetools (an in-memory stand-in in the tests). */
export interface Stored { id: string; version: number; key?: string; /** read only to test the domain, never printed */ email?: string; /** recurring orders */ state?: string }

export interface TestDataPort {
  read(kind: DeletableKind, id: string): Promise<Stored | undefined>;
  /** Cancels an active or paused recurring order; resolves the new version. */
  cancelRecurringOrder(id: string, version: number): Promise<number>;
  remove(kind: DeletableKind, id: string, version: number): Promise<void>;
}

/** Recurring orders are not part of `Api` (it has no such kind), so they get their own small port. */
export interface RecurringOrdersPort {
  get(id: string): Promise<Stored | undefined>;
  cancel(id: string, version: number): Promise<number>;
  remove(id: string, version: number): Promise<void>;
}

const API_KIND = { customer: 'customers', review: 'reviews', 'shopping-list': 'shopping-lists' } as const;

/** `TestDataPort` over the seed's `Api` (customers, reviews, shopping lists: the same calls as `seed:cleanup` and `reset`) and the recurring-orders port. */
export function apiTestData(api: Api, recurring: RecurringOrdersPort): TestDataPort {
  return {
    async read(kind, id) {
      if (kind === 'recurring-order') return recurring.get(id);
      const r = await api.getById(API_KIND[kind], id);
      if (!r) return undefined;
      return { id: r.id, version: r.version, ...(r.key ? { key: r.key } : {}), ...(typeof r.email === 'string' ? { email: r.email } : {}) };
    },
    cancelRecurringOrder: (id, version) => recurring.cancel(id, version),
    async remove(kind, id, version) {
      if (kind === 'recurring-order') return recurring.remove(id, version);
      await api.remove(API_KIND[kind], { id, version });
    },
  };
}

/** The commercetools side of `RecurringOrdersPort` (same calls the storefront makes: `setRecurringOrderState` and DELETE with `version`). */
export function sdkRecurringOrders(root: ApiRoot): RecurringOrdersPort {
  return {
    async get(id) {
      const r = await orUndefined(() => root.recurringOrders().withId({ ID: id }).get().execute());
      return r ? { id: r.id, version: r.version, ...(r.key ? { key: r.key } : {}), state: r.recurringOrderState } : undefined;
    },
    async cancel(id, version) {
      const r = (await root.recurringOrders().withId({ ID: id }).post({ body: { version, actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled' } }] } as never }).execute()).body;
      return r.version;
    },
    async remove(id, version) {
      await root.recurringOrders().withId({ ID: id }).delete({ queryArgs: { version } }).execute();
    },
  };
}

export interface CleanupArgs { register?: string; apply: boolean; confirm?: string }

export function parseCleanupArgs(argv: string[]): CleanupArgs {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  // `--dry-run` always wins over `--apply`: the safe direction.
  return { register: get('--register'), apply: argv.includes('--apply') && !argv.includes('--dry-run'), confirm: get('--confirm') };
}

/** `--apply` needs `--confirm` equal to the configured key and to the independently typed EXPECTED_PROJECT_KEY. */
export function assertApplyAllowed(confirm: string | undefined, projectKey: string, expectedProjectKey: string | undefined): void {
  if (!confirm || confirm !== projectKey || confirm !== expectedProjectKey) throw new Error(`--apply needs --confirm <projectKey> equal to the project key "${projectKey}" (and to EXPECTED_PROJECT_KEY); without --apply this is a dry run`);
}

export interface CleanupRunOptions {
  apply: boolean;
  confirm?: string;
  /** The configured key (SEED_CTP_PROJECT_KEY). */
  projectKey: string;
  /** The independently typed key (EXPECTED_PROJECT_KEY). */
  expectedProjectKey?: string;
}

export interface CleanupSummary { deletions: number; skipped: number; refused: number; failed: number }

/** Why a record that exists must not be deleted, or undefined. */
function refusal(kind: DeletableKind, r: Stored): string | undefined {
  if (isSeedOwned(r.key)) return 'seed data (key starts with mcf-)';
  if (kind === 'customer' && !isExampleEmail(r.email)) return 'not an @example.com customer';
  return undefined;
}

/** Status and error code only: the body of an error can name resources, so it is never printed. */
function describeError(e: unknown): string {
  const x = e as { statusCode?: number; body?: { errors?: { code?: string }[] } };
  return [x.statusCode ? `HTTP ${x.statusCode}` : 'error', x.body?.errors?.[0]?.code].filter(Boolean).join(' ');
}
const statusOf = (e: unknown): number | undefined => (e as { statusCode?: number; code?: number }).statusCode ?? (e as { code?: number }).code;

type Applied = { result: 'deleted' } | { result: 'gone' } | { result: 'refused'; reason: string } | { result: 'failed'; why: string };

/** Deletes one record by its CURRENT version (read first); one retry when the version moved in between. */
async function applyDelete(port: TestDataPort, kind: DeletableKind, first: Stored): Promise<Applied> {
  let current = first;
  for (let attempt = 1; ; attempt += 1) {
    try {
      let version = current.version;
      if (kind === 'recurring-order' && current.state !== 'Canceled' && current.state !== 'Expired') version = await port.cancelRecurringOrder(current.id, version);
      await port.remove(kind, current.id, version);
      return { result: 'deleted' };
    } catch (e) {
      const status = statusOf(e);
      if (status === 404) return { result: 'gone' };
      if (status !== 409 || attempt > 1) return { result: 'failed', why: describeError(e) };
      const again = await port.read(kind, current.id);
      if (!again) return { result: 'gone' };
      const why = refusal(kind, again);
      if (why) return { result: 'refused', reason: why };
      current = again;
    }
  }
}

/**
 * Processes the register: guards first (no request on failure), then one pass over the rows in deletion order. The dry run and
 * the apply run take the same decisions; only the delete call differs. Returns the counts that the summary line prints.
 */
export async function runCleanupTests(port: TestDataPort, rows: RegisterRow[], opts: CleanupRunOptions, log: (line: string) => void = console.log): Promise<CleanupSummary> {
  assertSafeProject(opts.projectKey, opts.expectedProjectKey);
  if (opts.apply) assertApplyAllowed(opts.confirm, opts.projectKey, opts.expectedProjectKey);
  if (!opts.apply) log('dry run: nothing is deleted (add --apply --confirm <projectKey> to delete the records below)');

  const rank = (r: RegisterRow): number => (isRegisterKind(r.kind) && isDeletable(r.kind) ? DELETE_SEQUENCE.indexOf(r.kind) : -1);
  const ordered = [...rows].sort((a, b) => rank(a) - rank(b)); // stable: rows that are not deleted keep the register's order, first
  const seen = new Set<string>();
  const s: CleanupSummary = { deletions: 0, skipped: 0, refused: 0, failed: 0 };
  const refuse = (line: string) => { s.refused += 1; log(`REFUSED ${line}`); };

  for (const row of ordered) {
    if (!isRegisterKind(row.kind)) { refuse(`line ${row.line}: unknown kind (use ${REGISTER_KINDS.join(', ')})`); continue; }
    if (!ID_RE.test(row.id)) { refuse(`line ${row.line}: the id of this ${row.kind} row is not a commercetools id`); continue; }
    const label = `${row.kind} ${row.id}`;
    if (seen.has(label)) { s.skipped += 1; log(`skipped ${label}: listed twice`); continue; }
    seen.add(label);
    if (!isDeletable(row.kind)) { s.skipped += 1; log(`cannot be deleted: ${label} (${NOT_DELETABLE[row.kind]})`); continue; }

    const found = await port.read(row.kind, row.id);
    if (!found) { s.skipped += 1; log(`already gone: ${label}`); continue; }
    const why = refusal(row.kind, found);
    if (why) { refuse(`${label}: ${why}`); continue; }

    if (!opts.apply) {
      s.deletions += 1;
      log(`would ${row.kind === 'recurring-order' && found.state !== 'Canceled' && found.state !== 'Expired' ? 'cancel and delete' : 'delete'} ${label}`);
      continue;
    }
    const done = await applyDelete(port, row.kind, found);
    if (done.result === 'deleted') { s.deletions += 1; log(`deleted ${label}`); }
    else if (done.result === 'gone') { s.skipped += 1; log(`already gone: ${label}`); }
    else if (done.result === 'refused') refuse(`${label}: ${done.reason}`);
    else { s.failed += 1; log(`FAILED ${label}: ${done.why}`); }
  }

  log(`${opts.apply ? '' : 'dry run: '}${s.deletions} deletion(s), ${s.skipped} skipped, ${s.refused} refused${s.failed > 0 ? `, ${s.failed} failed` : ''}`);
  return s;
}

async function main() {
  const args = parseCleanupArgs(process.argv.slice(2));
  if (!args.register) throw new Error('usage: seed:cleanup-tests -- --register <test-data.md> [--apply --confirm <projectKey>] (see the header of cleanup-tests.ts)');
  const rows = parseRegister(readFileSync(args.register, 'utf8'));
  const { env } = loadEnv(); // first guard, no network
  if (args.apply) assertApplyAllowed(args.confirm, env.projectKey, env.expectedProjectKey); // refused before the first request
  const root = await connectRoot(env); // second guard: the API reports the key we expect
  const port = apiTestData(sdkApi(root), sdkRecurringOrders(root));
  const s = await runCleanupTests(port, rows, { apply: args.apply, confirm: args.confirm, projectKey: env.projectKey, expectedProjectKey: env.expectedProjectKey });
  if (args.apply && (s.failed > 0 || s.refused > 0)) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
