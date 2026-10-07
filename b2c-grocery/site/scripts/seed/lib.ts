import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ClientBuilder } from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';

export type EnsureResult = 'created' | 'ok' | { diff: string };

export interface EnsureOptions<T> {
  find: () => Promise<T | null>;
  create: () => Promise<unknown>;
  /** Returns a description of the difference, or null when equal. */
  diff: (existing: T) => string | null;
}

/** Create-if-missing; report "ok" when equal; return the difference (never overwrite) otherwise. */
export async function ensureResource<T>(opts: EnsureOptions<T>): Promise<EnsureResult> {
  const existing = await opts.find();
  if (!existing) {
    await opts.create();
    return 'created';
  }
  const diff = opts.diff(existing);
  return diff ? { diff } : 'ok';
}

/** Tiny structural comparison used by the ensure helpers: only the listed keys, JSON-equal. */
export function pickDiff(label: string, existing: Record<string, unknown>, wanted: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (JSON.stringify(existing[key] ?? null) !== JSON.stringify(wanted[key] ?? null)) {
      return `${label}: "${key}" differs (existing ${JSON.stringify(existing[key] ?? null)}, wanted ${JSON.stringify(wanted[key] ?? null)})`;
    }
  }
  return null;
}

export type Root = ByProjectKeyRequestBuilder;

