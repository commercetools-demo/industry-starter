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

  const INSTALLMENT_POLICIES = [12, 24, 36].map((term) => [term, `malva-device-installment-${term}`] as const);
  const HOLE = { sku: 'MLV-DEV-NOVA5G-SLV-256', policy: 'malva-device-installment-36' };

  it('every variant has an outright price and its installment prices per currency; Nova Pro adds a lease, Nova 5G has none', () => {
    for (const key of ['malva-offer-phone-nova-5g', 'malva-offer-phone-nova-pro']) {
      const lease = key.endsWith('nova-pro');
      for (const v of variantsOf(product(key))) {
        for (const currency of ['USD', 'EUR'] as const) {
          expect(priceOf(v, currency), `${v.sku} ${currency} outright`).toBeDefined();
          for (const [, policy] of INSTALLMENT_POLICIES) {
            if (v.sku === HOLE.sku && policy === HOLE.policy) continue;
            expect(priceOf(v, currency, policy), `${v.sku} ${currency} ${policy}`).toBeDefined();
          }
          expect(priceOf(v, currency, 'malva-device-lease-24') !== undefined, `${v.sku} ${currency} lease`).toBe(lease);
        }
      }
    }
    const first = product('malva-offer-phone-nova-5g').masterVariant;
    expect(priceOf(first, 'USD')?.value.centAmount).toBe(72000);
    expect(priceOf(first, 'USD', 'malva-device-installment-12')?.value.centAmount).toBe(6000);
    expect(priceOf(first, 'EUR', 'malva-device-installment-12')?.value.centAmount).toBe(5400);
  });

  it('every installment price times its term equals the outright price exactly (no rounding), in both currencies', () => {
    for (const key of ['malva-offer-phone-nova-5g', 'malva-offer-phone-nova-pro']) {
      for (const v of variantsOf(product(key))) {
        for (const currency of ['USD', 'EUR'] as const) {
          const outright = priceOf(v, currency)?.value.centAmount ?? 0;
          for (const [term, policy] of INSTALLMENT_POLICIES) {
            const price = priceOf(v, currency, policy);
            if (price) expect(price.value.centAmount * term, `${v.sku} ${currency} ${term}`).toBe(outright);
          }
        }
      }
    }
  });

  it('the lease total over 24 months stays below the outright price', () => {
    for (const v of variantsOf(product('malva-offer-phone-nova-pro'))) {
      for (const currency of ['USD', 'EUR'] as const) {
        const lease = priceOf(v, currency, 'malva-device-lease-24')?.value.centAmount ?? 0;
        expect(lease * 24).toBeLessThan(priceOf(v, currency)?.value.centAmount ?? 0);
      }
    }
    expect(priceOf(product('malva-offer-phone-nova-pro').masterVariant, 'USD', 'malva-device-lease-24')?.value.centAmount).toBe(3300);
  });

  it('price depends on memory, never on color', () => {
    for (const key of ['malva-offer-phone-nova-5g', 'malva-offer-phone-nova-pro']) {
      const byMemory = new Map<string, number>();
      for (const v of variantsOf(product(key))) {
        const memory = String(attr(v, 'memory-gb'));
        const cents = priceOf(v, 'USD')?.value.centAmount ?? 0;
        expect(byMemory.get(memory) ?? cents).toBe(cents);
        byMemory.set(memory, cents);
      }
    }
  });

  it('the one deliberate hole: Nova 5G 256 GB Silver has no 36-month installment price, in USD and EUR', () => {
    const v = variantsOf(product('malva-offer-phone-nova-5g')).find((candidate) => candidate.sku === HOLE.sku);
    expect(v).toBeDefined();
    for (const currency of ['USD', 'EUR'] as const) {
      expect(priceOf(v as never, currency, HOLE.policy)).toBeUndefined();
      expect(priceOf(v as never, currency, 'malva-device-installment-24')).toBeDefined();
    }
    const holes = variantsOf(product('malva-offer-phone-nova-5g')).concat(variantsOf(product('malva-offer-phone-nova-pro'))).filter((candidate) => !priceOf(candidate, 'USD', HOLE.policy));
    expect(holes.map((candidate) => candidate.sku)).toContain(HOLE.sku);
    expect(holes.filter((candidate) => candidate.sku !== HOLE.sku).every((candidate) => candidate.sku.startsWith('MLV-DEV-NOVAPRO') === false)).toBe(true);
  });

  it('no handset price carries a channel', () => {
    for (const key of ['malva-offer-phone-nova-5g', 'malva-offer-phone-nova-pro']) {
      for (const v of variantsOf(product(key))) {
        for (const price of v.prices) expect((price as { channel?: unknown }).channel, `${v.sku} ${price.key}`).toBeUndefined();
      }
    }
  });

  it('ten handset inventory entries of 200, VLT-512 at 0', () => {
    expect(deviceInventory).toHaveLength(10);
    for (const entry of deviceInventory) expect(entry.quantityOnStock).toBe(entry.sku === 'MLV-DEV-NOVAPRO-VLT-512' ? 0 : 200);
    expect(MANIFEST.inventory).toHaveLength(19);
  });
});
