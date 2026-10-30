// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { INSTORE_CATEGORY_TYPE_KEY, READY_DRINK_SKUS } from './data/instore';
import { FakeApi } from './fake-api';
import { seedInstore, seedInstoreVisibility } from './instore';
import { Runner } from './lib';
import { runSeed } from './seed';

const quiet = () => undefined;
const ctx = (api: FakeApi, dryRun = false) => ({ api, run: new Runner(dryRun, quiet) });

describe('In-store seed', () => {
  it('adds instoreVisibility to an existing instore-category-type without touching its other fields', async () => {
    const api = new FakeApi();
    await api.create('types', {
      key: INSTORE_CATEGORY_TYPE_KEY, name: { en: 'x' }, resourceTypeIds: ['category'],
      fieldDefinitions: [{ name: 'other', label: { en: 'o' }, required: false, type: { name: 'String' } }],
    });
    await seedInstoreVisibility(ctx(api));
    const t = await api.getByKey('types', INSTORE_CATEGORY_TYPE_KEY);
    const defs = t?.fieldDefinitions as { name: string; type: { values: { key: string }[] } }[];
    expect(defs.map((f) => f.name)).toEqual(['other', 'instoreVisibility']);
    expect(defs[1]?.type.values.map((v) => v.key)).toEqual(['onlyInStore', 'onlyOnline', 'both', 'none']);
  });

  it('creates the drinks in an onlyInStore category and is idempotent', async () => {
    const api = new FakeApi();
    await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' }, 'tax');
    await seedInstore(ctx(api));
    const cat = await api.getByKey('categories', 'mcf-cat-instore-drinks');
    expect((cat?.custom as { fields: Record<string, string> }).fields.instoreVisibility).toBe('onlyInStore');
    const products = (await api.list('products')).filter((p) => p.key?.startsWith('mcf-rd-'));
    expect(products).toHaveLength(READY_DRINK_SKUS.length / 2);
    const second = ctx(api);
    await seedInstore(second);
    expect(second.run.changes).toBe(0);
  });
});
