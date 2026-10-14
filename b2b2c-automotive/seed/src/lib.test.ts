// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { FakeApi } from './fake-api';
import { PREFIX, Runner, assertSafeProject, isCleanUrl, parseArgs, readSeedEnv } from './lib';
import { ensureProjectSettings, planProjectActions, waitForSearchActivation } from './settings';
import * as S from './sync';
import { orUndefined } from './api';

const env = { SEED_CTP_PROJECT_KEY: 'p', SEED_CTP_AUTH_URL: 'a', SEED_CTP_API_URL: 'b', SEED_CTP_CLIENT_ID: 'c', SEED_CTP_CLIENT_SECRET: 's', SEED_CTP_SCOPES: 'x', EXPECTED_PROJECT_KEY: 'p' };

describe('environment and guards', () => {
  it('reads the environment and names a missing variable without printing values', () => {
    expect(readSeedEnv(env).projectKey).toBe('p');
    expect(() => readSeedEnv({ ...env, SEED_CTP_CLIENT_SECRET: undefined })).toThrow(/SEED_CTP_CLIENT_SECRET/);
    try { readSeedEnv({ ...env, SEED_CTP_CLIENT_ID: ' ' }); } catch (e) { expect(String(e)).not.toContain('"s"'); }
  });

  it('accepts the unprefixed AUTH_URL, API_URL, CLIENT_ID, CLIENT_SECRET, SCOPES names', () => {
    const e = readSeedEnv({ SEED_CTP_PROJECT_KEY: 'p', AUTH_URL: 'a', API_URL: 'b', CLIENT_ID: 'c', CLIENT_SECRET: 's', SCOPES: 'x', EXPECTED_PROJECT_KEY: 'p' });
    expect(e).toMatchObject({ authUrl: 'a', apiUrl: 'b', clientId: 'c', clientSecret: 's', scopes: 'x' });
  });

  it('refuses a project key that differs from EXPECTED_PROJECT_KEY, a missing one and healthcare projects', () => {
    expect(() => assertSafeProject('spec-test-b2b2c-automotive', 'spec-test-b2b2c-automotive')).not.toThrow();
    expect(() => assertSafeProject('a', 'b')).toThrow(/mismatch/);
    expect(() => assertSafeProject('a', undefined)).toThrow(/EXPECTED_PROJECT_KEY/);
    expect(() => assertSafeProject('spec-healthcare', 'spec-healthcare')).toThrow(/another team/);
    expect(PREFIX).toBe('mau-');
  });

  it('Runner counts and, in dry-run, performs nothing', async () => {
    let done = 0;
    const dry = new Runner(true, () => undefined);
    await dry.act('x', async () => { done += 1; });
    expect([done, dry.changes]).toEqual([0, 1]);
    const real = new Runner(false, () => undefined);
    expect(await real.act('y', async () => 5)).toBe(5);
  });

  it('parseArgs defaults', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, only: undefined, confirm: undefined, buildId: undefined, count: 2 });
  });

  it('isCleanUrl', () => {
    expect(isCleanUrl('https://h/a.jpg')).toBe(true);
    expect(isCleanUrl('https://h/a.jpg?x')).toBe(false);
    expect(isCleanUrl('https://h/a.jpg#x')).toBe(false);
    expect(isCleanUrl('/a.jpg')).toBe(false);
  });

  it('orUndefined turns 404 into undefined and rethrows others', async () => {
    expect(await orUndefined(async () => { throw Object.assign(new Error('x'), { statusCode: 404 }); })).toBeUndefined();
    await expect(orUndefined(async () => { throw Object.assign(new Error('x'), { statusCode: 500 }); })).rejects.toThrow('x');
  });
});

