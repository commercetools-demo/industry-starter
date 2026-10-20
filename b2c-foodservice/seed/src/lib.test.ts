// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { orUndefined } from './api';
import { CONTRACT_KEYS, PREFIX } from './data/base';
import { FakeApi } from './fake-api';
import { Runner, SEED_DIR, assertRemoteKey, assertSafeProject, isCleanUrl, parseArgs, readSeedEnv } from './lib';
import { ensureProjectSettings, planProjectActions, waitForSearchActivation } from './settings';

const env = { SEED_CTP_PROJECT_KEY: 'p', SEED_CTP_AUTH_URL: 'a', SEED_CTP_API_URL: 'b', SEED_CTP_CLIENT_ID: 'c', SEED_CTP_CLIENT_SECRET: 's', SEED_CTP_SCOPES: 'x', EXPECTED_PROJECT_KEY: 'p' };
const quiet = () => undefined;

describe('Guards on every script', () => {
  it('Mismatched key', () => {
    // EXPECTED_PROJECT_KEY differs from the configured key: aborts and prints both keys.
    expect(() => assertSafeProject('shop-a', 'shop-b')).toThrow(/"shop-a".*"shop-b"/);
    // EXPECTED_PROJECT_KEY differs from the key the API reports: aborts and prints both keys.
    expect(() => assertRemoteKey('other-project', 'shop-a', 'shop-a')).toThrow(/"other-project".*"shop-a"/);
    expect(() => assertRemoteKey('shop-a', 'shop-a', 'shop-a')).not.toThrow();
    expect(() => assertSafeProject('a', undefined)).toThrow(/EXPECTED_PROJECT_KEY/);
    expect(() => assertSafeProject('spec-health', 'spec-health')).toThrow(/another team/);
  });

  it('reads the environment, names a missing variable and never prints a value', () => {
    expect(readSeedEnv(env).projectKey).toBe('p');
    expect(() => readSeedEnv({ ...env, SEED_CTP_CLIENT_SECRET: undefined })).toThrow(/SEED_CTP_CLIENT_SECRET/);
    try {
      readSeedEnv({ ...env, SEED_CTP_CLIENT_ID: ' ', SEED_CTP_CLIENT_SECRET: 'super-secret-value' });
    } catch (e) {
      expect(String(e)).not.toContain('super-secret-value');
    }
  });

  it('every script supports --dry-run and parses --only, --confirm, --manifest, --offline', () => {
    expect(parseArgs(['--dry-run', '--only', 'products,prices', '--confirm', 'k', '--manifest', 'm.json', '--offline'])).toEqual({ dryRun: true, offline: true, only: 'products,prices', confirm: 'k', manifest: 'm.json' });
    expect(parseArgs([]).dryRun).toBe(false);
    for (const f of readdirSync(path.join(SEED_DIR, 'src')).filter((x) => /^(seed|settings|inventory|cleanup|images|verify|reset)\.ts$/.test(x))) {
      const src = readFileSync(path.join(SEED_DIR, 'src', f), 'utf8');
      expect(src, f).toMatch(/dry-run|dryRun|parseArgs|getAdmin|loadEnv/);
    }
  });

  it('Runner counts and, in dry-run, performs nothing', async () => {
    let done = 0;
    const dry = new Runner(true, quiet);
    await dry.act('x', async () => { done += 1; });
    expect([done, dry.changes]).toEqual([0, 1]);
    const real = new Runner(false, quiet);
    expect(await real.act('y', async () => 5)).toBe(5);
  });

  it('seed keys all start with mcf- and the contract keys are listed', () => {
    expect(PREFIX).toBe('mcf-');
    expect(CONTRACT_KEYS.length).toBeGreaterThanOrEqual(8);
  });

  it('isCleanUrl accepts scheme, host and path only', () => {
    expect(isCleanUrl('https://host/p/1.jpeg')).toBe(true);
    expect(isCleanUrl('https://host/p/1.jpeg?w=1')).toBe(false);
    expect(isCleanUrl('https://host/p/1.jpeg#x')).toBe(false);
    expect(isCleanUrl('not a url')).toBe(false);
  });

  it('orUndefined turns a 404 into undefined and rethrows anything else', async () => {
    expect(await orUndefined(async () => { throw Object.assign(new Error('x'), { statusCode: 404 }); })).toBeUndefined();
    await expect(orUndefined(async () => { throw Object.assign(new Error('x'), { statusCode: 500 }); })).rejects.toThrow('x');
  });
});

