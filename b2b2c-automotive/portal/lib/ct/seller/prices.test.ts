import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeCommercetools, type FakeCommercetools } from '@/lib/portal/catalog-fixture-root';
import { clearCatalogCaches } from './catalog-data';

let fake: FakeCommercetools;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));

import { getRetailPrice, listPrices, previewBulk, publishBulk, publishPrices, setStandalonePrice } from './prices';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';

beforeEach(() => {
  fake = createFakeCommercetools();
  clearCatalogCaches();
});

const priceWrites = () => fake.writes().filter((w) => w.op.startsWith('price.'));
const price = (key: string) => fake.state.prices.get(key);

describe('publishPrices', () => {
  it('price of 0 or negative: 400 INVALID_MONEY, zero writes', async () => {
    for (const centAmount of [0, -500, 9000.5]) {
      await expect(publishPrices(NORTH, { changes: [{ sku: 'MLV-BD-42001', centAmount }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_MONEY',
        details: { violations: [{ sku: 'MLV-BD-42001', attemptedCents: centAmount, code: 'INVALID_MONEY' }] },
      });
    }
    expect(priceWrites()).toHaveLength(0);
  });

  it('any price above zero is accepted, including a price far below the Malva list (no floor)', async () => {
    const result = await publishPrices(NORTH, { changes: [{ sku: 'MLV-OF-44001', centAmount: 129 }], confirm: true, expectedCount: 1 }); // 10% of the 12.90 list
    expect(result).toEqual({ written: 1, deleted: 0 });
    expect(priceWrites()).toHaveLength(1);
    expect(price('MLV-OF-44001__mau-dist-north')?.value.centAmount).toBe(129);
    await publishPrices(NORTH, { changes: [{ sku: 'MLV-OF-44002', centAmount: 1 }], confirm: true, expectedCount: 1 });
    expect(price('MLV-OF-44002__mau-dist-north')?.value.centAmount).toBe(1);
  });

  it('batch of 3 with 1 invalid: nothing written', async () => {
    await expect(
      publishPrices(NORTH, {
        changes: [
          { sku: 'MLV-OF-44001', centAmount: 1000 },
          { sku: 'MLV-OF-44002', centAmount: 0 },
          { sku: 'MLV-AF-45001', centAmount: 2000 },
        ],
        confirm: true,
        expectedCount: 3,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_MONEY' });
    expect(priceWrites()).toHaveLength(0);
  });

  it('order of checks: validation before the count confirmation (409 only for valid batches)', async () => {
    await expect(publishPrices(NORTH, { changes: [{ sku: 'MLV-OF-44001', centAmount: 0 }] })).rejects.toMatchObject({ status: 400 });
    await expect(publishPrices(NORTH, { changes: [{ sku: 'MLV-OF-44001', centAmount: 1000 }] })).rejects.toMatchObject({ status: 409, code: 'CONFIRMATION_REQUIRED', details: { count: 1 } });
    await expect(publishPrices(NORTH, { changes: [{ sku: 'MLV-OF-44001', centAmount: 1000 }], confirm: true, expectedCount: 2 })).rejects.toMatchObject({ status: 409 });
    expect(priceWrites()).toHaveLength(0);
  });

  it('blank input deletes the override; list price applies', async () => {
    const result = await publishPrices(NORTH, { changes: [{ sku: 'MLV-BP-41001', centAmount: null }], confirm: true, expectedCount: 1 });
    expect(result).toEqual({ written: 0, deleted: 1 });
    expect(price('MLV-BP-41001__mau-dist-north')).toBeUndefined();
    expect(price('MLV-BP-41001__base-eur-de')?.value.centAmount).toBe(9450); // Malva base price untouched
    expect(await getRetailPrice(NORTH, 'MLV-BP-41001')).toEqual({ centAmount: 9450, currencyCode: 'EUR' });
  });

  it('part not in assortment is rejected and price pending part is rejected', async () => {
    await expect(publishPrices(NORTH, { changes: [{ sku: 'MLV-EX-52001', centAmount: 1000 }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({ code: 'NOT_IN_ASSORTMENT' });
    await expect(publishPrices(NORTH, { changes: [{ sku: 'SK-2002', centAmount: 1000 }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({ code: 'NOT_IN_ASSORTMENT' });
    // an assigned part without a list price: pre-release part assigned to the store
    fake.state.selections.get('mau-sel-north')?.products.add(fake.ids.sku('MLV-BP-41099'));
    clearCatalogCaches();
    await expect(publishPrices(NORTH, { changes: [{ sku: 'MLV-BP-41099', centAmount: 1000 }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({ code: 'PRICE_PENDING' });
    expect(priceWrites()).toHaveLength(0);
  });

  it("the store's own item has no list price and can still be priced", async () => {
    await publishPrices(NORTH, { changes: [{ sku: 'KW-1001', centAmount: 5000 }], confirm: true, expectedCount: 1 });
    expect(price('KW-1001__mau-dist-north')?.value.centAmount).toBe(5000);
  });

  it('duplicate SKUs in one batch are refused', async () => {
    await expect(publishPrices(NORTH, { changes: [{ sku: 'MLV-OF-44001', centAmount: 1000 }, { sku: 'MLV-OF-44001', centAmount: 1100 }], confirm: true, expectedCount: 2 })).rejects.toMatchObject({ code: 'DUPLICATE_SKU' });
  });

  it('a store that does not sell in the US refuses USD', async () => {
    await expect(publishPrices(NORTH, { currency: 'USD', changes: [{ sku: 'MLV-OF-44001', centAmount: 1000 }], confirm: true, expectedCount: 1 })).rejects.toMatchObject({ code: 'CURRENCY_NOT_SOLD' });
  });
});

describe('setStandalonePrice', () => {
  it('uses key upsert: a first save for a seeded key is a changeValue, not a second price; a new key is a create', async () => {
    await setStandalonePrice(NORTH, 'MLV-BP-41001', undefined, 9100);
    expect(fake.callsOf('price.create')).toHaveLength(0);
    expect(fake.callsOf('price.update')[0]?.args).toMatchObject({ actions: [{ action: 'changeValue', value: { currencyCode: 'EUR', centAmount: 9100 } }] });
    expect(price('MLV-BP-41001__mau-dist-north')?.version).toBe(2);
    await setStandalonePrice(NORTH, 'MLV-OF-44001', undefined, 1100);
    expect(fake.callsOf('price.create')[0]?.args).toEqual({
      key: 'MLV-OF-44001__mau-dist-north',
      sku: 'MLV-OF-44001',
      value: { type: 'centPrecision', currencyCode: 'EUR', centAmount: 1100, fractionDigits: 2 },
      country: 'DE',
      channel: { typeId: 'channel', key: 'mau-dist-north' },
    });
    expect([...fake.state.prices.keys()].filter((k) => k.startsWith('MLV-OF-44001__')).sort()).toEqual(['MLV-OF-44001__base-eur-de', 'MLV-OF-44001__base-usd-us', 'MLV-OF-44001__mau-dist-north']);
  });

  it('uses the latest version on 409', async () => {
    fake.conflictOnce('price.update');
    await setStandalonePrice(NORTH, 'MLV-BP-41001', undefined, 9100);
    const versions = fake.callsOf('price.update').map((c) => (c.args as { version: number }).version);
    expect(versions).toHaveLength(2);
    expect(versions[1]).toBeGreaterThan(versions[0]);
    expect(price('MLV-BP-41001__mau-dist-north')?.value.centAmount).toBe(9100);
  });

  it('an unchanged value writes nothing; deleting a missing price writes nothing', async () => {
    expect(await setStandalonePrice(NORTH, 'MLV-BP-41001', undefined, 9000)).toBe('unchanged');
    expect(await setStandalonePrice(NORTH, 'MLV-OF-44001', undefined, null)).toBe('unchanged');
    expect(priceWrites()).toHaveLength(0);
  });

  it('setStandalonePrice with a branch channel key writes that channel price; default channel is the store distribution channel', async () => {
    await setStandalonePrice(NORTH, 'MLV-OF-44001', 'mau-br-north-one', 1250);
    expect(price('MLV-OF-44001__mau-br-north-one')).toMatchObject({ channel: { id: 'ch-mau-br-north-one' }, country: 'DE' });
    await setStandalonePrice(NORTH, 'MLV-OF-44001', undefined, 1260);
    expect(price('MLV-OF-44001__mau-dist-north')?.channel).toEqual({ typeId: 'channel', id: 'ch-mau-dist-north' });
  });

  it('a price on a channel that is not the store retail channel or one of its branch channels is 404 CHANNEL_NOT_FOUND', async () => {
    await expect(setStandalonePrice(NORTH, 'MLV-OF-44001', 'mau-dist-south', 1000)).rejects.toMatchObject({ status: 404, code: 'CHANNEL_NOT_FOUND' });
    await expect(setStandalonePrice(NORTH, 'MLV-OF-44001', 'mau-br-south-one', 1000)).rejects.toMatchObject({ code: 'CHANNEL_NOT_FOUND' });
    expect(priceWrites()).toHaveLength(0);
  });

  it('the Malva base price (a key without a channel) can never be written: there is no channel-less path and the key scheme always carries the channel', async () => {
    await setStandalonePrice(NORTH, 'MLV-OF-44001', undefined, 1000);
    expect([...fake.state.prices.values()].filter((p) => !p.channel).every((p) => p.key.includes('__base-'))).toBe(true);
    expect(price('MLV-OF-44001__base-eur-de')?.version).toBe(1);
  });

  it('USD for a store selling in the US: key ends in __usd, country US', async () => {
    await setStandalonePrice(SOUTH, 'MLV-OF-44001', undefined, 1400, 'USD');
    expect(price('MLV-OF-44001__mau-dist-south__usd')).toMatchObject({ country: 'US', value: { currencyCode: 'USD', centAmount: 1400 } });
    // an existing USD override is changed, not duplicated
    await setStandalonePrice(SOUTH, 'MLV-BP-41001', undefined, 10300, 'USD');
    expect(fake.callsOf('price.create').filter((c) => (c.args as { sku: string }).sku === 'MLV-BP-41001')).toHaveLength(0);
    expect(price('MLV-BP-41001__mau-dist-south__usd')?.value.centAmount).toBe(10300);
  });

  it('rejects an invalid amount before any call', async () => {
    await expect(setStandalonePrice(NORTH, 'MLV-OF-44001', undefined, 0)).rejects.toMatchObject({ code: 'INVALID_MONEY' });
    expect(fake.calls.filter((c) => c.op.startsWith('price.'))).toHaveLength(0);
  });
});

describe('reads', () => {
  it('getRetailPrice: branch price, else retail override, else Malva base, else null for a pre-release part', async () => {
    expect(await getRetailPrice(NORTH, 'MLV-BP-41001')).toEqual({ centAmount: 9000, currencyCode: 'EUR' });
    expect(await getRetailPrice(SOUTH, 'MLV-BP-41001', 'mau-br-south-one')).toEqual({ centAmount: 9200, currencyCode: 'EUR' });
    expect(await getRetailPrice(SOUTH, 'MLV-BP-41001', 'mau-br-south-two')).toEqual({ centAmount: 9300, currencyCode: 'EUR' });
    expect(await getRetailPrice(NORTH, 'MLV-AF-45001')).toEqual({ centAmount: 2150, currencyCode: 'EUR' });
    expect(await getRetailPrice(NORTH, 'MLV-BP-41099')).toBeNull();
    expect(await getRetailPrice(SOUTH, 'MLV-BP-41001', undefined, 'USD')).toEqual({ centAmount: 10200, currencyCode: 'USD' });
  });

  it('listPrices lists the assigned parts with list, override and the distance from list', async () => {
    const page = await listPrices(NORTH, { offset: 0, limit: 50 });
    expect(page.currency).toBe('EUR');
    expect(page.currencies).toEqual(['EUR']);
    expect(page.rows.map((r) => r.sku)).toEqual(['KW-1001', 'MLV-AF-45001', 'MLV-BD-42001', 'MLV-BP-41001', 'MLV-BT-54001', 'MLV-OF-44001', 'MLV-OF-44002']);
    const row = page.rows.find((r) => r.sku === 'MLV-BP-41001');
    expect(row).toMatchObject({ listCent: 9450, overrideCent: 9000, belowListPercent: 4.8, own: false });
    expect(page.rows.find((r) => r.sku === 'MLV-AF-45001')).toMatchObject({ listCent: 2150, overrideCent: null, belowListPercent: null });
    expect(page.rows.find((r) => r.sku === 'KW-1001')).toMatchObject({ listCent: null, overrideCent: 4500, own: true });
    expect((await listPrices(SOUTH, { offset: 0, limit: 5 })).currencies).toEqual(['EUR', 'USD']);
    const filtered = await listPrices(NORTH, { offset: 0, limit: 5, text: 'filter' });
    expect(filtered.rows.map((r) => r.sku)).toEqual(['MLV-AF-45001', 'MLV-OF-44001', 'MLV-OF-44002']);
    expect(filtered.total).toBe(3);
  });
});

describe('bulk', () => {
  it('preview shows the new price and the distance from list per part and flags invalid results; it writes nothing', async () => {
    const preview = await previewBulk(NORTH, { mode: 'percentOfList', value: 108, skus: ['MLV-OF-44001', 'MLV-BD-42001'] });
    expect(preview.rows.map((r) => [r.sku, r.listCent, r.newCent, r.aboveListPercent, r.invalid])).toEqual([
      ['MLV-BD-42001', 6800, 7344, 8, false],
      ['MLV-OF-44001', 1290, 1393, 8, false],
    ]);
    expect(priceWrites()).toHaveLength(0);
  });

  it('a bulk of list -100% flags every row invalid and publish is blocked (zero writes)', async () => {
    const preview = await previewBulk(NORTH, { mode: 'percentOfList', value: 0, filter: {} });
    expect(preview.invalidCount).toBe(preview.rows.length);
    expect(preview.rows.length).toBeGreaterThan(0);
    await expect(publishBulk(NORTH, { mode: 'percentOfList', value: 0, filter: {}, confirm: true, expectedCount: preview.rows.length })).rejects.toMatchObject({ code: 'INVALID_MONEY' });
    expect(priceWrites()).toHaveLength(0);
  });

  it('publish needs confirmation with the count; setTo uses the price in cents; parts without list price are skipped', async () => {
    await expect(publishBulk(NORTH, { mode: 'setTo', value: 999, skus: ['MLV-OF-44001', 'MLV-OF-44002'] })).rejects.toMatchObject({ status: 409, details: { count: 2 } });
    await expect(publishBulk(NORTH, { mode: 'setTo', value: 999, skus: ['MLV-OF-44001', 'MLV-OF-44002'], confirm: true, expectedCount: 2 })).resolves.toEqual({ written: 2, deleted: 0 });
    expect(price('MLV-OF-44002__mau-dist-north')?.value.centAmount).toBe(999);
    expect((await previewBulk(NORTH, { mode: 'setTo', value: 999, skus: ['KW-1001'] })).rows).toEqual([]);
  });
});
