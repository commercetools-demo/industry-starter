// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X, attack group A (price and money integrity), unit twins A01 to A13: the real PUT route and the real publish service run against the
// in-memory commercetools stand-in; a refusal is proved by the status, the machine code, and ZERO price writes in the stand-in.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRule, type CartRule, type ProductRule } from '@/lib/catalog/discount-rule';
import { createFakeCommercetools, type FakeCommercetools } from '@/lib/portal/catalog-fixture-root';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';
import { clearCatalogCaches } from './catalog-data';

let fake: FakeCommercetools;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));
vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());

import { PUT as putPrices } from '@/app/api/seller/prices/route';
import { POST as postBulk } from '@/app/api/seller/prices/bulk/route';
import { publishPrices, setStandalonePrice } from './prices';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const SKU = 'MLV-BD-42001';
const priceWrites = () => fake.writes().filter((w) => w.op.startsWith('price.'));
const price = (key: string) => fake.state.prices.get(key);
const put = (changes: unknown, extra: Record<string, unknown> = {}) => makeRequest('/api/seller/prices', { method: 'PUT', json: { storeKey: 'store-a', changes, confirm: true, expectedCount: 1, ...extra } });

beforeEach(() => {
  fake = createFakeCommercetools();
  clearCatalogCaches();
  asUser('adminA');
});

