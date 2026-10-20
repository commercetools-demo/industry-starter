// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { ALL_KINDS } from './api';
import { CONTRACT_KEYS } from './data/base';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { isResettable, planReset, resetTargets, runReset } from './reset';
import { runSeed } from './seed';

const quiet = () => undefined;
const seeded = async (): Promise<FakeApi> => {
  const api = new FakeApi();
  await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
  return api;
};

describe('Seed ownership and keys', () => {
  it('Reset', async () => {
    const api = await seeded();
    // a hand-made product (no prefix) and a hand-made category sit next to the seed
    const hand = api.put('products', { key: 'hand-made', masterData: { published: true, current: { name: { 'en-US': 'Hand made' } }, staged: { name: { 'en-US': 'Hand made' } } } });
    api.put('categories', { key: 'hand-cat', name: { 'en-US': 'Hand' }, ancestors: [] });
    const run = new Runner(false, quiet);
    const r = await runReset(api, run);
    expect(r.failed).toEqual([]);
    expect(api.all('products').map((p) => p.id)).toEqual([hand.id]); // the hand-made product remains
    expect(api.all('categories').map((c) => c.key)).toEqual(['hand-cat']);
  });

  it('reset removes everything the seed creates', async () => {
    const api = await seeded();
    const r = await runReset(api, new Runner(false, quiet));
    expect(r.failed).toEqual([]);
    for (const kind of ALL_KINDS) expect(api.all(kind), kind).toHaveLength(0);
    // and the seed can rebuild from nothing
    const again = await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
    expect(again.changes).toBeGreaterThan(1000);
  });

  it('only deletes keys with the seed prefix or in CONTRACT_KEYS', async () => {
    for (const t of resetTargets()) for (const k of t.keys) expect(isResettable(k), `${t.kind} ${k}`).toBe(true);
    expect(isResettable('sample-product')).toBe(false);
    expect(isResettable('mcf-anything')).toBe(true);
    for (const k of CONTRACT_KEYS) expect(isResettable(k)).toBe(true);
    const plan = await planReset(await seeded());
    expect(plan.refused).toEqual([]);
  });

  it('dry run deletes nothing', async () => {
    const api = await seeded();
    const writes = api.writes;
    const run = new Runner(true, quiet);
    await runReset(api, run);
    expect(run.changes).toBeGreaterThan(1000);
    expect(api.writes).toBe(writes);
  });
});
