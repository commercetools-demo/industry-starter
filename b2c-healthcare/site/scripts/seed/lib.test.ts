import { describe, expect, it } from 'vitest';
import { createFakeRoot } from './fake-root';
import { countProject, formatCounts } from './inventory-project';
import {
  assertProject, assertProjectKey, diffShipping, ensureKeyed, getAdminRoot, inventoryDraft, inventoryKey, loadSeedEnv, makeCtx, missingEnv, parseFlags, runSteps, withRetry,
} from './lib';

const quiet = () => {};

describe('lib guard and env', () => {
  it('assertProjectKey refuses every project except the seed project', () => {
    expect(() => assertProjectKey('spec-test-b2c-healthcare')).not.toThrow();
    expect(() => assertProjectKey('spec-b2c-health')).toThrow(/Refusing/);
    expect(() => assertProjectKey(undefined)).toThrow(/Refusing/);
  });

  it('assertProject reads the project key from the API and refuses another project', async () => {
    await expect(assertProject(createFakeRoot({}, 'spec-test-b2c-healthcare').root)).resolves.toBeUndefined();
    await expect(assertProject(createFakeRoot({}, 'some-other-project').root)).rejects.toThrow(/Refusing/);
  });

  it('getAdminRoot names the missing SEED_CTP_* variables and refuses a foreign key before any network call', async () => {
    await expect(getAdminRoot({ SEED_CTP_PROJECT_KEY: 'spec-test-b2c-healthcare' })).rejects.toThrow(/SEED_CTP_AUTH_URL.*SEED_CTP_CLIENT_SECRET/);
    const full = { SEED_CTP_AUTH_URL: 'https://a', SEED_CTP_API_URL: 'https://b', SEED_CTP_CLIENT_ID: 'x', SEED_CTP_CLIENT_SECRET: 'y' };
    await expect(getAdminRoot({ ...full, SEED_CTP_PROJECT_KEY: 'other' })).rejects.toThrow(/Refusing/);
    expect(missingEnv({})).toHaveLength(5);
    expect(missingEnv({ ...full, SEED_CTP_PROJECT_KEY: 'k' })).toEqual([]);
  });

  it('loadSeedEnv returns an empty object for a missing file', () => {
    expect(loadSeedEnv('/nonexistent/.env.seed.local')).toEqual({});
  });

  it('parseFlags', () => {
    expect(parseFlags([])).toEqual({ dryRun: false, only: undefined, confirm: undefined });
    expect(parseFlags(['--dry-run', '--only', 'mlv-doc-x', '--confirm', 'p'])).toEqual({ dryRun: true, only: 'mlv-doc-x', confirm: 'p' });
    expect(() => parseFlags(['--only'])).toThrow();
  });
});

describe('lib helpers', () => {
  it('withRetry retries 429 with Retry-After and gives up on other errors', async () => {
    const waits: number[] = [];
    let n = 0;
    const result = await withRetry(
      async () => {
        n += 1;
        if (n < 3) throw Object.assign(new Error('rate'), { statusCode: 429, headers: n === 1 ? { 'retry-after': '2' } : {} });
        return 'ok';
      },
      async (ms) => { waits.push(ms); },
    );
    expect(result).toBe('ok');
    expect(waits).toEqual([2000, 2000]);
    await expect(withRetry(async () => { throw Object.assign(new Error('bad'), { statusCode: 400 }); }, async () => {})).rejects.toThrow('bad');
  });

  it('ensureKeyed creates once, then reports ok; dry run writes nothing; a difference stops', async () => {
    const fake = createFakeRoot();
    const ctx = { ...makeCtx(fake.root, { dryRun: false }, quiet), pauseMs: 0 };
    const draft = { key: 'mlv-x', name: { 'en-US': 'X' } };
    expect(await ensureKeyed({ ...ctx, dryRun: true }, 'categories', draft)).toBe('would-create');
    expect(fake.store.categories).toHaveLength(0);
    expect(await ensureKeyed(ctx, 'categories', draft)).toBe('created');
    expect(await ensureKeyed(ctx, 'categories', draft)).toBe('ok');
    const r = await ensureKeyed(ctx, 'categories', draft, () => 'name differs');
    expect(r).toEqual({ diff: 'categories mlv-x: name differs' });
  });

  it('runSteps counts changes and stops at the first difference', async () => {
    const lines: string[] = [];
    const s = await runSteps([{ name: 'a', run: async () => 'created' }, { name: 'b', run: async () => 'ok' }], (l) => lines.push(l));
    expect(s).toEqual({ ok: true, changed: 1, total: 2 });
    const t = await runSteps([{ name: 'a', run: async () => ({ diff: 'x' }) }, { name: 'b', run: async () => 'created' }], (l) => lines.push(l));
    expect(t.ok).toBe(false);
    expect(lines.join('\n')).toContain('STOP');
  });

  it('inventory drafts are keyed mlv-inv-<sku> and carry the cart limit', () => {
    expect(inventoryKey('MED-x')).toBe('mlv-inv-MED-x');
    expect(inventoryDraft({ sku: 'MED-x', quantityOnStock: 500, maxCartQuantity: 3 })).toEqual({ key: 'mlv-inv-MED-x', sku: 'MED-x', quantityOnStock: 500, maxCartQuantity: 3 });
  });

  it('diffShipping compares the cents', () => {
    const m = (cents: number) => ({ isDefault: true, zoneRates: [{ zone: { key: 'usa' }, shippingRates: [{ price: { centAmount: cents, currencyCode: 'USD' } }] }] });
    expect(diffShipping(m(500), m(500))).toBeNull();
    expect(diffShipping(m(50000), m(500))).toMatch(/cents/);
  });

  it('inventory-project counts every kind and the prefixed ones', async () => {
    const fake = createFakeRoot({ products: [{ key: 'mlv-a' }, { key: 'chair' }], customers: [{ key: 'c' }] });
    const counts = await countProject(fake.root);
    expect(counts.find((c) => c.kind === 'products')).toEqual({ kind: 'products', total: 2, prefixed: 1 });
    expect(counts.find((c) => c.kind === 'customers')?.total).toBe(1);
    expect(formatCounts(counts)).toContain('| products | 2 | 1 |');
  });
});
