// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Ready-made coffee lines: the in-store line type, checked and sorted modifiers, and every path that copies or changes a line.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LineItem } from '@commercetools/platform-sdk';

const OAT = '572a1c72-24e1-4a96-a693-d022be0cd867';
const ALMOND = 'f8716393-8508-46cb-865a-7dac4731e22a';
const FOREIGN = 'b0b0b0b0-0000-4000-8000-000000000000';
const INTENSO = '6ffa00e9-1b2e-4cea-846f-8f045923fa49';
const ODACIO = '46619109-4f3c-4837-af97-1a13d63f8a8a';
const DRINK = 'MCF-RD-AMERICANO-SMALL';
const POD = 'MCF-POD-ORIGINAL-X';

const ct = vi.hoisted(() => ({
  carts: new Map<string, Record<string, unknown>>(),
  updates: [] as { id: string; actions: Record<string, unknown>[] }[],
  n: 0,
}));

type Obj = Record<string, unknown>;
const fieldsOf = (l: Obj) => (l.custom as { fields?: Obj } | undefined)?.fields ?? {};

// A small in-memory cart engine. Lines merge like the platform: same SKU, supply channel and custom fields.
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    carts: () => ({
      post: ({ body }: { body: Obj }) => ({
        execute: async () => {
          ct.n += 1;
          const cart = { id: `cart-${ct.n}`, version: 1, cartState: 'Active', lineItems: [], totalLineItemQuantity: 0, totalPrice: { centAmount: 0, currencyCode: 'USD' }, ...body };
          ct.carts.set(cart.id, cart);
          return { body: cart };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => ({ body: ct.carts.get(ID) }) }),
        post: ({ body }: { body: { version: number; actions: Obj[] } }) => ({
          execute: async () => {
            ct.updates.push({ id: ID, actions: body.actions });
            const c = ct.carts.get(ID) as { version: number; lineItems: Obj[] };
            let lines = [...c.lineItems];
            for (const a of body.actions) {
              if (a.action === 'addLineItem') {
                const twin = lines.find((l) =>
                  (l.variant as { sku: string }).sku === a.sku &&
                  (l.supplyChannel as { id?: string } | undefined)?.id === (a.supplyChannel as { id?: string } | undefined)?.id &&
                  JSON.stringify(fieldsOf(l)) === JSON.stringify(fieldsOf(a)));
                if (twin) {
                  lines = lines.map((l) => (l === twin ? { ...l, quantity: (l.quantity as number) + (a.quantity as number) } : l));
                  continue;
                }
                lines.push({
                  id: `li-${ct.n}-${lines.length + 1}`, quantity: a.quantity, variant: { sku: a.sku }, productId: 'p',
                  custom: { type: { typeId: 'type', id: (a.custom as { type: { key: string } }).type.key }, fields: fieldsOf(a) },
                  supplyChannel: a.supplyChannel,
                  price: { value: { centAmount: 325, currencyCode: 'USD' } }, totalPrice: { centAmount: 325, currencyCode: 'USD' },
                  name: { 'en-US': 'x' }, productSlug: { 'en-US': 'x' }, priceMode: 'Platform',
                  discountedPricePerQuantity: [], perMethodTaxRate: [], state: [],
                });
              }
              if (a.action === 'changeLineItemQuantity') lines = lines.map((l) => (l.id === a.lineItemId ? { ...l, quantity: a.quantity } : l));
              if (a.action === 'removeLineItem') lines = lines.filter((l) => l.id !== a.lineItemId);
              if (a.action === 'setLineItemSupplyChannel') lines = lines.map((l) => (l.id === a.lineItemId ? { ...l, supplyChannel: a.supplyChannel } : l));
              if (a.action === 'setLineItemCustomField') {
                lines = lines.map((l) => (l.id !== a.lineItemId ? l : { ...l, custom: { ...(l.custom as Obj), fields: { ...fieldsOf(l), [a.name as string]: a.value } } }));
              }
            }
            const next = { ...c, version: c.version + 1, lineItems: lines, totalLineItemQuantity: lines.reduce((n, l) => n + (l.quantity as number), 0) };
            ct.carts.set(ID, next);
            return { body: next };
          },
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/ct/product-detail', () => ({
  getProductBySku: async (sku: string) => (sku === DRINK
    ? { id: 'americano', productType: { obj: { key: 'mcf-ready-drink' } }, masterVariant: { sku }, variants: [] }
    : { id: 'p1', productType: { obj: { key: 'mcf-pods' } }, masterVariant: { sku }, variants: [] }),
  getRecurrencePolicies: async () => [],
  getRecurrencePolicyByKey: async () => null,
}));
vi.mock('@/lib/ct/drink-modifiers', () => ({ getDrinkChoiceIds: async () => ({ allowed: [OAT, ALMOND, INTENSO, ODACIO], flavorIds: [INTENSO, ODACIO] }) }));
vi.mock('@/lib/ct/product-selections', () => ({ getProductBrand: async () => 'malva-coffee' }));
vi.mock('@/lib/ct/preset-bundles', () => ({ getBundleView: async () => null }));
vi.mock('@/lib/ct/inventory', () => ({
  SKU_PATTERN: /^[A-Za-z0-9._-]{1,64}$/,
  getInventoryDetail: async (skus: string[]) => Object.fromEntries(skus.map((sku) => [sku, { online: 100, stores: {} }])),
  getStoreStock: async () => 100,
}));
vi.mock('@/lib/ct/channels', () => ({ getBrandChannelId: async () => undefined, getStoresForCountry: async () => [(await import('@/test/cart')).STORE_SOHO] }));
vi.mock('@/lib/ct/cart-enrich', async () => ({ getCartEnrichment: async () => (await import('@/lib/mappers/cart')).EMPTY_ENRICHMENT }));
vi.mock('@/lib/ct/order-type', () => ({ orderTypeCartActions: async () => [], withOrderType: async (d: unknown) => d }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));

import { addLine, buildAddLineAction, switchFulfilment } from '@/lib/ct/cart';
import { lineDraft, sameLine } from '@/lib/ct/checkout';
import { AppError } from '@/lib/errors';
import type { Session } from '@/lib/session';
import { STORE_SOHO } from '@/test/cart';

const MARKET = { country: 'US', currency: 'USD', locale: 'en-US' };
const session = () => ({ anonymousId: 'anon-1' }) as unknown as Session;
const linesOf = (s: Session) => (ct.carts.get(s.cartId as string) as { lineItems: LineItem[] }).lineItems;

beforeEach(() => {
  ct.carts.clear();
  ct.updates.length = 0;
});

describe('ready-made coffee: adding a drink', () => {
  it('writes the in-store line type with `fulfillment` and the sorted modifiers; the same set in another order is one line', async () => {
    const first = await addLine(session(), MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [OAT, ALMOND] });
    await addLine(first.session, MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [ALMOND, OAT] });
    const add = ct.updates[0].actions[0] as { custom: unknown };
    expect(add.custom).toEqual({
      type: { typeId: 'type', key: 'instore-lineitem-type' },
      fields: { fulfillment: 'delivery', modifiers: [OAT, ALMOND].sort().map((id) => ({ typeId: 'product', id })) },
    });
    const lines = linesOf(first.session);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });

  it('a drink without modifiers also takes the in-store line type, and is a different line from one with modifiers', async () => {
    const first = await addLine(session(), MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery' });
    await addLine(first.session, MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [OAT] });
    expect((ct.updates[0].actions[0] as { custom: unknown }).custom).toEqual({ type: { typeId: 'type', key: 'instore-lineitem-type' }, fields: { fulfillment: 'delivery' } });
    expect(linesOf(first.session)).toHaveLength(2);
  });

  it('refuses a modifier the drink does not offer, and modifiers on any other product', async () => {
    await expect(addLine(session(), MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [OAT, FOREIGN] }))
      .rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === 'validation_failed');
    await expect(addLine(session(), MARKET, { sku: POD, quantity: 1, fulfilment: 'delivery', modifiers: [OAT] }))
      .rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === 'validation_failed');
    expect(ct.updates).toHaveLength(0);
  });

  it('takes one pod flavor with the modifiers on the same line field, and refuses two flavors', async () => {
    const { session: bag } = await addLine(session(), MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [OAT, INTENSO] });
    const add = ct.updates[0].actions[0] as { custom: { fields: { modifiers: { id: string }[] } } };
    expect(add.custom.fields.modifiers.map((m) => m.id)).toEqual([OAT, INTENSO].sort());
    expect(linesOf(bag)).toHaveLength(1);
    await expect(addLine(session(), MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [INTENSO, ODACIO] }))
      .rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === 'validation_failed');
  });

  it('two flavors of the same drink are two lines', async () => {
    const first = await addLine(session(), MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [INTENSO] });
    await addLine(first.session, MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [ODACIO] });
    expect(linesOf(first.session)).toHaveLength(2);
  });

  it('other products keep the storefront line type', () => {
    expect(buildAddLineAction({ sku: POD, quantity: 1, fulfilment: 'delivery' }, { brand: 'malva-coffee' }).custom)
      .toEqual({ type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment: 'delivery', brand: 'malva-coffee' } });
  });
});