describe('project settings (seed:settings)', () => {
  const on = { searchIndexing: { productsSearch: { status: 'Activated' } }, carts: { countryTaxRateFallbackEnabled: true } };

  it('asks for nothing when search is Activated and the fallback is on', () => {
    expect(planProjectActions(on)).toEqual([]);
  });

  it('enables Product Search indexing and keeps the tax fallback on', () => {
    expect(planProjectActions({ searchIndexing: { productsSearch: { status: 'Deactivated' } }, carts: { countryTaxRateFallbackEnabled: false } })).toEqual([
      { action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' },
      { action: 'changeCountryTaxRateFallbackEnabled', countryTaxRateFallbackEnabled: true },
    ]);
    expect(planProjectActions({ searchIndexing: { productsSearch: { status: 'Activated' } }, carts: { countryTaxRateFallbackEnabled: true } })).toEqual([]);
  });

  it('applies the actions, waits for Activated, and a second run does nothing', async () => {
    const api = new FakeApi();
    const run = new Runner(false, () => undefined);
    await ensureProjectSettings(api, run, { wait: async () => undefined });
    expect(api.project.searchIndexing?.productsSearch?.status).toBe('Activated');
    expect(run.changes).toBe(1);
    const again = new Runner(false, () => undefined);
    await ensureProjectSettings(api, again);
    expect(again.changes).toBe(0);
  });

  it('polls until the status turns Activated and fails on timeout', async () => {
    let calls = 0;
    const api = new FakeApi();
    const original = api.getProject.bind(api);
    api.getProject = async () => { calls += 1; const p = await original(); return calls < 3 ? p : { ...p, searchIndexing: { productsSearch: { status: 'Activated' } } }; };
    expect(await waitForSearchActivation(api, { wait: async () => undefined })).toBe(3);
    const stuck = new FakeApi();
    await expect(waitForSearchActivation(stuck, { intervalMs: 10, timeoutMs: 30, wait: async () => undefined })).rejects.toThrow(/did not become Activated/);
  });

  it('a dry run changes nothing', async () => {
    const api = new FakeApi();
    await ensureProjectSettings(api, new Runner(true, () => undefined));
    expect(api.project.searchIndexing?.productsSearch?.status).toBe('Deactivated');
    expect(api.writes).toBe(0);
  });
});

describe('sync planners', () => {
  it('normAttr treats enum objects, money and unordered sets as equal to their draft form', () => {
    expect(S.normAttr({ key: 'oem', label: 'OEM' })).toBe('oem');
    expect(S.normAttr({ centAmount: 5, currencyCode: 'EUR' })).toBe('EUR:5');
    expect(S.normAttr(['b', 'a'])).toEqual(S.normAttr(['a', 'b']));
  });

  it('planStandalonePriceUpdate changes only a differing value', () => {
    const have = { id: '1', version: 1, value: { type: 'centPrecision', currencyCode: 'EUR', centAmount: 100, fractionDigits: 2 } };
    expect(S.planStandalonePriceUpdate(have, { value: { currencyCode: 'EUR', centAmount: 100 } })).toEqual([]);
    expect(S.planStandalonePriceUpdate(have, { value: { currencyCode: 'EUR', centAmount: 120 } })).toEqual([{ action: 'changeValue', value: { currencyCode: 'EUR', centAmount: 120 } }]);
  });

  it('planTailoringUpdate covers text and images and always publishes in the same request', () => {
    const existing = { id: '1', version: 1, staged: { name: { 'de-DE': 'a' }, variants: [{ sku: 'S', images: [{ url: 'https://x.test/1.jpg' }] }] } };
    expect(S.planTailoringUpdate(existing, { name: { 'de-DE': 'a' }, variants: [{ sku: 'S', images: [{ url: 'https://x.test/1.jpg' }] }] })).toEqual([]);
    expect(S.planTailoringUpdate(existing, { name: { 'de-DE': 'b' }, variants: [{ sku: 'S', images: [{ url: 'https://x.test/2.jpg' }] }] }).map((a) => a.action)).toEqual(['setName', 'setImages', 'publish']);
  });

  it('planSelectionMembers adds the missing and removes the extra', () => {
    expect(S.planSelectionMembers(['a', 'b'], ['b', 'c']).map((x) => `${String(x.action)}:${(x.product as { id: string }).id}`)).toEqual(['addProduct:c', 'removeProduct:a']);
    expect(S.planSelectionMembers(['a'], ['a'])).toEqual([]);
  });

  it('planDiscountUpdate flips only what differs', () => {
    expect(S.planDiscountUpdate('product-discounts', { id: '1', version: 1, sortOrder: '0.1', isActive: true, predicate: 'p' }, { sortOrder: '0.1', isActive: false, predicate: 'p' }).map((a) => a.action)).toEqual(['changeIsActive']);
  });

  it('planRoleUpdate is order-insensitive', () => {
    expect(S.planRoleUpdate({ id: '1', version: 1, permissions: ['b', 'a'] }, { permissions: ['a', 'b'] })).toEqual([]);
  });
});
