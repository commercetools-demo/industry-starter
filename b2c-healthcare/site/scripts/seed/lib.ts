// The seed scripts are an admin tool outside the storefront architecture (no lib/ct); they build their own client here.
/* eslint-disable @typescript-eslint/no-restricted-imports, no-restricted-syntax */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ClientBuilder } from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';

/** The only project the seed scripts may touch. */
export const PROJECT_KEY = 'spec-test-b2c-healthcare';
/** Every key the seed creates starts with this. */
export const PREFIX = 'mlv-';
export const LOCALE = 'en-US';
export const CURRENCY = 'USD';

export type Root = ByProjectKeyRequestBuilder;
export type Rec = Record<string, unknown>;

export const SEED_ENV_NAMES = [
  'SEED_CTP_PROJECT_KEY',
  'SEED_CTP_AUTH_URL',
  'SEED_CTP_API_URL',
  'SEED_CTP_CLIENT_ID',
  'SEED_CTP_CLIENT_SECRET',
] as const;

// ---------------------------------------------------------------- flags and env

export interface Flags {
  dryRun: boolean;
  /** `--include-customers`: the full reset also erases the synthetic customers (emails on example.com) and everything of theirs. */
  includeCustomers?: boolean;
  only?: string;
  confirm?: string;
}

export function parseFlags(argv: string[]): Flags {
  const get = (name: string) => {
    const i = argv.indexOf(name);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) throw new Error(`${name} needs a value`);
    return v;
  };
  return { dryRun: argv.includes('--dry-run'), includeCustomers: argv.includes('--include-customers'), only: get('--only'), confirm: get('--confirm') };
}

/** Parses KEY=value lines; a missing file gives an empty object. */
export function loadSeedEnv(file = path.resolve(process.cwd(), '.env.seed.local')): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

/** Values from the env file; process.env SEED_* variables fill what the file lacks. */
export function readSeedEnv(file?: string): Record<string, string | undefined> {
  const fromFile = loadSeedEnv(file);
  const out: Record<string, string | undefined> = { ...fromFile };
  for (const name of [...SEED_ENV_NAMES, 'SEED_CTP_SCOPES']) out[name] ??= process.env[name];
  return out;
}

export function missingEnv(env: Record<string, string | undefined>): string[] {
  return SEED_ENV_NAMES.filter((name) => !env[name]);
}

/** Throws before any network call unless the key is the seed project. */
export function assertProjectKey(key: string | undefined, where = 'SEED_CTP_PROJECT_KEY'): void {
  if (key !== PROJECT_KEY) {
    throw new Error(`Refusing to run: ${where} is "${key ?? ''}", the seed scripts only touch "${PROJECT_KEY}".`);
  }
}

/** Builds the admin client. Guards twice: the env key (no network) and the project the API reports. */
export async function getAdminRoot(env: Record<string, string | undefined> = readSeedEnv()): Promise<{ root: Root; projectKey: string }> {
  const missing = missingEnv(env);
  if (missing.length > 0) throw new Error(`Missing ${missing.join(', ')}. Copy .env.seed.example to .env.seed.local and fill it (OA-01).`);
  assertProjectKey(env.SEED_CTP_PROJECT_KEY);
  const projectKey = env.SEED_CTP_PROJECT_KEY as string;
  const builder = new ClientBuilder()
    .withProjectKey(projectKey)
    .withClientCredentialsFlow({
      host: env.SEED_CTP_AUTH_URL as string,
      projectKey,
      credentials: { clientId: env.SEED_CTP_CLIENT_ID as string, clientSecret: env.SEED_CTP_CLIENT_SECRET as string },
      ...(env.SEED_CTP_SCOPES ? { scopes: env.SEED_CTP_SCOPES.split(/[\s,]+/).filter(Boolean) } : {}),
    })
    .withHttpMiddleware({ host: env.SEED_CTP_API_URL as string });
  const root = createApiBuilderFromCtpClient(builder.build()).withProjectKey({ projectKey });
  await assertProject(root);
  return { root, projectKey };
}

