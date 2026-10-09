import 'server-only';
import { fixtureMedicineBySku } from '@/lib/ct/doctors-fixtures';

/**
 * Development-only state for the account pages of workstream T (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts): saved
 * lists, auto-refill and saved payment methods without commercetools or a payment service. Never loaded in
 * production. State lives on `globalThis` because route handlers and pages are separate bundles in `next dev`.
 * Nothing here is a model of the platform beyond what the T modules call.
 */

type Rec = Record<string, unknown> & { id: string; version: number };

interface Store {
  lists: Map<string, Record<string, unknown>>;
  recurring: Map<string, Rec>;
  carts: Map<string, Rec>;
  seq: number;
}
const g = globalThis as unknown as { __malvaAccountFixtures?: Store };
const store = (): Store => (g.__malvaAccountFixtures ??= { lists: new Map(), recurring: new Map(), carts: new Map(), seq: 0 });

const err = (statusCode: number) => Object.assign(new Error(String(statusCode)), { statusCode });
const now = () => new Date().toISOString();


// ---------------------------------------------------------------- shopping lists

const SKU_NAMES: Record<string, string> = {};

function nameOfSku(sku: string): Record<string, string> {
  return { 'en-US': SKU_NAMES[sku] ?? fixtureMedicineBySku(sku)?.name ?? sku };
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

// ---------------------------------------------------------------- recurring orders (and their carts)

const POLICIES: Record<string, { type: 'standard'; intervalUnit: 'Months'; value: number }> = {
  'mlv-monthly': { type: 'standard', intervalUnit: 'Months', value: 1 },
  'mlv-quarterly': { type: 'standard', intervalUnit: 'Months', value: 3 },
};

function applyRecurringAction(ro: Rec, a: Record<string, unknown>): void {
  if (a.action === 'setRecurringOrderState') {
    const type = (a.recurringOrderState as { type: string }).type;
    ro.recurringOrderState = type === 'paused' ? 'Paused' : type === 'canceled' ? 'Canceled' : type === 'expired' ? 'Expired' : 'Active';
    if (ro.recurringOrderState !== 'Active') delete ro.nextOrderAt;
    else ro.nextOrderAt = ro.nextOrderAt ?? ro.startsAt;
  } else if (a.action === 'setSchedule') {
    const policy = POLICIES[(a.recurrencePolicy as { key: string }).key];
    if (!policy) throw err(400);
    ro.schedule = { ...policy };
  } else if (a.action === 'setOrderSkipConfiguration') {
    const draft = a.skipConfigurationInputDraft as { totalToSkip: number };
    const have = ro.skipConfiguration as { skipped: number } | undefined;
    ro.skipConfiguration = { type: 'Counter', totalToSkip: draft.totalToSkip, skipped: have?.skipped ?? 0 };
  } else throw err(400);
}

const withCart = (ro: Rec): Rec => ({ ...structuredClone(ro), cart: { typeId: 'cart', id: (ro.cart as { id: string }).id, obj: structuredClone(store().carts.get((ro.cart as { id: string }).id)) } }) as Rec;

/** A minimal `apiRoot.carts()` + `apiRoot.recurringOrders()` for the auto-refill module. */
export const fakeRecurringRoot = {
  carts: () => ({
    post: (a: { body: Record<string, unknown> }) => ({
      execute: async () => {
        const s = store();
        s.seq += 1;
        const lineItems = ((a.body.lineItems as Record<string, unknown>[]) ?? []).map((l) => {
          s.seq += 1;
          const sku = String(l.sku);
          return { id: `fixture-rline-${s.seq}`, name: nameOfSku(sku), variant: { sku }, quantity: l.quantity ?? 1, recurrenceInfo: l.recurrenceInfo, custom: l.custom };
        });
        const cart = { id: `fixture-rcart-${s.seq}`, version: 1, cartState: 'Active', origin: 'Customer', customerId: a.body.customerId, lineItems, totalPrice: { centAmount: 0, currencyCode: a.body.currency, fractionDigits: 2 } };
        s.carts.set(cart.id, cart);
        return { body: structuredClone(cart) };
      },
    }),
    withId: ({ ID }: { ID: string }) => ({
      get: () => ({ execute: async () => ({ body: structuredClone(store().carts.get(ID) ?? (() => { throw err(404); })()) }) }),
      post: (a: { body: { version: number; actions: Record<string, unknown>[] } }) => ({
        execute: async () => {
          const cart = store().carts.get(ID) as Rec | undefined;
          if (!cart) throw err(404);
          if (a.body.version !== cart.version) throw err(409);
          for (const action of a.body.actions) if (action.action === 'setRecurringPaymentConfiguration') cart.recurringPaymentConfiguration = { paymentStrategy: action.paymentStrategy, paymentAllocations: action.paymentAllocations };
          cart.version += 1;
          return { body: structuredClone(cart) };
        },
      }),
    }),
  }),
  recurringOrders: () => ({
    get: (a: { queryArgs?: Record<string, unknown> } = {}) => ({
      execute: async () => {
        const where = String(a.queryArgs?.where ?? '');
        const id = a.queryArgs?.['var.id'];
        let results = [...store().recurring.values()];
        if (where.startsWith('customer(')) results = results.filter((r) => (r.customer as { id: string }).id === id);
        if (where.startsWith('recurringOrderState=')) results = results.filter((r) => r.recurringOrderState === 'Active');
        return { body: { results: results.map(withCart), count: results.length, limit: 100, offset: 0 } };
      },
    }),
    post: (a: { body: Record<string, unknown> }) => ({
      execute: async () => {
        const s = store();
        const cartRef = a.body.cart as { id: string };
        const cart = s.carts.get(cartRef.id) as Rec | undefined;
        if (!cart) throw err(400);
        s.seq += 1;
        const policyKey = ((cart.lineItems as { recurrenceInfo?: { recurrencePolicy: { key: string } } }[])[0]?.recurrenceInfo?.recurrencePolicy.key) ?? 'mlv-monthly';
        cart.origin = 'RecurringOrder';
        cart.version += 1;
        const ro: Rec = {
          id: `fixture-ro-${s.seq}`,
          version: 1,
          key: a.body.key,
          cart: { typeId: 'cart', id: cart.id },
          customer: { typeId: 'customer', id: cart.customerId },
          startsAt: a.body.startsAt,
          nextOrderAt: a.body.startsAt,
          recurringOrderState: 'Active',
          schedule: { ...(POLICIES[policyKey] ?? POLICIES['mlv-monthly']!) },
          createdAt: now(),
        } as Rec;
        s.recurring.set(ro.id, ro);
        return { body: withCart(ro) };
      },
    }),
    withId: ({ ID }: { ID: string }) => ({
      get: () => ({ execute: async () => ({ body: withCart(store().recurring.get(ID) ?? (() => { throw err(404); })()) }) }),
      post: (a: { body: { version: number; actions: Record<string, unknown>[] } }) => ({
        execute: async () => {
          const ro = store().recurring.get(ID) as Rec | undefined;
          if (!ro) throw err(404);
          if (a.body.version !== ro.version) throw err(409);
          for (const action of a.body.actions) applyRecurringAction(ro, action);
          ro.version += 1;
          return { body: withCart(ro) };
        },
      }),
    }),
  }),
};

export function resetAccountFixtures(): void {
  g.__malvaAccountFixtures = undefined;
}
