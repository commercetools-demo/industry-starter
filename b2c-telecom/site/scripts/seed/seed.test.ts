import { describe, expect, it } from 'vitest';
import { shippingMethods } from './data/shipping';
import { buildManifest } from './manifest';
import { main } from './seed';
import { FakeCt } from './test/fake-ct';
import { offerType } from './test/fixtures';
import type { ProductTypeDraft, SeedManifest } from './types';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };

function baseline(): FakeCt {
  const api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }, { country: 'GB' }] });
  return api;
}

async function seed(api: FakeCt, argv: string[], manifest: SeedManifest = buildManifest()) {
  const lines: string[] = [];
  const code = await main(argv, { api, source: SOURCE, manifest, log: (l) => lines.push(l) });
  return { code, out: lines.join('\n') };
}

describe('seed command', () => {
  it('Plan mode: prints created, updated and unchanged and makes no write calls', async () => {
    const api = baseline();
    await seed(api, ['--confirm-project', 'spec-test-b2c-telecom', '--only', 'taxCategory,zoneCoverage,customerGroup']);
    api.writes = 0;
    const edited = buildManifest();
    edited.customerGroup = [{ key: 'consumer', groupName: 'Consumers' } as unknown as { key: string }, ...(edited.customerGroup ?? []).slice(1)];
    const { code, out } = await seed(api, ['--plan'], edited);
    expect(code).toBe(0);
    expect(out).toMatch(/unchanged\s+taxCategory malva-telecom-services/);
    expect(out).toMatch(/would update\s+customerGroup consumer/);
    expect(out).toMatch(/would skip\s+shippingMethod malva-shipping-standard.*attribute "offer-kind" is not defined/);
    expect(out).toMatch(/PLAN create=\d+ update=1 unchanged=\d+ skip=2/);
    expect(api.writes).toBe(0);
  });

  it('Target not confirmed: refuses before any write and names the project key found', async () => {
    const api = baseline();
    const wrong = await seed(api, ['--confirm-project', 'other']);
    expect(wrong.code).toBe(2);
    expect(wrong.out).toContain('"spec-test-b2c-telecom"');
    const missing = await seed(api, []);
    expect(missing.code).toBe(2);
    const lines: string[] = [];
    const foreign = await main(['--confirm-project', 'other-project'], { api, source: { CTP_SEED_PROJECT_KEY: 'other-project' }, log: (l) => lines.push(l) });
    expect(foreign).toBe(2);
    expect(lines.join('\n')).toContain('"other-project"');
    expect(api.writes).toBe(0);
    expect(api.log).toEqual([]);
  });

  it('refuses credentials that belong to another project', async () => {
    const api = baseline();
    api.project.key = 'some-other-project';
    const { code, out } = await seed(api, ['--plan']);
    expect(code).toBe(2);
    expect(out).toContain('"some-other-project"');
  });

  it('seeds the market-level kinds, defers the shipping methods until a product type defines offer-kind, and a second run writes nothing', async () => {
    const api = baseline();
    const first = await seed(api, ['--confirm-project', 'spec-test-b2c-telecom']);
    expect(first.code).toBe(4);
    expect(first.out).toContain('zones: US=usa DE=europe');
    expect(first.out).toMatch(/skipped\s+shippingMethod malva-shipping-standard\s+\(attribute "offer-kind" is not defined by any product type yet/);
    expect(api.keysOf('shipping-methods')).toEqual([]);
    api.writes = 0;
    const second = await seed(api, ['--confirm-project', 'spec-test-b2c-telecom']);
    expect(api.writes).toBe(0);
    expect(second.out).toMatch(/SUMMARY created=0 updated=0 unchanged=\d+ skipped=2 failed=0/);
  });

  it('creates the shipping methods once a product type defines offer-kind', async () => {
    const api = baseline();
    const m = { ...buildManifest(), productType: [offerType] };
    const first = await seed(api, ['--confirm-project', 'spec-test-b2c-telecom'], m);
    expect(first.code).toBe(0);
    expect(api.keysOf('shipping-methods').sort()).toEqual(['malva-delivery-digital', 'malva-shipping-standard']);
    api.writes = 0;
    const second = await seed(api, ['--confirm-project', 'spec-test-b2c-telecom'], m);
    expect(second.code).toBe(0);
    expect(api.writes).toBe(0);
  });

  it('exits 3 on validation errors before any write', async () => {
    const api = baseline();
    const { code, out } = await seed(api, ['--confirm-project', 'spec-test-b2c-telecom'], { shippingMethod: shippingMethods });
    expect(code).toBe(3);
    expect(out).toContain('Dangling reference: shippingMethod "malva-shipping-standard" references taxCategory "malva-telecom-services"');
    expect(api.writes).toBe(0);
  });

  it('exits 4 when a resource is skipped because of a conflict', async () => {
    const api = baseline();
    const type: ProductTypeDraft = { key: 'malva-offer', name: 'O', description: 'd', attributes: [{ name: 'a', label: { 'en-US': 'A', 'de-DE': 'A' }, isRequired: false, type: { name: 'number' } }] };
    await seed(api, ['--confirm-project', 'spec-test-b2c-telecom'], { productType: [type] });
    const changed: ProductTypeDraft = { ...type, attributes: [{ ...type.attributes[0], type: { name: 'text' } }] };
    const { code, out } = await seed(api, ['--confirm-project', 'spec-test-b2c-telecom'], { productType: [changed] });
    expect(code).toBe(4);
    expect(out).toContain('skipped');
  });

  it('exits 1 when a resource failed', async () => {
    const api = baseline();
    api.failOnCreate = 1;
    const { code, out } = await seed(api, ['--confirm-project', 'spec-test-b2c-telecom']);
    expect(code).toBe(1);
    expect(out).toContain('failed=1');
  });
});