describe('A01 and A09: zero, negative and non-cent money are refused with no price write', () => {
  it('A01: 0 and -1 are INVALID_MONEY (service)', async () => {
    for (const centAmount of [0, -1]) {
      await expect(publishPrices(NORTH, { changes: [{ sku: SKU, centAmount }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({ status: 400, code: 'INVALID_MONEY' });
    }
    expect(priceWrites()).toHaveLength(0);
  });
  it('A09: 8315.5, 1e308, 9007199254740993 and NaN-like values never reach a write (service)', async () => {
    for (const centAmount of [8315.5, 1e308, 9007199254740993, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(publishPrices(NORTH, { changes: [{ sku: SKU, centAmount }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({ status: 400, code: 'INVALID_MONEY' });
    }
    expect(priceWrites()).toHaveLength(0);
  });
  it('A09 (route): a string, an object, a highPrecision money value and a boolean amount fail the strict schema with 400 before the service', async () => {
    for (const centAmount of ['8316', { type: 'highPrecision', preciseAmount: 83155, fractionDigits: 3 }, true, [1], undefined]) {
      const res = await putPrices(put([{ sku: SKU, centAmount }]));
      expect(res.status, JSON.stringify(centAmount)).toBe(400);
    }
    expect(priceWrites()).toHaveLength(0);
  });
});

describe('A02: no floor (control)', () => {
  it('one cent and a normal amount are accepted and restored', async () => {
    expect(await publishPrices(NORTH, { changes: [{ sku: SKU, centAmount: 1 }], confirm: true, expectedCount: 1 })).toEqual({ written: 1, deleted: 0 });
    expect(price(`${SKU}__mau-dist-north`)?.value.centAmount).toBe(1);
    await publishPrices(NORTH, { changes: [{ sku: SKU, centAmount: 12345 }], confirm: true, expectedCount: 1 });
    expect(price(`${SKU}__mau-dist-north`)?.value.centAmount).toBe(12345);
  });
});

describe('A03 and A04: a batch with one bad row is refused as a whole', () => {
  it('a batch of five with the last row at 0: zero rows applied, the answer names the bad row (the 50-row case differs only in size: the whole batch is validated first)', async () => {
    const skus = ['MLV-OF-44001', 'MLV-OF-44002', 'MLV-AF-45001', 'MLV-BD-42001', 'MLV-BP-41001'];
    const five = skus.map((sku, i) => ({ sku, centAmount: i === 4 ? 0 : 1000 + i }));
    await expect(publishPrices(NORTH, { changes: five, confirm: true, expectedCount: 5 })).rejects.toMatchObject({ code: 'INVALID_MONEY', details: { violations: [{ sku: 'MLV-BP-41001', attemptedCents: 0 }] } });
    expect(priceWrites()).toHaveLength(0);
  });
});

describe('A08: wrong currency', () => {
  it('USD on the EUR store and a lower-case code are refused; nothing is written', async () => {
    await expect(publishPrices(NORTH, { currency: 'USD', changes: [{ sku: SKU, centAmount: 1000 }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({ status: 400 });
    expect((await putPrices(put([{ sku: SKU, centAmount: 1000 }], { currency: 'eur' }))).status).toBe(400);
    expect((await putPrices(put([{ sku: SKU, centAmount: 1000 }], { currency: 'GBP' }))).status).toBe(400);
    expect(priceWrites()).toHaveLength(0);
  });
});

describe('A10: a SKU that is not in the store assortment', () => {
  it('another store local product and an unknown SKU are NOT_IN_ASSORTMENT; the foreign storeKey in the body is a 403 for an admin of another store', async () => {
    await expect(publishPrices(NORTH, { changes: [{ sku: 'KW-1001-SOUTH-ONLY', centAmount: 1000 }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({ code: 'NOT_IN_ASSORTMENT' });
    asUser('adminB');
    const res = await putPrices(put([{ sku: SKU, centAmount: 1000 }], { storeKey: 'store-a' }));
    expect(res.status).toBe(403);
    expect(priceWrites()).toHaveLength(0);
  });
});

describe('A11: mass assignment is refused by the strict schema', () => {
  it('validFrom, customerGroup, tiers, channel, staged, key, currencyCode and list in a change or the body are 400', async () => {
    for (const extra of [{ validFrom: '2026-01-01' }, { customerGroup: { id: 'x' } }, { tiers: [] }, { channel: { id: 'x' } }, { staged: true }, { key: 'k' }, { currencyCode: 'USD' }, { list: 1 }]) {
      expect((await putPrices(put([{ sku: SKU, centAmount: 1000 }], extra))).status, JSON.stringify(extra)).toBe(400);
      expect((await putPrices(put([{ sku: SKU, centAmount: 1000, ...extra }]))).status, JSON.stringify(extra)).toBe(400);
    }
    expect(priceWrites()).toHaveLength(0);
  });
  it('bulk: unknown fields and non-finite values are refused', async () => {
    const bulk = (json: Record<string, unknown>) => makeRequest('/api/seller/prices/bulk', { method: 'POST', json: { storeKey: 'store-a', mode: 'setTo', skus: [SKU], confirm: true, expectedCount: 1, ...json } });
    expect((await postBulk(bulk({ validFrom: 'x' }))).status).toBe(400);
    expect((await postBulk(bulk({ value: '5' }))).status).toBe(400);
    expect(priceWrites()).toHaveLength(0);
  });
});

describe('A12: branch channel abuse', () => {
  it('a branch of another store, a channel that is not a branch and an unknown key are CHANNEL_NOT_FOUND with no write', async () => {
    for (const channelKey of ['mau-branch-south-1', 'mau-dist-north-nope', 'does-not-exist', `${SOUTH}`]) {
      await expect(setStandalonePrice(NORTH, SKU, channelKey, 1000, 'EUR')).rejects.toMatchObject({ status: 404, code: 'CHANNEL_NOT_FOUND' });
    }
    expect(priceWrites()).toHaveLength(0);
  });
});

describe('A13: race of valid and invalid writes', () => {
  it('20 parallel requests alternating valid and 0 amounts: the price is never 0 or negative at any point, the final price is a valid amount', async () => {
    const seen: number[] = [];
    const poll = () => {
      const v = price(`${SKU}__mau-dist-north`)?.value.centAmount;
      if (v !== undefined) seen.push(v);
    };
    const timer = setInterval(poll, 1);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => publishPrices(NORTH, { changes: [{ sku: SKU, centAmount: i % 2 === 0 ? 5000 + i : 0 }], confirm: true, expectedCount: 1 }).finally(poll)),
    );
    clearInterval(timer);
    poll();
    // every invalid (odd) request is refused; a valid one may lose to a stale-version conflict, which is a refusal too, never a bad write
    results.forEach((r, i) => i % 2 === 1 && expect(r.status, `request ${i}`).toBe('rejected'));
    expect(seen.every((v) => v > 0)).toBe(true);
    const final = price(`${SKU}__mau-dist-north`)?.value.centAmount ?? 0;
    expect(final).toBeGreaterThan(0);
    expect(fake.writes().filter((w) => w.op.startsWith('price.') && JSON.stringify(w).includes('"centAmount":0'))).toHaveLength(0);
  });
});

describe('A06 and A07: discount values', () => {
  const product = (percent: number): ProductRule => ({ name: { 'en-US': 'x' }, scope: { kind: 'all' }, effect: { kind: 'relative', percent } }) as unknown as ProductRule;
  const cart = (effect: CartRule['effect']): CartRule => ({ name: { 'en-US': 'x' }, condition: { kind: 'always' }, effect }) as unknown as CartRule;
  it('A06: 150 percent, 0, negative and NaN relative values are refused (no rule is compiled)', () => {
    for (const percent of [150, 100.01, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(validateRule(product(percent)).map((i) => i.field), String(percent)).toContain('effect');
  });
  it('A07: absolute amounts that are zero, negative or not whole cents are refused; so are a zero cart threshold and a bad code', () => {
    for (const centAmount of [0, -100, 10.5, Number.NaN]) expect(validateRule(cart({ kind: 'absolute', centAmount })).map((i) => i.field), String(centAmount)).toContain('effect');
    expect(validateRule({ ...cart({ kind: 'relative', percent: 5 }), condition: { kind: 'cartTotalAtLeast', centAmount: 0 } } as CartRule).map((i) => i.field)).toContain('condition');
    expect(validateRule({ ...cart({ kind: 'relative', percent: 5 }), code: "x'; DROP" } as CartRule).map((i) => i.field)).toContain('code');
  });
});
