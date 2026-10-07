import { describe, expect, it } from 'vitest';
import { activateProductSearch, applyProjectSettings, checkProjectSettings, main as settingsMain, waitForSearchIndex } from './project-settings';
import { main as seedMain } from './seed';
import { buildPlatformManifest as buildManifest } from './manifest';
import { FakeCt } from './test/fake-ct';
import { offerType } from './test/fixtures';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };
const CONFIRM = ['--confirm-project', 'spec-test-b2c-telecom'];
const manifest = { ...buildManifest(), productType: [offerType] };

function api(countries = ['GB', 'DE', 'US']): FakeCt {
  const fake = new FakeCt();
  fake.project.countries = countries;
  fake.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  fake.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
  return fake;
}

describe('project settings', () => {
  it('Project settings missing: stops before writing and names the setting and where to change it', async () => {
    const fake = api(['GB', 'US']);
    const lines: string[] = [];
    const code = await seedMain(CONFIRM, { api: fake, source: SOURCE, manifest, log: (l) => lines.push(l) });
    const out = lines.join('\n');
    expect(code).toBe(3);
    expect(out).toContain('Project settings missing: country DE');
    expect(out).toContain('Settings > Project settings > International');
    expect(fake.writes).toBe(0);
    expect(fake.log).toEqual([]);
  });

  it('--apply-project-settings sends the union with changeCountries and keeps GB', async () => {
    const fake = api(['GB', 'US']);
    const report = await checkProjectSettings(fake);
    expect(report.missing).toEqual(['country DE']);
    await applyProjectSettings(fake, report);
    expect(fake.projectUpdates[0].actions).toEqual([{ action: 'changeCountries', countries: ['GB', 'US', 'DE'] }]);
    expect((await checkProjectSettings(fake)).missing).toEqual([]);
  });

  it('seed with --apply-project-settings fixes the project, then writes', async () => {
    const fake = api(['GB', 'US']);
    const code = await seedMain([...CONFIRM, '--apply-project-settings', '--no-wait'], { api: fake, source: SOURCE, manifest, log: () => undefined });
    expect(code).toBe(0);
    expect(fake.project.countries).toEqual(['GB', 'US', 'DE']);
    expect(fake.byKey('tax-categories', 'malva-telecom-services')).toBeDefined();
  });

  it('activation sends exactly changeProductSearchIndexingEnabled with ProductsSearch', async () => {
    const fake = api();
    expect(await activateProductSearch(fake)).toBe('activated');
    expect(fake.projectUpdates[0].actions).toEqual([{ action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' }]);
    expect(JSON.stringify(fake.projectUpdates)).not.toContain('ProductProjectionsSearch');
    expect(await activateProductSearch(fake)).toBe('already-active');
    expect(fake.projectUpdates).toHaveLength(1);
  });

  it('seed activates Product Search after writing and a second run does not activate again', async () => {
    const fake = api();
    await seedMain([...CONFIRM, '--no-wait'], { api: fake, source: SOURCE, manifest, log: () => undefined });
    expect((fake.project.searchIndexing as { productsSearch: { status: string } }).productsSearch.status).toBe('Activated');
    const updates = fake.projectUpdates.length;
    await seedMain([...CONFIRM, '--no-wait'], { api: fake, source: SOURCE, manifest, log: () => undefined });
    expect(fake.projectUpdates).toHaveLength(updates);
  });

  it('wait loop: not-ready 400 then ready', async () => {
    const fake = api();
    await activateProductSearch(fake);
    fake.indexedKeys = ['a', 'b'];
    fake.searchReadyAfter = 2;
    const slept: number[] = [];
    const { lagMs } = await waitForSearchIndex(fake, { expectedKeys: ['a', 'b'], pollMs: 1000, sleep: async (ms) => void slept.push(ms) });
    expect(slept).toEqual([1000, 1000]);
    expect(lagMs).toBe(2000);
  });

  it('wait loop times out with exit code 6', async () => {
    const fake = api();
    await activateProductSearch(fake);
    fake.indexedKeys = [];
    const lines: string[] = [];
    const code = await settingsMain([...CONFIRM, '--wait-only'], {
      api: fake,
      source: SOURCE,
      expectedKeys: ['malva-offer-x'],
      sleep: async () => undefined,
      log: (l) => lines.push(l),
    });
    expect(code).toBe(6);
    expect(lines.join('\n')).toContain('SEARCH_NOT_READY');
  });

  it('--check-only never writes', async () => {
    const fake = api();
    const lines: string[] = [];
    const code = await settingsMain(['--check-only'], { api: fake, source: SOURCE, log: (l) => lines.push(l) });
    expect(code).toBe(0);
    expect(fake.writes).toBe(0);
    expect(lines.join('\n')).toContain('product search: Deactivated');
  });
});
