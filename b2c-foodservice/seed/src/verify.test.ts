// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Res } from './api';
import { PRODUCTS, masterSku } from './data/products';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { runSeed } from './seed';
import { checkProduct, checkReviewStatistics, verifySeed } from './verify';

const quiet = () => undefined;
const seeded = async (): Promise<FakeApi> => {
  const api = new FakeApi();
  await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
  return api;
};

describe('Verification', () => {
  it('Drift', async () => {
    const api = await seeded();
    expect(await verifySeed(api)).toEqual([]);
    // a seeded product's price was edited by hand
    const def = PRODUCTS[0]!;
    const sku = masterSku(def);
    const product = (await api.getByKey('products', def.key)) as Res;
    await api.update('products', product, [
      { action: 'setPrices', sku, prices: [{ value: { currencyCode: 'USD', centAmount: 12345 }, country: 'US' }], staged: true }, { action: 'publish' },
    ]);
    const problems = await verifySeed(api);
    expect(problems.some((p) => p.startsWith(`${sku}: price drift`))).toBe(true);
    expect(problems.find((p) => p.includes(sku))).toContain('US:USD:12345');
  });

  it('reports a missing resource, a wrong setting, a wrong stock quantity and an unclean image URL', async () => {
    const api = await seeded();
    const store = api.all('channels')[0] as Res;
    await api.remove('channels', { id: store.id, version: store.version }).catch(() => undefined); // referenced by inventory: stays
    const cat = api.all('categories').find((c) => c.key === 'mcf-cat-gifts') as Res;
    await api.remove('categories', { id: cat.id, version: cat.version }).catch(() => undefined); // referenced by a product: stays
    const inv = api.all('inventory')[3] as Res;
    await api.update('inventory', inv, [{ action: 'changeQuantity', quantity: 424242 }]);
    api.project.carts = { countryTaxRateFallbackEnabled: false };
    const def = PRODUCTS[1]!;
    const product = (await api.getByKey('products', def.key)) as Res;
    await api.update('products', product, [{ action: 'addExternalImage', sku: masterSku(def), image: { url: 'https://h/a.jpeg?w=1', dimensions: { w: 1, h: 1 } }, staged: true }, { action: 'publish' }]);
    const problems = await verifySeed(api);
    expect(problems.some((p) => /entries differ from the rule/.test(p))).toBe(true);
    expect(problems).toContain('project: countryTaxRateFallbackEnabled is not true');
    expect(problems.some((p) => /image URL is not clean/.test(p))).toBe(true);
  });

  it('checkProduct finds a missing locale and an unpublished product', async () => {
    const api = await seeded();
    const def = PRODUCTS[0]!;
    const p = (await api.getByKey('products', def.key)) as Res;
    const md = p.masterData as { published: boolean; current: { name: Record<string, string> }; staged: { name: Record<string, string> } };
    delete md.staged.name['en-CA'];
    md.published = false; // an unpublished product is checked on its staged data
    const problems = checkProduct(p, def, () => undefined);
    expect(problems).toContain(`${def.key}: not published`);
    expect(problems).toContain(`${def.key}: name missing in en-CA`);
  });

  it('checkReviewStatistics compares count and average', () => {
    const p = { id: '1', version: 1, key: 'k', reviewRatingStatistics: { count: 3, averageRating: 4 } } as Res;
    expect(checkReviewStatistics(p, { count: 3, averageRating: 4 })).toEqual([]);
    expect(checkReviewStatistics(p, { count: 4, averageRating: 4 })[0]).toMatch(/count is 3, expected 4/);
    expect(checkReviewStatistics(p, { count: 3, averageRating: 2 })[0]).toMatch(/averageRating/);
    expect(checkReviewStatistics({ id: '1', version: 1, key: 'k' } as Res, { count: 0, averageRating: 0 })).toEqual([]);
  });
});
