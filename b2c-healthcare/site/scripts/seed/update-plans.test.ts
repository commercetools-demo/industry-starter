import { describe, expect, it } from 'vitest';
import { DOCTORS, doctorDraft } from './data/doctors';
import { CUSTOM_TYPES, PRODUCT_TYPES } from './data/types';
import { createFakeRoot } from './fake-root';
import { makeCtx, runSteps } from './lib';
import { runSeed } from './seed';
import { typeSteps } from './steps';
import { customTypePlan, productPlan, productTypePlan, RESET_HINT } from './update-plans';

const ctxOf = (fake: ReturnType<typeof createFakeRoot>) => ({ ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 });
const doctorType = () => structuredClone(PRODUCT_TYPES[0]) as unknown as Record<string, unknown> & { attributes: Record<string, unknown>[] };

describe('seed update plans: a changed seed updates existing resources (D-038)', () => {
  it('a new product type attribute is added and a changed isSearchable is sent as changeIsSearchable', () => {
    const existing = doctorType();
    existing.attributes = existing.attributes.filter((a) => a.name !== 'timezone').map((a) => (a.name === 'clinicName' ? { ...a, isSearchable: false } : a));
    const plan = productTypePlan(existing, PRODUCT_TYPES[0] as never);
    expect(plan.blocked).toBeUndefined();
    expect(plan.actions.map((a) => a.action).sort()).toEqual(['addAttributeDefinition', 'changeIsSearchable']);
    expect(plan.actions.find((a) => a.action === 'changeIsSearchable')).toMatchObject({ attributeName: 'clinicName', isSearchable: true });
  });

  it('a new enum value is added', () => {
    const existing = doctorType();
    existing.attributes = existing.attributes.map((a) => (a.name === 'city' ? { ...a, type: { name: 'enum', values: [{ key: 'new-york', label: 'New York' }] } } : a));
    const plan = productTypePlan(existing, PRODUCT_TYPES[0] as never);
    expect(plan.actions.filter((a) => a.action === 'addPlainEnumValue').map((a) => (a.value as { key: string }).key)).toEqual(['austin', 'chicago']);
  });

  it('an attribute type change, a tightened constraint and a removed attribute are blocked and name the reset', () => {
    const typeChanged = doctorType();
    typeChanged.attributes = typeChanged.attributes.map((a) => (a.name === 'yearsExperience' ? { ...a, type: { name: 'text' } } : a));
    const p1 = productTypePlan(typeChanged, PRODUCT_TYPES[0] as never);
    expect(p1.blocked).toContain('"yearsExperience" changed type (text to number)');
    expect(p1.blocked).toContain(RESET_HINT);

    const tightened = doctorType();
    tightened.attributes = tightened.attributes.map((a) => (a.name === 'city' ? { ...a, attributeConstraint: 'SameForAll' } : a));
    // existing SameForAll can be relaxed to None (the draft is None)
    expect(productTypePlan(tightened, PRODUCT_TYPES[0] as never)).toMatchObject({ actions: [{ action: 'changeAttributeConstraint', attributeName: 'city', newValue: 'None' }] });
    const draftTight = { ...PRODUCT_TYPES[0], attributes: PRODUCT_TYPES[0].attributes.map((a) => (a.name === 'city' ? { ...a, attributeConstraint: 'SameForAll' } : a)) };
    expect(productTypePlan(doctorType(), draftTight as never).blocked).toContain('can only be relaxed to None');

    const removed = doctorType();
    removed.attributes = [...removed.attributes, { name: 'extra', label: {}, isRequired: false, isSearchable: false, attributeConstraint: 'None', type: { name: 'text' } }];
    expect(productTypePlan(removed, PRODUCT_TYPES[0] as never).blocked).toContain('extra');
  });

  it('a new custom type field is added; a changed field type is blocked', () => {
    const rx = structuredClone(CUSTOM_TYPES[0]) as unknown as { fieldDefinitions: { name: string; type: { name: string } }[] };
    const missing = { ...rx, fieldDefinitions: rx.fieldDefinitions.filter((f) => f.name !== 'settlement') };
    expect(customTypePlan(missing, CUSTOM_TYPES[0] as never).actions).toMatchObject([{ action: 'addFieldDefinition', fieldDefinition: { name: 'settlement' } }]);
    const retyped = { ...rx, fieldDefinitions: rx.fieldDefinitions.map((f) => (f.name === 'rxNumber' ? { ...f, type: { name: 'Number' } } : f)) };
    expect(customTypePlan(retyped, CUSTOM_TYPES[0] as never).blocked).toContain('rxNumber');
  });

  it('seed on a project built from an older seed: type fields, searchability, prices and attributes are updated, then nothing changes', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake));
    // age the project: no clinicName searchability, a missing custom field, a doctor priced without the channel
    const type = fake.store.productTypes.find((t) => t.key === 'mlv-doctor') as { attributes: { name: string; isSearchable: boolean }[] };
    type.attributes.find((a) => a.name === 'clinicName')!.isSearchable = false;
    const rxLine = fake.store.types.find((t) => t.key === 'mlv-rx-line') as { fieldDefinitions: { name: string }[] };
    rxLine.fieldDefinitions = rxLine.fieldDefinitions.filter((f) => f.name !== 'settlement');
    const alvarez = fake.store.products.find((p) => p.key === 'mlv-doc-tomas-alvarez') as { masterData: { staged: { masterVariant: { prices: Record<string, unknown>[]; attributes: { name: string; value: unknown }[] } } } };
    alvarez.masterData.staged.masterVariant.prices = [{ id: 'old', value: { currencyCode: 'USD', centAmount: 3000 } }];
    alvarez.masterData.staged.masterVariant.attributes.find((a) => a.name === 'clinicName')!.value = 'Old clinic';
    fake.log.length = 0;

    const run = await runSeed(ctxOf(fake));
    expect(run.ok).toBe(true);
    const actions = fake.log.filter((l) => l.op === 'update').map((l) => `${l.kind}:${l.actions?.join('+')}`);
    expect(actions).toContain('productTypes:changeIsSearchable');
    expect(actions).toContain('types:addFieldDefinition');
    expect(actions.some((a) => a.startsWith('products:') && a.includes('removePrice') && a.includes('addPrice') && a.includes('setAttribute') && a.endsWith('publish'))).toBe(true);
    expect(alvarez.masterData.staged.masterVariant.prices).toHaveLength(1);
    expect((await runSeed(ctxOf(fake))).changed).toBe(0);
  });

  it('a product on another SKU is blocked, not rewritten', async () => {
    const fake = createFakeRoot();
    const ctx = ctxOf(fake);
    const d = doctorDraft(DOCTORS[0]);
    const plan = await productPlan({ masterData: { published: true, staged: { masterVariant: { sku: 'OTHER' } } } }, d, ctx);
    expect(plan.blocked).toContain('sku is OTHER');
    expect(plan.blocked).toContain('seed:full');
  });

  it('a blocked difference stops the run with the exit-1 message that names the reset', async () => {
    const fake = createFakeRoot();
    await runSteps(typeSteps(ctxOf(fake)), () => {});
    const type = fake.store.productTypes.find((t) => t.key === 'mlv-doctor') as { attributes: { name: string; type: unknown }[] };
    type.attributes.find((a) => a.name === 'yearsExperience')!.type = { name: 'text' };
    const lines: string[] = [];
    const r = await runSteps(typeSteps(ctxOf(fake)), (l) => lines.push(l));
    expect(r.ok).toBe(false);
    expect(lines.at(-1)).toMatch(/^STOP .*yearsExperience.*npm run seed:full/);
  });
});
