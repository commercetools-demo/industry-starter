import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './data/categories';
import { DOCTORS } from './data/doctors';
import { MEDICATIONS, medicationDraft, medicationInventory, medKey, medSku, STOCK } from './data/medications';
import { createFakeRoot } from './fake-root';
import { inventoryDraft, makeCtx, runSteps } from './lib';
import { foundationSteps, medicationSteps } from './steps';
import { DEFAULT_EXPECTED } from './wait-for-search';

const byName = (name: string) => MEDICATIONS.find((d) => d.name.startsWith(name));

describe('medication data', () => {
  it('has about 20 medications; the default search count equals doctors plus medications', () => {
    expect(MEDICATIONS).toHaveLength(20);
    expect(DEFAULT_EXPECTED).toBe(DOCTORS.length + MEDICATIONS.length);
  });

  it('SKUs, keys and slugs are unique and carry the prefixes', () => {
    for (const pick of [medSku, medKey, (d: (typeof MEDICATIONS)[number]) => d.slug]) {
      const values = MEDICATIONS.map(pick);
      expect(new Set(values).size).toBe(values.length);
    }
    expect(MEDICATIONS.every((d) => medSku(d).startsWith('MED-') && medKey(d).startsWith('mlv-med-'))).toBe(true);
  });

  it('the five prototype medicines have the prototype prices in USD cents', () => {
    expect(byName('Amoxicillin 500')?.priceCents).toBe(1450);
    expect(byName('Ibuprofen 400')?.priceCents).toBe(620);
    expect(byName('Cetirizine 10')?.priceCents).toBe(890);
    expect(byName('Atorvastatin 20')?.priceCents).toBe(1875);
    expect(byName('Lisinopril 10')?.priceCents).toBe(1140);
    expect(byName('Amoxicillin 500')?.packSize).toBe(21);
    expect(byName('Atorvastatin 20')?.packSize).toBe(30);
  });

  it('every price is a positive integer USD amount in cents (no floats)', () => {
    for (const d of MEDICATIONS) {
      const price = medicationDraft(d).masterVariant.prices[0].value;
      expect(price.currencyCode).toBe('USD');
      expect(Number.isInteger(price.centAmount) && price.centAmount > 0).toBe(true);
    }
  });

  it('maxQtyPerOrder matches the native inventory limit, and no limit when the product has no ceiling', () => {
    for (const d of MEDICATIONS) {
      const attr = medicationDraft(d).masterVariant.attributes.find((a) => a.name === 'maxQtyPerOrder');
      const inv = inventoryDraft(medicationInventory(d));
      expect(inv.maxCartQuantity).toBe(attr?.value);
      expect(inv.key).toBe(`mlv-inv-${medSku(d)}`);
      expect(inv.sku).toBe(medSku(d));
      expect(inv.quantityOnStock).toBeGreaterThanOrEqual(500);
    }
    expect(MEDICATIONS.some((d) => d.maxQtyPerOrder === undefined)).toBe(true);
    expect(STOCK).toBeGreaterThanOrEqual(500);
  });

  it('two controlled demo products; HSA flag set; every class exists as a category', () => {
    expect(MEDICATIONS.filter((d) => d.controlClass !== 'none')).toHaveLength(2);
    expect(MEDICATIONS.some((d) => d.hsaEligible)).toBe(true);
    const keys = new Set(CATEGORIES.map((c) => c.key));
    for (const d of MEDICATIONS) expect(keys.has(medicationDraft(d).categories[0].key)).toBe(true);
    for (const d of MEDICATIONS) {
      const names = medicationDraft(d).masterVariant.attributes.map((a) => a.name);
      expect(names).toEqual(expect.arrayContaining(['strength', 'dosageForm', 'rxOnly', 'dispenseUnit', 'minRemainingShelfLifeDays', 'hsaEligible', 'controlClass']));
    }
  });

  it('exactly one SKU carries a short-dated expiryDate on its inventory entry', () => {
    const dated = MEDICATIONS.filter((d) => d.expiryDate);
    expect(dated).toHaveLength(1);
    expect(medicationInventory(dated[0]).custom).toEqual({ type: { typeId: 'type', key: 'mlv-inventory-meta' }, fields: { expiryDate: '2026-11-15' } });
    expect(dated[0].expiryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses the 0% medicine tax category, is published, and has a generic image query', () => {
    const d = medicationDraft(MEDICATIONS[0]);
    expect(d.taxCategory.key).toBe('mlv-rx-medicine');
    expect(d.publish).toBe(true);
    expect(MEDICATIONS.every((x) => x.imageQuery.length > 0 && !x.imageQuery.includes(x.name.split(' ')[0]))).toBe(true);
  });
});

describe('medication seeding', () => {
  it('creates products and inventory with limits, then a second run changes nothing', async () => {
    const fake = createFakeRoot();
    const ctx = { ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 };
    await runSteps(foundationSteps(ctx), () => {});
    expect(await runSteps(medicationSteps(ctx), () => {})).toMatchObject({ ok: true, changed: 40 });
    expect(fake.store.inventory).toHaveLength(20);
    const amox = fake.store.inventory.find((i) => i.sku === 'MED-amoxicillin-500-mg');
    expect(amox?.maxCartQuantity).toBe(2);
    const famotidine = fake.store.inventory.find((i) => i.sku === 'MED-famotidine-20-mg');
    expect((famotidine?.custom as { fields: { expiryDate: string } }).fields.expiryDate).toBe('2026-11-15');
    expect(await runSteps(medicationSteps(ctx), () => {})).toMatchObject({ ok: true, changed: 0 });
  });

  it('a changed cart limit is reported', async () => {
    const fake = createFakeRoot();
    const ctx = { ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 };
    await runSteps(medicationSteps(ctx, { only: 'mlv-med-amoxicillin-500-mg' }), () => {});
    fake.store.inventory[0].maxCartQuantity = 99;
    expect((await runSteps(medicationSteps(ctx, { only: 'mlv-med-amoxicillin-500-mg' }), () => {})).ok).toBe(false);
  });
});
