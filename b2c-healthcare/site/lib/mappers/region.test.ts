import type { ProductProjection } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { mapDoctor, mapDoctorCard } from './doctor';
import { mapMedication } from './medication';

const price = (centAmount: number, currencyCode: string, channel?: string) => ({
  id: `${currencyCode}-${channel ?? 'base'}`,
  value: { type: 'centPrecision', centAmount, currencyCode, fractionDigits: 2 },
  ...(channel ? { channel: { typeId: 'channel', id: `id-${channel}`, obj: { key: channel } } } : {}),
});

const product = (prices: unknown[]) =>
  ({
    id: 'p1',
    key: 'k1',
    name: { 'en-US': 'Name' },
    slug: { 'en-US': 'name' },
    categories: [],
    masterVariant: { id: 1, sku: 'SKU-1', prices, attributes: [] },
  }) as unknown as ProductProjection;

describe('switching-region-or-language: Product not sellable in the new region (read flag)', () => {
  it('medication without a price in the visitor currency is flagged, with no price to show', () => {
    const m = mapMedication(product([price(1450, 'USD')]), { locale: 'de-DE', currency: 'EUR' });
    expect(m.price).toBeNull();
    expect(m.sellableInRegion).toBe(false);
  });

  it('medication with a price in the visitor currency is sellable', () => {
    const m = mapMedication(product([price(1450, 'USD'), price(1300, 'EUR')]), { locale: 'de-DE', currency: 'EUR' });
    expect(m.price).toEqual({ centAmount: 1300, currencyCode: 'EUR', fractionDigits: 2 });
    expect(m.sellableInRegion).toBe(true);
  });

  it('doctor with no fee in the visitor currency is flagged and offers no fee', () => {
    const projection = product([price(3500, 'USD', 'mlv-remote'), price(5500, 'USD', 'mlv-office')]);
    const eur = mapDoctor(projection, { locale: 'de-DE', currency: 'EUR' });
    expect(eur.fees).toEqual({});
    expect(eur.sellableInRegion).toBe(false);
    const usd = mapDoctorCard(projection, { locale: 'en-US', currency: 'USD' });
    expect(usd.sellableInRegion).toBe(true);
    expect(Object.keys(usd.fees)).toEqual(['remote', 'office']);
  });

  it('doctor priced in the new currency on one mode only is still sellable (that mode)', () => {
    const d = mapDoctorCard(product([price(3500, 'USD', 'mlv-remote'), price(3000, 'EUR', 'mlv-remote')]), { locale: 'de-DE', currency: 'EUR' });
    expect(d.sellableInRegion).toBe(true);
    expect(Object.keys(d.fees)).toEqual(['remote']);
  });
});
