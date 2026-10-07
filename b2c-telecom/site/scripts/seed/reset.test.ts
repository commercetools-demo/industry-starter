import { describe, expect, it } from 'vitest';
import { buildPlatformManifest as buildManifest } from './manifest';
import { main as reset } from './reset';
import { main as seed } from './seed';
import { FakeCt } from './test/fake-ct';
import { offerType } from './test/fixtures';
import type { CategoryDraft, SeedManifest } from './types';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };
const CONFIRM = ['--confirm-project', 'spec-test-b2c-telecom'];
const label = (t: string) => ({ 'en-US': t, 'de-DE': t });

const parent: CategoryDraft = { key: 'malva-cat-parent', name: label('P'), slug: label('p') };
const child: CategoryDraft = { key: 'malva-cat-child', name: label('C'), slug: label('c'), parent: 'malva-cat-parent' };

function manifest(): SeedManifest {
  return { ...buildManifest(), productType: [offerType], category: [parent, child] };
}

async function seeded(): Promise<FakeCt> {
  const api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
  const code = await seed([...CONFIRM, '--no-wait'], { api, source: SOURCE, manifest: manifest(), log: () => undefined });
  expect(code).toBe(0);
  return api;
}

async function run(api: FakeCt, argv: string[]) {
  const lines: string[] = [];
  const code = await reset(argv, { api, source: SOURCE, manifest: manifest(), log: (l) => lines.push(l) });
  return { code, out: lines.join('\n') };
}

describe('seed:reset', () => {
  it('Reset limited to what was seeded: hand-made resources stay untouched', async () => {
    const api = await seeded();
    api.seed('categories', { key: 'hand-made', name: label('Hand'), slug: label('hand'), ancestors: [] });
    api.seed('customer-groups', { key: 'vip', name: 'VIP' });
    const dry = await run(api, CONFIRM);
    expect(dry.code).toBe(0);
    expect(dry.out).toContain('Dry run');
    expect(dry.out).toMatch(/would remove\s+category malva-cat-child/);
    api.log.length = 0;
    expect(api.log).toEqual([]);
    expect(api.keysOf('categories')).toHaveLength(3);

    const real = await run(api, [...CONFIRM, '--yes']);
    expect(real.code).toBe(0);
    expect(api.keysOf('categories')).toEqual(['hand-made']);
    expect(api.keysOf('customer-groups')).toEqual(['vip']);
    expect(api.keysOf('shipping-methods')).toEqual([]);
    expect(api.keysOf('tax-categories')).toEqual([]);
    expect(api.keysOf('product-types')).toEqual([]);
    expect(api.keysOf('recurrence-policies')).toEqual([]);
    // adopted zones are never deleted
    expect(api.keysOf('zones').sort()).toEqual(['europe', 'usa']);
  });

  it('removes children before parents', async () => {
    const api = await seeded();
    api.log.length = 0;
    await run(api, [...CONFIRM, '--yes']);
    const deletes = api.log.filter((l) => l.startsWith('delete categories'));
    expect(deletes).toEqual(['delete categories malva-cat-child', 'delete categories malva-cat-parent']);
  });

  it('is repeatable: a second reset removes nothing', async () => {
    const api = await seeded();
    await run(api, [...CONFIRM, '--yes']);
    api.log.length = 0;
    const second = await run(api, [...CONFIRM, '--yes']);
    expect(second.code).toBe(0);
    expect(api.log).toEqual([]);
  });

  it('refuses without the confirmation flag', async () => {
    const api = await seeded();
    const { code, out } = await run(api, ['--yes']);
    expect(code).toBe(2);
    expect(out).toContain('--confirm-project');
  });

  it('demo reset deletes only resources with demoMarker and cancels recurring orders first', async () => {
    const api = await seeded();
    const marked = { custom: { fields: { demoMarker: 'malva-demo' } } };
    api.seed('carts', { ...marked });
    api.seed('carts', { custom: { fields: { demoMarker: 'someone-else' } } });
    api.seed('carts', {});
    api.seed('orders', { ...marked });
    api.seed('customers', { email: 'demo@example.test', ...marked });
    api.seed('customers', { email: 'real@example.test' });
    api.seed('recurring-orders', { ...marked, recurringOrderState: 'Active' });
    api.log.length = 0;
    const { code } = await run(api, [...CONFIRM, '--demo', '--yes']);
    expect(code).toBe(0);
    expect(api.list('carts')).toHaveLength(2);
    expect(api.list('orders')).toHaveLength(0);
    expect(api.list('customers').map((c) => c.email)).toEqual(['real@example.test']);
    expect(api.list('recurring-orders')).toHaveLength(0);
    const cancel = api.log.findIndex((l) => l.includes('recurring-orders') && l.includes('setRecurringOrderState'));
    const del = api.log.findIndex((l) => l.startsWith('delete recurring-orders'));
    expect(cancel).toBeGreaterThanOrEqual(0);
    expect(cancel).toBeLessThan(del);
    // manifest data untouched by a demo-only reset
    expect(api.byKey('tax-categories', 'malva-telecom-services')).toBeDefined();
  });

  it('demo dry run deletes nothing', async () => {
    const api = await seeded();
    api.seed('carts', { custom: { fields: { demoMarker: 'malva-demo' } } });
    api.writes = 0;
    const { out } = await run(api, [...CONFIRM, '--demo']);
    expect(out).toMatch(/would remove\s+carts/);
    expect(api.writes).toBe(0);
    expect(api.list('carts')).toHaveLength(1);
  });
});
