import { describe, expect, it } from 'vitest';
import { MANIFEST } from '.';
import { deviceInventory } from './inventory';
import { attr, priceOf, product, variantsOf } from './manifest-access';

const pair = (v: { attributes: { name: string; value: unknown }[] }): string => `${String(attr(v as never, 'color'))}/${String(attr(v as never, 'memory-gb'))}`;

describe('handsets', () => {
  it('Handset is one product with its options as variants: color and memory only', () => {
    for (const key of ['malva-phone-nova-5g', 'malva-phone-nova-pro', 'malva-offer-phone-nova-5g', 'malva-offer-phone-nova-pro']) {
      const p = product(key);
      const variants = variantsOf(p);
      const pairs = variants.map(pair);
      expect(new Set(pairs).size, `${key} color/memory pairs are unique`).toBe(variants.length);
      // every other attribute is identical across the variants of one product (the SameForAll ones)
      const names = new Set(variants.flatMap((v) => v.attributes.map((a) => a.name)));
      for (const name of names) {
        if (['color', 'memory-gb'].includes(name)) continue;
        if (name === 'charge-type' || name === 'contract-term') continue;
        const values = new Set(variants.map((v) => JSON.stringify(attr(v, name))));
        expect(values.size, `${key}.${name}`).toBe(1);
      }
      // no acquisition attribute: the mode is a line item field (D-015)
      expect([...names].some((n) => n.includes('acquisition'))).toBe(false);
    }
  });

  it('Nova 5G has 4 variants and Nova Pro 6, in the devices category', () => {
    const nova = product('malva-offer-phone-nova-5g');
    const pro = product('malva-offer-phone-nova-pro');
    expect(variantsOf(nova)).toHaveLength(4);
    expect(variantsOf(pro)).toHaveLength(6);
    expect(nova.categories).toEqual(['malva-cat-devices']);
    expect(nova.masterVariant.sku).toBe('MLV-DEV-NOVA5G-BLK-128');
    expect(pro.masterVariant.sku).toBe('MLV-DEV-NOVAPRO-BLK-256');
  });

  it('every variant has outright and four recurring prices per currency', () => {
    for (const key of ['malva-offer-phone-nova-5g', 'malva-offer-phone-nova-pro']) {
      for (const v of variantsOf(product(key))) {
        for (const currency of ['USD', 'EUR'] as const) {
          expect(priceOf(v, currency)).toBeDefined();
          for (const policy of ['malva-device-installment-12', 'malva-device-installment-24', 'malva-device-installment-36', 'malva-device-lease-24']) {
            expect(priceOf(v, currency, policy), `${v.sku} ${currency} ${policy}`).toBeDefined();
          }
        }
        expect(v.prices).toHaveLength(10);
      }
    }
    const first = product('malva-offer-phone-nova-5g').masterVariant;
    expect(priceOf(first, 'USD')?.value.centAmount).toBe(49900);
    expect(priceOf(first, 'USD', 'malva-device-installment-12')?.value.centAmount).toBe(4158);
    expect(priceOf(first, 'EUR', 'malva-device-installment-12')?.value.centAmount).toBe(4200);
  });

  it('ten handset inventory entries of 200, VLT-512 at 0', () => {
    expect(deviceInventory).toHaveLength(10);
    for (const entry of deviceInventory) expect(entry.quantityOnStock).toBe(entry.sku === 'MLV-DEV-NOVAPRO-VLT-512' ? 0 : 200);
    expect(MANIFEST.inventory).toHaveLength(19);
  });
});
