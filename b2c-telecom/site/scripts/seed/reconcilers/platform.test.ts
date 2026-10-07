import { describe, expect, it } from 'vitest';
import { customerGroups } from '../data/customer-groups';
import { recurrencePolicies } from '../data/recurrence';
import { taxCategories } from '../data/tax';
import { zoneCoverage } from '../data/zones';
import { applyPlan, newCtx, planAll } from '../reconcile';
import { FakeCt } from '../test/fake-ct';
import type { SeedManifest, TaxCategoryDraft, TypeDraft } from '../types';
import { reconcilers } from './registry';

function baseline(): FakeCt {
  const api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }, { country: 'GB' }] });
  return api;
}

const manifest: SeedManifest = { taxCategory: taxCategories, zoneCoverage, customerGroup: customerGroups, recurrencePolicy: recurrencePolicies };

async function seed(api: FakeCt, m: SeedManifest = manifest) {
  const ctx = newCtx();
  const plan = await planAll(api, m, reconcilers, ctx);
  const results = await applyPlan(api, m, plan, reconcilers, ctx);
  return { ctx, results };
}

describe('platform reconcilers', () => {
  it('writes 0 percent placeholder tax rates for US and DE', async () => {
    const api = baseline();
    await seed(api);
    const tax = api.byKey('tax-categories', 'malva-telecom-services');
    const rates = tax?.rates as { country: string; amount: number }[];
    expect(rates.map((r) => [r.country, r.amount]).sort()).toEqual([['DE', 0], ['US', 0]]);
  });

  it('adopts the existing usa and europe zones and creates none', async () => {
    const api = baseline();
    const { ctx } = await seed(api);
    expect(ctx.zoneKeys).toEqual({ US: 'usa', DE: 'europe' });
    expect(api.list('zones')).toHaveLength(2);
  });

  it('creates malva-zone-us only when no zone holds US', async () => {
    const api = new FakeCt();
    api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
    const { ctx } = await seed(api);
    expect(ctx.zoneKeys).toEqual({ US: 'malva-zone-us', DE: 'europe' });
    expect(api.keysOf('zones').sort()).toEqual(['europe', 'malva-zone-us']);
  });

  it('creates the monthly recurrence policy with a Months x 1 schedule', async () => {
    const api = baseline();
    await seed(api);
    expect(api.byKey('recurrence-policies', 'malva-monthly')?.schedule).toEqual({ type: 'standard', value: 1, intervalUnit: 'Months' });
  });

  it('creates the four customer groups with their exact keys', async () => {
    const api = baseline();
    await seed(api);
    expect(api.keysOf('customer-groups').sort()).toEqual(['consumer', 'employee', 'existing-customer', 'small-business']);
  });

  it('a second run performs no write', async () => {
    const api = baseline();
    await seed(api);
    api.writes = 0;
    const { results } = await seed(api);
    expect(api.writes).toBe(0);
    expect(results.every((r) => r.outcome.status === 'unchanged')).toBe(true);
  });

  it('changes a tax rate in place with replaceTaxRate', async () => {
    const api = baseline();
    await seed(api);
    const tax: TaxCategoryDraft = { ...taxCategories[0], rates: [{ ...taxCategories[0].rates[0], amount: 0.07 }, taxCategories[0].rates[1]] };
    const edited: SeedManifest = { ...manifest, taxCategory: [tax] };
    await seed(api, edited);
    expect(api.log.some((l) => l === 'update tax-categories malva-telecom-services replaceTaxRate')).toBe(true);
  });
});

describe('custom type reconciler', () => {
  const type: TypeDraft = {
    key: 'malva-test-type',
    name: { 'en-US': 'T', 'de-DE': 'T' },
    resourceTypeIds: ['order'],
    fieldDefinitions: [
      { name: 'a', label: { 'en-US': 'A', 'de-DE': 'A' }, required: false, type: { name: 'String' } },
      { name: 'e', label: { 'en-US': 'E', 'de-DE': 'E' }, required: false, type: { name: 'Enum', values: [{ key: 'x', label: 'X' }] } },
    ],
  };

  it('adds a field and an enum value without touching the rest', async () => {
    const api = baseline();
    await seed(api, { type: [type] });
    const edited: TypeDraft = {
      ...type,
      fieldDefinitions: [
        ...type.fieldDefinitions.slice(0, 1),
        { ...type.fieldDefinitions[1], type: { name: 'Enum', values: [{ key: 'x', label: 'X' }, { key: 'y', label: 'Y' }] } },
        { name: 'b', label: { 'en-US': 'B', 'de-DE': 'B' }, required: false, type: { name: 'Boolean' } },
      ],
    };
    await seed(api, { type: [edited] });
    expect(api.log.at(-1)).toBe('update types malva-test-type addEnumValue,addFieldDefinition');
  });

  it('reports a changed field type as a conflict', async () => {
    const api = baseline();
    await seed(api, { type: [type] });
    const changed: TypeDraft = { ...type, fieldDefinitions: [{ ...type.fieldDefinitions[0], type: { name: 'Number' } }, type.fieldDefinitions[1]] };
    const { results } = await seed(api, { type: [changed] });
    expect(results[0].outcome).toEqual({ status: 'skipped', reason: 'field "a" changed type' });
  });
});
