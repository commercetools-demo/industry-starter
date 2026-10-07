import { describe, expect, it } from 'vitest';
import { MANIFEST } from '.';
import type { ProductDraft } from '../types';
import { priceKey } from './catalog-types';
import { ADDON_PRICES, CABLE_ACTIVATION_FEE_CENTS, DEVICE_OUTRIGHT, EQUIPMENT_PRICES, PLAN_PRICES, eurFromUsd, financedPrices, installmentCents, leaseCents, monthlyPrices, oneTimePrices } from './prices';

describe('prices', () => {
  it('EUR rule: USD rounded to whole euros, half rounds up', () => {
    expect(eurFromUsd(3999)).toBe(4000);
    expect(eurFromUsd(4499)).toBe(4500);
    expect(eurFromUsd(12999)).toBe(13000);
    expect(eurFromUsd(4150)).toBe(4200);
    expect(eurFromUsd(4149)).toBe(4100);
  });

  it('monthly prices are tied to malva-monthly, one-time prices have no policy', () => {
    expect(monthlyPrices(5999)).toEqual([
      { currency: 'USD', centAmount: 5999, country: 'US', recurrencePolicy: 'malva-monthly' },
      { currency: 'EUR', centAmount: 6000, country: 'DE', recurrencePolicy: 'malva-monthly' },
    ]);
    expect(oneTimePrices(7999)).toEqual([
      { currency: 'USD', centAmount: 7999, country: 'US' },
      { currency: 'EUR', centAmount: 8000, country: 'DE' },
    ]);
  });

  it('committed-term price is lower than month-to-month for every plan with several terms', () => {
    for (const [key, variants] of Object.entries(PLAN_PRICES)) {
      const m2m = variants.find((v) => v.term === 'M2M');
      if (!m2m) continue;
      for (const v of variants.filter((x) => x.term !== 'M2M')) expect(v.usd, `${key} ${v.sku}`).toBeLessThan(m2m.usd);
    }
    const cable = PLAN_PRICES['malva-offer-cable-500'];
    const by = (t: string) => cable.find((v) => v.term === t)?.usd;
    expect(by('24M')).toBeLessThan(by('12M') as number);
    expect(by('12M')).toBeLessThan(by('M2M') as number);
  });

  it('financed amounts for Nova 5G 128 GB: 4158, 2079, 1386 and lease 1996', () => {
    const outright = DEVICE_OUTRIGHT['malva-offer-phone-nova-5g']['128'];
    expect(outright).toBe(49900);
    expect([12, 24, 36].map((t) => installmentCents(outright, t))).toEqual([4158, 2079, 1386]);
    expect(leaseCents(outright)).toBe(1996);
    const financed = financedPrices(outright);
    expect(financed.filter((p) => p.currency === 'USD').map((p) => [p.recurrencePolicy, p.centAmount])).toEqual([
      ['malva-device-installment-12', 4158],
      ['malva-device-installment-24', 2079],
      ['malva-device-installment-36', 1386],
      ['malva-device-lease-24', 1996],
    ]);
  });

  it('price keys are unique and follow <sku>.<currency>.<policy or once>', () => {
    const keys = (MANIFEST.product as ProductDraft[]).flatMap((p) => [p.masterVariant, ...p.variants].flatMap((v) => v.prices.map((x) => x.key)));
    expect(new Set(keys).size).toBe(keys.length);
    expect(priceKey('MLV-CBL-500-24M', 'USD', 'malva-monthly')).toBe('mlv-cbl-500-24m.usd.malva-monthly');
    expect(priceKey('MLV-EQP-AX3000-BUY', 'EUR', undefined)).toBe('mlv-eqp-ax3000-buy.eur.once');
  });

  it('the table has the specified add-on, equipment and handset prices', () => {
    expect(Object.values(ADDON_PRICES).map((p) => p.usd)).toEqual([1000, 1000, 1100, 800, 800, 300, 1200, 500]);
    expect(EQUIPMENT_PRICES['malva-offer-router-ax3000']).toEqual({ rent: { sku: 'MLV-EQP-AX3000-RENT', usd: 800 }, buy: { sku: 'MLV-EQP-AX3000-BUY', usd: 12999 } });
    expect(EQUIPMENT_PRICES['malva-offer-5g-gateway'].buy).toBeUndefined();
    expect(CABLE_ACTIVATION_FEE_CENTS).toBe(2500);
  });
});