describe('ready-made coffee: changing and copying a drink line', () => {
  it('a switch to collect writes the in-store `fulfillment` field', async () => {
    const { session: bag } = await addLine(session(), MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [OAT] });
    const lineId = linesOf(bag)[0].id;
    await switchFulfilment(bag, MARKET, lineId, { fulfilment: 'collect', storeKey: STORE_SOHO.key });
    const set = ct.updates.flatMap((u) => u.actions).find((a) => a.action === 'setLineItemCustomField');
    expect(set).toMatchObject({ name: 'fulfillment', value: 'collect' });
    expect(linesOf(bag)[0].supplyChannel?.id).toBe(STORE_SOHO.id);
  });

  it('the checkout clone keeps the in-store line type and the modifiers, and tells drinks with other modifiers apart', async () => {
    const first = await addLine(session(), MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [OAT] });
    await addLine(first.session, MARKET, { sku: DRINK, quantity: 1, fulfilment: 'delivery', modifiers: [ALMOND] });
    const [oat, almond] = linesOf(first.session);
    expect(lineDraft(oat).custom).toEqual({
      type: { typeId: 'type', key: 'instore-lineitem-type' },
      fields: { fulfillment: 'delivery', modifiers: [{ typeId: 'product', id: OAT }] },
    });
    expect(sameLine(oat, oat)).toBe(true);
    expect(sameLine(oat, almond)).toBe(false);
  });
});
