import 'server-only';

/**
 * Development-only state for the account pages of workstream T (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts): saved
 * lists, auto-refill and saved payment methods without commercetools or a payment service. Never loaded in
 * production. State lives on `globalThis` because route handlers and pages are separate bundles in `next dev`.
 * Nothing here is a model of the platform beyond what the T modules call.
 */

interface Store {
  lists: Map<string, Record<string, unknown>>;
  seq: number;
}
const g = globalThis as unknown as { __malvaAccountFixtures?: Store };
const store = (): Store => (g.__malvaAccountFixtures ??= { lists: new Map(), seq: 0 });

const err = (statusCode: number) => Object.assign(new Error(String(statusCode)), { statusCode });
const now = () => new Date().toISOString();

type Rec = Record<string, unknown> & { id: string; version: number };

// ---------------------------------------------------------------- shopping lists

const SKU_NAMES: Record<string, string> = {};

function nameOfSku(sku: string): Record<string, string> {
  return { 'en-US': SKU_NAMES[sku] ?? sku };
}

/** Lets the fixture list know a product's display name (set by the caller that resolved it from the seed data). */
export function rememberSkuName(sku: string, name: string): void {
  SKU_NAMES[sku] = name;
}

function materializeLine(raw: { sku: string; quantity?: number; custom?: unknown }): Record<string, unknown> {
  const s = store();
  s.seq += 1;
  return { id: `fixture-line-${s.seq}`, productId: `fixture-product-${raw.sku}`, name: nameOfSku(raw.sku), variant: { id: 1, sku: raw.sku }, quantity: raw.quantity ?? 1, custom: raw.custom, addedAt: now() };
}

function applyListAction(list: Rec, a: Record<string, unknown>): void {
  const lines = list.lineItems as Record<string, unknown>[];
  if (a.action === 'addLineItem') lines.push(materializeLine(a as { sku: string }));
  else if (a.action === 'removeLineItem') list.lineItems = lines.filter((l) => l.id !== a.lineItemId);
  else if (a.action === 'changeName') list.name = a.name;
  else throw err(400);
}

/** A minimal `apiRoot.shoppingLists()` (get by id/key, query by customer, create, update, delete). */
export const fakeListsRoot = {
  shoppingLists: () => ({
    get: (a: { queryArgs?: Record<string, unknown> } = {}) => ({
      execute: async () => {
        const id = a.queryArgs?.['var.id'];
        const results = [...store().lists.values()].filter((l) => (l.customer as { id: string }).id === id).sort((x, y) => String(y.lastModifiedAt).localeCompare(String(x.lastModifiedAt)));
        return { body: { results, count: results.length, limit: 100, offset: 0 } };
      },
    }),
    post: (a: { body: Record<string, unknown> }) => ({
      execute: async () => {
        const s = store();
        if ([...s.lists.values()].some((l) => l.key === a.body.key)) throw err(400);
        s.seq += 1;
        const list: Rec = { id: `fixture-list-${s.seq}`, version: 1, createdAt: now(), lastModifiedAt: now(), ...structuredClone(a.body), lineItems: [] } as Rec;
        for (const raw of (a.body.lineItems as { sku: string }[] | undefined) ?? []) (list.lineItems as unknown[]).push(materializeLine(raw));
        s.lists.set(list.id, list);
        return { body: structuredClone(list) };
      },
    }),
    withKey: ({ key }: { key: string }) => one(() => [...store().lists.values()].find((l) => l.key === key)),
    withId: ({ ID }: { ID: string }) => one(() => store().lists.get(ID)),
  }),
};

function one(find: () => Record<string, unknown> | undefined) {
  const need = () => (find() as Rec | undefined) ?? (() => { throw err(404); })();
  return {
    get: () => ({ execute: async () => ({ body: structuredClone(need()) }) }),
    post: (a: { body: { version: number; actions: Record<string, unknown>[] } }) => ({
      execute: async () => {
        const list = need();
        if (a.body.version !== list.version) throw err(409);
        for (const action of a.body.actions) applyListAction(list, action);
        list.version += 1;
        list.lastModifiedAt = now();
        return { body: structuredClone(list) };
      },
    }),
    delete: (a: { queryArgs: { version: number } }) => ({
      execute: async () => {
        const list = need();
        if (a.queryArgs.version !== list.version) throw err(409);
        store().lists.delete(list.id);
        return { body: structuredClone(list) };
      },
    }),
  };
}

export function resetAccountFixtures(): void {
  g.__malvaAccountFixtures = undefined;
}