const byKey = async <T>(call: () => Promise<{ body: T }>): Promise<T | null> => {
  try {
    return (await call()).body;
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
};

type Draft = Record<string, unknown> & { key: string };

export const ensureType = (root: Root, draft: Draft) =>
  ensureResource<Record<string, unknown>>({
    find: () => byKey(() => root.types().withKey({ key: draft.key }).get().execute()) as Promise<Record<string, unknown> | null>,
    create: () => root.types().post({ body: draft as never }).execute(),
    diff: (e) => {
      const have = JSON.stringify(((e.fieldDefinitions as { name: string; type: unknown }[]) ?? []).map((f) => [f.name, f.type]).sort());
      const want = JSON.stringify(((draft.fieldDefinitions as { name: string; type: unknown }[]) ?? []).map((f) => [f.name, f.type]).sort());
      return have === want && JSON.stringify([...(e.resourceTypeIds as string[])].sort()) === JSON.stringify([...(draft.resourceTypeIds as string[])].sort())
        ? null
        : `type ${draft.key}: field definitions or resourceTypeIds differ`;
    },
  });

export const ensureProductType = (root: Root, draft: Draft) =>
  ensureResource<Record<string, unknown>>({
    find: () => byKey(() => root.productTypes().withKey({ key: draft.key }).get().execute()) as Promise<Record<string, unknown> | null>,
    create: () => root.productTypes().post({ body: draft as never }).execute(),
    diff: (e) => {
      const have = ((e.attributes as { name: string; type: { name: string } }[]) ?? []).map((a) => `${a.name}:${a.type.name}`).sort();
      const want = ((draft.attributes as { name: string; type: { name: string } }[]) ?? []).map((a) => `${a.name}:${a.type.name}`).sort();
      return JSON.stringify(have) === JSON.stringify(want) ? null : `product type ${draft.key}: attributes differ (existing ${have.join(',')}; wanted ${want.join(',')})`;
    },
  });

export const ensureCategory = (root: Root, draft: Draft) =>
  ensureResource<Record<string, unknown>>({
    find: () => byKey(() => root.categories().withKey({ key: draft.key }).get().execute()) as Promise<Record<string, unknown> | null>,
    create: () => root.categories().post({ body: draft as never }).execute(),
    diff: (e) => pickDiff(`category ${draft.key}`, e, draft, ['name', 'slug']),
  });

export const ensureTaxCategory = (root: Root, draft: Draft) =>
  ensureResource<Record<string, unknown>>({
    find: () => byKey(() => root.taxCategories().withKey({ key: draft.key }).get().execute()) as Promise<Record<string, unknown> | null>,
    create: () => root.taxCategories().post({ body: draft as never }).execute(),
    diff: (e) => {
      const norm = (rs: unknown) => JSON.stringify(((rs as { country: string; amount: number }[]) ?? []).map((r) => [r.country, r.amount]).sort());
      return norm(e.rates) === norm(draft.rates) ? null : `tax category ${draft.key}: rates differ`;
    },
  });

export const ensureZone = (root: Root, draft: Draft) =>
  ensureResource<Record<string, unknown>>({
    find: () => byKey(() => root.zones().withKey({ key: draft.key }).get().execute()) as Promise<Record<string, unknown> | null>,
    create: () => root.zones().post({ body: draft as never }).execute(),
    diff: (e) => {
      const norm = (ls: unknown) => JSON.stringify(((ls as { country: string }[]) ?? []).map((l) => l.country).sort());
      return norm(e.locations) === norm(draft.locations) ? null : `zone ${draft.key}: locations differ`;
    },
  });

export const ensureShippingMethod = (root: Root, draft: Draft) =>
  ensureResource<Record<string, unknown>>({
    find: () => byKey(() => root.shippingMethods().withKey({ key: draft.key }).get().execute()) as Promise<Record<string, unknown> | null>,
    create: () => root.shippingMethods().post({ body: draft as never }).execute(),
    diff: (e) => pickDiff(`shipping method ${draft.key}`, e, draft, ['name']),
  });

export const ensureRecurrencePolicy = (root: Root, draft: Draft) =>
  ensureResource<Record<string, unknown>>({
    find: () => byKey(() => root.recurrencePolicies().withKey({ key: draft.key }).get().execute()) as Promise<Record<string, unknown> | null>,
    create: () => root.recurrencePolicies().post({ body: draft as never }).execute(),
    diff: (e) => pickDiff(`recurrence policy ${draft.key}`, e, draft, ['schedule']),
  });

export const ensureProduct = (root: Root, draft: Draft) =>
  ensureResource<Record<string, unknown>>({
    find: () => byKey(() => root.products().withKey({ key: draft.key }).get().execute()) as Promise<Record<string, unknown> | null>,
    create: () => root.products().post({ body: draft as never }).execute(),
    diff: () => null,
  });

export const ensureInventory = (root: Root, sku: string, quantityOnStock: number) =>
  ensureResource<Record<string, unknown>>({
    find: async () => {
      const res = await root.inventory().get({ queryArgs: { where: `sku="${sku}"`, limit: 1 } }).execute();
      return (res.body.results[0] as unknown as Record<string, unknown>) ?? null;
    },
    create: () => root.inventory().post({ body: { sku, quantityOnStock } }).execute(),
    diff: (e) => (e.quantityOnStock === quantityOnStock ? null : `inventory ${sku}: quantity ${String(e.quantityOnStock)} differs from ${quantityOnStock}`),
  });

/** Runs the steps in order; stops at the first difference (exit 1 in the CLI). */
export async function runSteps(steps: { name: string; run: () => Promise<EnsureResult> }[], log: (line: string) => void = console.log): Promise<boolean> {
  for (const step of steps) {
    const result = await step.run();
    if (typeof result === 'object') {
      log(`STOP  ${step.name}: ${result.diff}`);
      return false;
    }
    log(`${result.padEnd(7)} ${step.name}`);
  }
  return true;
}

export function loadSeedEnv(file = path.resolve(process.cwd(), '.env.seed')): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

export function getAdminRoot(env: Record<string, string | undefined> = loadSeedEnv()): { root: Root; projectKey: string } {
  const need = (k: string) => {
    const v = env[k];
    if (!v) throw new Error(`Missing ${k} in .env.seed`);
    return v;
  };
  const projectKey = need('CTP_SEED_PROJECT_KEY');
  const client = new ClientBuilder()
    .withProjectKey(projectKey)
    .withClientCredentialsFlow({
      host: need('CTP_SEED_AUTH_URL'),
      projectKey,
      credentials: { clientId: need('CTP_SEED_CLIENT_ID'), clientSecret: need('CTP_SEED_CLIENT_SECRET') },
    })
    .withHttpMiddleware({ host: need('CTP_SEED_API_URL') })
    .build();
  return { root: createApiBuilderFromCtpClient(client).withProjectKey({ projectKey }), projectKey };
}