describe('Project settings', () => {
  it('Fresh project', async () => {
    const api = new FakeApi(); // indexing Deactivated, fallback off, only US and ES, USD and CHF, en-US
    const waits: number[] = [];
    // The indexing status becomes Activated only after two polls: the script waits (injected wait, no real sleeping).
    let polls = 0;
    const real = api.getProject.bind(api);
    api.getProject = async () => {
      const p = await real();
      if (p.searchIndexing?.productsSearch?.status === 'Activated' && (polls += 1) < 3) return { ...p, searchIndexing: { productsSearch: { status: 'Indexing' } } };
      return p;
    };
    const run = new Runner(false, quiet);
    await ensureProjectSettings(api, run, { wait: async (ms) => { waits.push(ms); }, intervalMs: 10 });
    expect(waits.length).toBe(2);
    expect(api.project.searchIndexing?.productsSearch?.status).toBe('Activated');
    expect(api.project.carts?.countryTaxRateFallbackEnabled).toBe(true);
    // add only: the existing entries stay
    expect(api.project.countries).toEqual(expect.arrayContaining(['US', 'ES', 'DE', 'GB']));
    expect(api.project.currencies).toEqual(expect.arrayContaining(['USD', 'CHF', 'EUR', 'GBP']));
    expect(api.project.languages).toEqual(expect.arrayContaining(['en-US', 'en-GB', 'de-DE']));
    // a second run reports nothing to change
    api.getProject = real;
    const second = new Runner(false, quiet);
    await ensureProjectSettings(api, second);
    expect(second.changes).toBe(0);
  });

  it('Dry run', async () => {
    const api = new FakeApi();
    const run = new Runner(true, quiet);
    const before = api.project.version;
    await ensureProjectSettings(api, run);
    expect(run.changes).toBe(1);
    expect(run.lines[0]).toMatch(/^would update project settings/);
    expect(api.writes).toBe(0);
    expect(api.project.version).toBe(before);
  });

  it('plans exactly the actions the platform documents and never removes anything', () => {
    const actions = planProjectActions({ searchIndexing: { productsSearch: { status: 'Deactivated' } }, carts: { countryTaxRateFallbackEnabled: false }, languages: ['fr'], countries: ['FR'], currencies: ['CHF'] });
    expect(actions[0]).toEqual({ action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' });
    expect(actions[1]).toEqual({ action: 'changeCountryTaxRateFallbackEnabled', countryTaxRateFallbackEnabled: true });
    expect(actions.find((a) => a.action === 'changeLanguages')).toMatchObject({ languages: ['fr', 'en-US', 'en-GB', 'de-DE'] });
    expect(planProjectActions({ searchIndexing: { productsSearch: { status: 'Activated' } }, carts: { countryTaxRateFallbackEnabled: true }, languages: ['en-US', 'en-GB', 'de-DE'], countries: ['US', 'DE', 'GB'], currencies: ['USD', 'EUR', 'GBP'] })).toEqual([]);
  });

  it('waitForSearchActivation times out with the last status', async () => {
    const api = new FakeApi();
    await expect(waitForSearchActivation(api, { intervalMs: 10, timeoutMs: 20, wait: async () => undefined })).rejects.toThrow(/did not become Activated/);
  });
});

describe('Offline operation', () => {
  it('No credentials', () => {
    // No .env.local and no SEED_* variables: the second command prints the full plan. `npm run check` is this suite itself.
    const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(SEED_|EXPECTED_|IMAGE_SOURCE)/.test(k)));
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'src/seed.ts', '--dry-run', '--offline'], { cwd: SEED_DIR, env: cleanEnv, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/\d+ change\(s\)/);
    expect(r.stdout).toContain('== products');
    expect(r.stdout).toContain('create review mcf-review-');
  }, 60000);
});
