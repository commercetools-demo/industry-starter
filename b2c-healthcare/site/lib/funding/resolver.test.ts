import { describe, expect, it } from 'vitest';
import { MEDICATIONS, medSku } from '../../scripts/seed/data/medications';
import { DEMO_SKU_CLASS } from './demo-classes';
import { createDemoResolver, ORDER_COVER_CAP, FundingUnavailableError, getFundingResolver, normalizeScheme, resolverForcedToFail } from './resolver';

const sam = { patientRef: 'pt_sam', fundingScheme: 'Demo Health Plan' };
const NOW = new Date('2026-10-08T12:00:00Z');
const resolver = createDemoResolver({ now: () => NOW });

describe('payer-and-patient-cost-share: demo resolver', () => {
  it('Covered line shows both figures: a cardiovascular pack is 80% covered, the patient owes the rest', async () => {
    const r = await resolver.resolve(sam, [{ sku: 'MED-atorvastatin-20-mg', unit: 1875, quantity: 1 }]);
    expect(r.scheme).toBe('demo-health-plan');
    expect(r.resolvedAt).toBe(NOW.toISOString());
    expect(r.perLine[0]).toEqual({ sku: 'MED-atorvastatin-20-mg', covered: 1500, owed: 375, status: 'partly' });
  });

  it('Fully covered line: owed is zero', async () => {
    const [line] = (await resolver.resolve(sam, [{ sku: 'MED-metformin-500-mg', unit: 820, quantity: 1 }])).perLine;
    expect(line).toMatchObject({ covered: 820, owed: 0, status: 'covered' });
  });

  it('Uncovered line in a covered basket: OTC is not covered while the cardiovascular line is', async () => {
    const r = await resolver.resolve(sam, [
      { sku: 'MED-lisinopril-10-mg', unit: 1140, quantity: 1 },
      { sku: 'MED-ibuprofen-400-mg', unit: 620, quantity: 1 },
    ]);
    expect(r.perLine.map((l) => l.status)).toEqual(['partly', 'not-covered']);
    expect(r.perLine[1]).toMatchObject({ covered: 0, owed: 620 });
  });

  it('Basket change alters existing cover: the plan pays at most the order cap, so a new covered line lowers the others', async () => {
    const before = await resolver.resolve(sam, [
      { sku: 'MED-atorvastatin-20-mg', unit: 1875, quantity: 1 },
      { sku: 'MED-lisinopril-10-mg', unit: 1140, quantity: 1 },
    ]);
    expect(before.perLine.map((l) => l.covered)).toEqual([1500, 912]);
    const after = await resolver.resolve(sam, [
      { sku: 'MED-atorvastatin-20-mg', unit: 1875, quantity: 1 },
      { sku: 'MED-lisinopril-10-mg', unit: 1140, quantity: 1 },
      { sku: 'MED-amoxicillin-500-mg', unit: 1450, quantity: 1 },
    ]);
    expect(after.perLine[0].covered).toBeLessThan(1500);
    expect(after.perLine[0].owed).toBeGreaterThan(375);
    expect(after.perLine.reduce((sum, l) => sum + l.covered, 0)).toBeLessThanOrEqual(ORDER_COVER_CAP);
  });

  it('antibiotics are 50% covered', async () => {
    const [line] = (await resolver.resolve(sam, [{ sku: 'MED-amoxicillin-500-mg', unit: 1450, quantity: 1 }])).perLine;
    expect(line).toMatchObject({ covered: 725, owed: 725 });
  });

  it('a patient without a scheme gets no cover and the scheme is null', async () => {
    const r = await resolver.resolve({ patientRef: 'pt_alex' }, [{ sku: 'MED-atorvastatin-20-mg', unit: 1875, quantity: 1 }]);
    expect(r.scheme).toBeNull();
    expect(r.perLine[0]).toMatchObject({ covered: 0, owed: 1875 });
  });

  it('Resolver unavailable: the failure mode throws, there is no default price', async () => {
    const failing = createDemoResolver({ forceFail: true });
    await expect(failing.resolve(sam, [{ sku: 'MED-atorvastatin-20-mg', unit: 1875, quantity: 1 }])).rejects.toBeInstanceOf(FundingUnavailableError);
  });

  it('RESOLVER_FORCE_FAIL=1 forces failure outside production only', async () => {
    expect(resolverForcedToFail({ RESOLVER_FORCE_FAIL: '1' })).toBe(true);
    expect(resolverForcedToFail({ RESOLVER_FORCE_FAIL: '1', NODE_ENV: 'production' })).toBe(false);
    expect(resolverForcedToFail({})).toBe(false);
    await expect(getFundingResolver({ RESOLVER_FORCE_FAIL: '1' }).resolve(sam, [])).rejects.toBeInstanceOf(FundingUnavailableError);
    await expect(getFundingResolver({ RESOLVER_FORCE_FAIL: '1', NODE_ENV: 'production' }).resolve(sam, [])).resolves.toMatchObject({ perLine: [] });
  });

  it('scheme names match however they are written', () => {
    expect(normalizeScheme('Demo Health Plan')).toBe('demo-health-plan');
    expect(normalizeScheme('demo-health-plan')).toBe('demo-health-plan');
    expect(normalizeScheme('Other')).toBeNull();
    expect(normalizeScheme(undefined)).toBeNull();
  });
});

describe('demo class table', () => {
  it('matches the seeded medications', () => {
    const fromSeed = Object.fromEntries(MEDICATIONS.map((m) => [medSku(m), m.cls]));
    expect(DEMO_SKU_CLASS).toEqual(fromSeed);
  });
});
