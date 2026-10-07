import { describe, expect, it } from 'vitest';
import { MANIFEST } from '.';
import type { InventoryDraft } from '../types';
import { equipmentInventory } from './inventory';
import { attr, masterAttr, priceOf, product, variantsOf } from './manifest-access';

describe('equipment', () => {
  it('speeds and technologies as specified', () => {
    const rows: [string, number, string[], string][] = [
      ['malva-router-ac1200', 300, ['cable', 'fixed-wireless'], 'wifi-5'],
      ['malva-router-ax3000', 1000, ['cable', 'fixed-wireless'], 'wifi-6'],
      ['malva-mesh-be9300', 2500, ['cable', 'fixed-wireless'], 'wifi-7'],
      ['malva-modem-docsis31', 2000, ['cable'], 'none'],
      ['malva-5g-gateway', 500, ['fixed-wireless'], 'wifi-6'],
    ];
    for (const [key, speed, technologies, wifi] of rows) {
      const p = product(key);
      expect(masterAttr(p, 'max-downstream-mbps')).toBe(speed);
      expect(masterAttr(p, 'supported-technologies')).toEqual(technologies);
      expect(masterAttr(p, 'wifi-standard')).toBe(wifi);
    }
  });

  it('rental variant is the master with a monthly price, purchase variant has a one-time price; the 5G gateway has only RENT', () => {
    const ax = product('malva-offer-router-ax3000');
    expect(ax.masterVariant.sku).toBe('MLV-EQP-AX3000-RENT');
    expect(ax.variants.map((v) => v.sku)).toEqual(['MLV-EQP-AX3000-BUY']);
    expect(priceOf(ax.masterVariant, 'USD', 'malva-monthly')?.value.centAmount).toBe(800);
    expect(attr(ax.masterVariant, 'charge-type')).toBe('monthly-rental');
    const buy = ax.variants[0];
    expect(priceOf(buy, 'USD')?.value.centAmount).toBe(12999);
    expect(priceOf(buy, 'EUR')?.value.centAmount).toBe(13000);
    expect(buy.prices.every((p) => p.recurrencePolicy === undefined)).toBe(true);
    expect(attr(buy, 'charge-type')).toBe('one-time');
    expect(variantsOf(product('malva-offer-5g-gateway')).map((v) => v.sku)).toEqual(['MLV-EQP-5GGW-RENT']);
  });

  it('nine equipment inventory entries with quantity 500, keyed malva-inv-<sku>', () => {
    expect(equipmentInventory).toHaveLength(9);
    for (const entry of equipmentInventory) {
      expect(entry.quantityOnStock).toBe(500);
      expect(entry.key).toBe(`malva-inv-${entry.sku}`);
    }
    const skus = new Set(equipmentInventory.map((e) => e.sku));
    expect(skus.has('MLV-EQP-5GGW-RENT')).toBe(true);
    expect(skus.has('MLV-EQP-5GGW-BUY')).toBe(false);
  });

  it('services and descriptive SKUs have no inventory (D-019)', () => {
    const inventorySkus = ((MANIFEST.inventory ?? []) as InventoryDraft[]).map((i) => i.sku);
    expect(inventorySkus.some((s) => s.startsWith('MLV-CBL') || s.startsWith('MLV-PHN') || s.startsWith('MLV-ADD') || s.startsWith('MLV-AIR'))).toBe(false);
    expect(inventorySkus.some((s) => s.endsWith('-BASE'))).toBe(false);
  });
});
