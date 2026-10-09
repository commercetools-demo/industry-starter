import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryDrafts, orderHint } from './data/categories';
import { STATES } from './data/states';
import { TAX_CATEGORIES } from './data/tax';
import { CHANNELS, CUSTOM_TYPES, PRODUCT_TYPES, SPECIALTIES } from './data/types';
import { createFakeRoot } from './fake-root';
import { makeCtx, runSteps } from './lib';
import { foundationSteps } from './steps';

const ctxFor = (fake: ReturnType<typeof createFakeRoot>, dryRun = false) => ({ ...makeCtx(fake.root, { dryRun }, () => {}), pauseMs: 0 });
const run = (fake: ReturnType<typeof createFakeRoot>, dryRun = false) => runSteps(foundationSteps(ctxFor(fake, dryRun)), () => {});

describe('foundation data (types, states, categories, tax, channels)', () => {
  it('every key carries the mlv- prefix', () => {
    const keys = [
      ...CHANNELS.map((c) => c.key), ...CUSTOM_TYPES.map((t) => t.key), ...PRODUCT_TYPES.map((t) => t.key),
      ...STATES.map((s) => s.key), ...CATEGORIES.map((c) => c.key), ...TAX_CATEGORIES.map((t) => t.key),
    ];
    expect(keys.every((k) => k.startsWith('mlv-'))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('states form the received to delivered timeline with a cancel path; only received is initial', () => {
    expect(STATES.map((s) => s.key)).toEqual(['mlv-received', 'mlv-pharmacist-review', 'mlv-packed-shipped', 'mlv-delivered', 'mlv-cancelled']);
    expect(STATES.filter((s) => s.initial).map((s) => s.key)).toEqual(['mlv-received']);
    const keys = new Set(STATES.map((s) => s.key));
    expect(STATES.flatMap((s) => s.transitions).every((t) => keys.has(t))).toBe(true);
  });

  it('categories: 7 specialties under mlv-doctors, classes under mlv-medicines, parents listed first, slugs unique', () => {
    const doctors = CATEGORIES.filter((c) => c.parent === 'mlv-doctors');
    expect(doctors).toHaveLength(7);
    expect(doctors.map((c) => c.slug)).toEqual(SPECIALTIES.map((s) => s.key));
    expect(CATEGORIES.filter((c) => c.parent === 'mlv-medicines').length).toBeGreaterThanOrEqual(5);
    CATEGORIES.forEach((c, i) => {
      if (c.parent) expect(CATEGORIES.findIndex((p) => p.key === c.parent)).toBeLessThan(i);
    });
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('order hints are strictly between 0 and 1 and never end in 0', () => {
    for (const d of categoryDrafts()) {
      expect(d.orderHint).toMatch(/^0\.\d*[1-9]$/);
    }
    expect(orderHint(0)).toBe('0.11');
    expect(() => orderHint(9)).toThrow();
  });

  it('tax categories are US 0%, tax-exclusive', () => {
    for (const t of TAX_CATEGORIES) expect(t.rates).toEqual([expect.objectContaining({ country: 'US', amount: 0, includedInPrice: false })]);
    expect(TAX_CATEGORIES.map((t) => t.key)).toEqual(['mlv-rx-medicine', 'mlv-consultation']);
  });

  it('product types: searchable specialty/city/modes, medication flags; custom types target the right resources', () => {
    const doctor = PRODUCT_TYPES.find((t) => t.key === 'mlv-doctor');
    const searchable = doctor?.attributes.filter((a) => a.isSearchable).map((a) => a.name);
    expect(searchable).toEqual(['specialty', 'clinicName', 'city', 'modes']);
    const med = PRODUCT_TYPES.find((t) => t.key === 'mlv-medication');
    expect(med?.attributes.map((a) => a.name)).toEqual(['strength', 'dosageForm', 'rxOnly', 'dispenseUnit', 'minRemainingShelfLifeDays', 'maxQtyPerOrder', 'hsaEligible', 'controlClass']);
    const byKey = Object.fromEntries(CUSTOM_TYPES.map((t) => [t.key, t]));
    expect(byKey['mlv-rx-line'].resourceTypeIds).toEqual(['line-item']);
    expect(byKey['mlv-rx-line'].fieldDefinitions.map((f) => f.name)).toEqual(['rxNumber', 'rxLineRef', 'prescribedQty', 'credentialRef', 'eligibleForRestricted', 'coveredAmount', 'lastSeenUnitPrice', 'dispensedQty', 'authorizationParams', 'suppliedLots', 'credentialValidTo', 'settlement']);
    expect(byKey['mlv-patient'].resourceTypeIds).toEqual(['customer']);
    expect(byKey['mlv-order-meta'].resourceTypeIds).toEqual(['order']);
    expect(byKey['mlv-review-meta'].resourceTypeIds).toEqual(['review']);
  });

  it('channels are price channels', () => {
    expect(CHANNELS.map((c) => c.key)).toEqual(['mlv-remote', 'mlv-office']);
    for (const c of CHANNELS) expect(c.roles).toContain('ProductDistribution');
  });
});

describe('foundation seeding', () => {
  it('creates everything, sets state transitions, and a second run changes nothing', async () => {
    const fake = createFakeRoot();
    const first = await run(fake);
    expect(first.ok).toBe(true);
    expect(first.changed).toBeGreaterThan(0);
    expect(fake.store.states).toHaveLength(5);
    const received = fake.store.states.find((s) => s.key === 'mlv-received');
    expect((received?.transitions as unknown[]).length).toBe(2);
    expect(fake.store.categories).toHaveLength(CATEGORIES.length);
    expect(fake.store.productTypes).toHaveLength(2);
    expect(fake.store.types).toHaveLength(CUSTOM_TYPES.length);
    const before = fake.log.length;
    expect(await run(fake)).toMatchObject({ ok: true, changed: 0 });
    expect(fake.log.length).toBe(before);
  });

  it('dry run writes nothing', async () => {
    const fake = createFakeRoot();
    const r = await run(fake, true);
    expect(r.changed).toBeGreaterThan(0);
    expect(fake.log).toEqual([]);
  });

  it('updates a differing tax rate in place, and a second run changes nothing', async () => {
    const fake = createFakeRoot({ taxCategories: [{ key: 'mlv-rx-medicine', rates: [{ country: 'US', amount: 0.2 }] }] });
    const r = await run(fake);
    expect(r.ok).toBe(true);
    expect(fake.log.some((l) => l.op === 'update' && l.kind === 'taxCategories' && l.actions?.includes('replaceTaxRate'))).toBe(true);
    expect((fake.store.taxCategories.find((t) => t.key === 'mlv-rx-medicine')?.rates as { amount: number }[])[0].amount).toBe(0);
    expect((await run(fake)).changed).toBe(0);
  });
});