/** Reads the project and refuses unless its key is the seed project. */
export async function assertProject(root: Root): Promise<void> {
  const project = (await root.get().execute()).body;
  assertProjectKey(project.key, 'the project reported by the API');
}

export function isMain(file: string): boolean {
  return path.resolve(process.argv[1] ?? '') === path.resolve(file);
}

// ---------------------------------------------------------------- pacing and retry

export interface Ctx {
  root: Root;
  dryRun: boolean;
  log: (line: string) => void;
  /** Injected by tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Pause after each write; keeps the project under the rate limit. */
  pauseMs?: number;
}

export const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function makeCtx(root: Root, flags: { dryRun: boolean }, log: (line: string) => void = console.log): Ctx {
  return { root, dryRun: flags.dryRun, log, pauseMs: 50 };
}

/** Retries on HTTP 429 (honouring Retry-After when present), up to `tries` attempts. */
export async function withRetry<T>(fn: () => Promise<T>, sleep: (ms: number) => Promise<void> = realSleep, tries = 5): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      const err = e as { statusCode?: number; headers?: Record<string, string> };
      if (err.statusCode !== 429 || attempt >= tries) throw e;
      const retryAfter = Number(err.headers?.['retry-after']);
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt);
    }
  }
}

const pause = (ctx: Ctx) => (ctx.pauseMs ? (ctx.sleep ?? realSleep)(ctx.pauseMs) : Promise.resolve());

// ---------------------------------------------------------------- upsert-by-key helpers

export type EnsureResult = 'created' | 'updated' | 'ok' | 'would-create' | 'would-update' | { diff: string };

/** A resource collection of the SDK reduced to what the seed uses (keeps the SDK's generics out of the scripts). */
interface Coll {
  get(a?: { queryArgs?: Rec }): { execute(): Promise<{ body: { results: Rec[]; total?: number } }> };
  post(a: { body: unknown }): { execute(): Promise<{ body: Rec }> };
  withId(a: { ID: string }): {
    post(a: { body: unknown }): { execute(): Promise<{ body: Rec }> };
    delete(a: { queryArgs: Rec }): { execute(): Promise<{ body: Rec }> };
  };
  withKey(a: { key: string }): {
    get(a?: { queryArgs?: Rec }): { execute(): Promise<{ body: Rec }> };
    post(a: { body: unknown }): { execute(): Promise<{ body: Rec }> };
    delete(a: { queryArgs: Rec }): { execute(): Promise<{ body: Rec }> };
  };
}

export const KINDS = [
  'carts',
  'orders',
  'inventory',
  'products',
  'categories',
  'productTypes',
  'shippingMethods',
  'taxCategories',
  'stores',
  'zones',
  'states',
  'types',
  'channels',
] as const;
/** `customers` is listed and counted but never deleted by the cleanup (see E-questions.md). */
export type Kind = (typeof KINDS)[number] | 'customers' | 'reviews' | 'recurrencePolicies' | 'recurringOrders';

export const coll = (root: Root, kind: Kind): Coll => (root as unknown as Record<Kind, () => Coll>)[kind].call(root);

export async function findByKey(root: Root, kind: Kind, key: string): Promise<Rec | null> {
  try {
    return (await withRetry(() => coll(root, kind).withKey({ key }).get().execute())).body;
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

/** Create-if-missing; an existing resource is compared and a difference is reported (never overwritten). */
export async function ensureKeyed(ctx: Ctx, kind: Kind, draft: Rec & { key: string }, diff: (existing: Rec, draft: Rec) => string | null = () => null): Promise<EnsureResult> {
  const existing = await findByKey(ctx.root, kind, draft.key);
  if (!existing) {
    if (ctx.dryRun) return 'would-create';
    await withRetry(() => coll(ctx.root, kind).post({ body: draft }).execute(), ctx.sleep);
    await pause(ctx);
    return 'created';
  }
  const d = diff(existing, draft);
  return d ? { diff: `${kind} ${draft.key}: ${d}` } : 'ok';
}

/** What `ensurePlanned` asks of a plan function: update actions, or `blocked` when the change cannot be made in place. */
export type Planner = (existing: Rec, draft: Rec, ctx: Ctx) => { actions: Rec[]; blocked?: string } | Promise<{ actions: Rec[]; blocked?: string }>;

/**
 * Create-if-missing, otherwise UPDATE the existing resource to match the draft (D-038). The plan returns the update actions;
 * a change commercetools forbids comes back as `blocked` with the exact reset that is needed (reported like a diff).
 */
export async function ensurePlanned(ctx: Ctx, kind: Kind, draft: Rec & { key: string }, plan: Planner): Promise<EnsureResult> {
  const existing = await findByKey(ctx.root, kind, draft.key);
  if (!existing) return ensureKeyed(ctx, kind, draft);
  const p = await plan(existing, draft, ctx);
  if (p.blocked) return { diff: p.blocked };
  if (p.actions.length === 0) return 'ok';
  if (ctx.dryRun) return 'would-update';
  await applyActions(ctx, kind, draft.key, p.actions);
  return 'updated';
}

/** Posts update actions to a keyed resource (read fresh for the version). */
export async function applyActions(ctx: Ctx, kind: Kind, key: string, actions: Rec[]): Promise<void> {
  const current = await findByKey(ctx.root, kind, key);
  if (!current) throw new Error(`${kind} ${key} not found`);
  await withRetry(() => coll(ctx.root, kind).withKey({ key }).post({ body: { version: current.version, actions } }).execute(), ctx.sleep);
  await pause(ctx);
}

// ---------------------------------------------------------------- diff functions

const sortedJson = (xs: unknown[]) => JSON.stringify([...xs].map((x) => JSON.stringify(x)).sort());

/** Only the listed keys, JSON-equal. */
export function pickDiff(existing: Rec, wanted: Rec, keys: string[]): string | null {
  for (const key of keys) {
    if (JSON.stringify(existing[key] ?? null) !== JSON.stringify(wanted[key] ?? null)) {
      return `"${key}" differs (existing ${JSON.stringify(existing[key] ?? null)}, wanted ${JSON.stringify(wanted[key] ?? null)})`;
    }
  }
  return null;
}

export const diffType = (e: Rec, d: Rec): string | null => {
  const defs = (r: Rec) => ((r.fieldDefinitions as { name: string; type: unknown }[]) ?? []).map((f) => [f.name, f.type]);
  if (sortedJson(defs(e)) !== sortedJson(defs(d))) return 'field definitions differ';
  return sortedJson((e.resourceTypeIds as string[]) ?? []) === sortedJson((d.resourceTypeIds as string[]) ?? []) ? null : 'resourceTypeIds differ';
};

export const diffProductType = (e: Rec, d: Rec): string | null => {
  const names = (r: Rec) => ((r.attributes as { name: string; type: { name: string } }[]) ?? []).map((a) => `${a.name}:${a.type.name}`).sort();
  return JSON.stringify(names(e)) === JSON.stringify(names(d)) ? null : `attributes differ (existing ${names(e).join(',')}; wanted ${names(d).join(',')})`;
};

export const diffTax = (e: Rec, d: Rec): string | null => {
  const norm = (r: Rec) => sortedJson(((r.rates as { country: string; amount: number }[]) ?? []).map((x) => [x.country, x.amount]));
  return norm(e) === norm(d) ? null : 'rates differ';
};

export const diffZone = (e: Rec, d: Rec): string | null => {
  const norm = (r: Rec) => sortedJson(((r.locations as { country: string; state?: string }[]) ?? []).map((l) => [l.country, l.state ?? null]));
  return norm(e) === norm(d) ? null : 'locations differ';
};

type ZoneRate = { shippingRates: { price: { centAmount: number; currencyCode: string }; freeAbove?: { centAmount: number } }[] };
/** A stored zone rate references the zone by id only, so the zone is not compared here; the rates (cents) and the default flag are. */
export const diffShipping = (e: Rec, d: Rec): string | null => {
  const flat = (r: Rec) => sortedJson(((r.zoneRates as ZoneRate[]) ?? []).flatMap((z) => z.shippingRates.map((s) => [s.price.centAmount, s.price.currencyCode, s.freeAbove?.centAmount ?? null])));
  if (e.isDefault !== d.isDefault) return `isDefault differs (existing ${String(e.isDefault)}, wanted ${String(d.isDefault)})`;
  return flat(e) === flat(d) ? null : 'zone rates differ (check the cents)';
};

export const diffNames = (e: Rec, d: Rec): string | null => pickDiff(e, d, ['name']);

type Variant = { sku?: string; prices?: { value: { centAmount: number; currencyCode: string } }[] };
const masterOf = (e: Rec): Variant => ((e.masterData as { staged?: { masterVariant?: Variant } } | undefined)?.staged?.masterVariant ?? {});

/** Products are not rewritten; the SKU and the prices (cents per currency) are compared so a wrong fee or price is reported. */
export const diffProduct = (e: Rec, d: Rec): string | null => {
  const want = d.masterVariant as Variant;
  const have = masterOf(e);
  if (have.sku !== want.sku) return `sku ${String(have.sku)} differs from ${String(want.sku)}`;
  const prices = (v: Variant) => sortedJson((v.prices ?? []).map((p) => [p.value.currencyCode, p.value.centAmount]));
  return prices(have) === prices(want) ? null : 'prices differ';
};

// ---------------------------------------------------------------- inventory (keyed by `mlv-inv-<sku>`)

export interface InventoryWanted { sku: string; quantityOnStock: number; maxCartQuantity?: number; custom?: Rec }

export const inventoryKey = (sku: string) => `${PREFIX}inv-${sku}`;

export const inventoryDraft = (w: InventoryWanted): Rec & { key: string } => ({
  key: inventoryKey(w.sku),
  sku: w.sku,
  quantityOnStock: w.quantityOnStock,
  ...(w.maxCartQuantity !== undefined ? { maxCartQuantity: w.maxCartQuantity } : {}),
  ...(w.custom ? { custom: w.custom } : {}),
});

/** Existing stock is not reset (orders consume it); only the limit and the expiry field are compared. */
export const diffInventory = (e: Rec, d: Rec): string | null => {
  if ((e.maxCartQuantity ?? null) !== (d.maxCartQuantity ?? null)) return `maxCartQuantity ${String(e.maxCartQuantity ?? null)} differs from ${String(d.maxCartQuantity ?? null)}`;
  const exp = (r: Rec) => ((r.custom as { fields?: Rec } | undefined)?.fields?.expiryDate ?? null);
  return exp(e) === exp(d) ? null : 'expiryDate differs';
};

// ---------------------------------------------------------------- running steps

export interface Step { name: string; run: () => Promise<EnsureResult> }

export interface RunSummary { ok: boolean; changed: number; total: number }

/** Runs the steps in order; stops at the first difference. `changed` counts created/updated/would-*. */
export async function runSteps(steps: Step[], log: (line: string) => void = console.log): Promise<RunSummary> {
  let changed = 0;
  for (let i = 0; i < steps.length; i += 1) {
    let result: Awaited<ReturnType<Step['run']>>;
    try {
      result = await steps[i].run();
    } catch (e) {
      // name the step: the platform's message alone ("Request body does not contain valid JSON.") does not say which resource it was
      const status = (e as { statusCode?: number }).statusCode;
      throw new Error(`step "${steps[i].name}" failed${status ? ` (HTTP ${status})` : ''}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
    if (typeof result === 'object') {
      log(`STOP     ${steps[i].name}: ${result.diff}`);
      return { ok: false, changed, total: i };
    }
    if (result !== 'ok') changed += 1;
    log(`${result.padEnd(12)} ${steps[i].name}`);
  }
  return { ok: true, changed, total: steps.length };
}

// ---------------------------------------------------------------- listing

/** Every resource of a kind (pages of 200; `total` is not requested). */
export async function listAll(root: Root, kind: Kind, where?: string): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = (await withRetry(() => coll(root, kind).get({ queryArgs: { limit: 200, offset, ...(where ? { where } : {}) } }).execute())).body.results;
    out.push(...page);
    if (page.length < 200) return out;
  }
}

export const hasPrefix = (r: Rec): boolean => typeof r.key === 'string' && r.key.startsWith(PREFIX);
