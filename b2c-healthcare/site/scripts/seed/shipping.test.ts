import { describe, expect, it } from 'vitest';
import { SAME_DAY_ZONE, SHIPPING_METHODS } from './data/shipping';
import { TAX_CATEGORIES } from './data/tax';
import { createFakeRoot } from './fake-root';
import { makeCtx, runSteps } from './lib';
import { shippingSteps } from './steps';

describe('shipping data', () => {
  it('two methods with the right cents, standard is the default, rates in USD', () => {
    const [standard, sameDay] = SHIPPING_METHODS;
    expect(standard.key).toBe('mlv-standard');
    expect(sameDay.key).toBe('mlv-same-day');
    const cents = (m: (typeof SHIPPING_METHODS)[number]) => m.zoneRates[0].shippingRates[0].price;
    expect(cents(standard)).toEqual({ currencyCode: 'USD', centAmount: 0 });
    expect(cents(sameDay)).toEqual({ currencyCode: 'USD', centAmount: 500 });
    expect(SHIPPING_METHODS.filter((m) => m.isDefault).map((m) => m.key)).toEqual(['mlv-standard']);
    expect(SHIPPING_METHODS.every((m) => m.active)).toBe(true);
  });

  it('descriptions, zones and tax category', () => {
    const [standard, sameDay] = SHIPPING_METHODS;
    expect(standard.localizedDescription['en-US']).toBe('1–2 business days');
    expect(sameDay.localizedDescription['en-US']).toBe('By 8 pm');
    expect(standard.zoneRates[0].zone.key).toBe('usa');
    expect(sameDay.zoneRates[0].zone.key).toBe('mlv-same-day-states');
    const taxKeys = TAX_CATEGORIES.map((t) => t.key);
    for (const m of SHIPPING_METHODS) expect(taxKeys).toContain(m.taxCategory.key);
    expect(m0(SHIPPING_METHODS).taxCategory.key).toBe('mlv-rx-medicine');
  });

  it('the same-day zone holds NY, TX and IL', () => {
    expect(SAME_DAY_ZONE.locations).toEqual([{ country: 'US', state: 'NY' }, { country: 'US', state: 'TX' }, { country: 'US', state: 'IL' }]);
  });

  it('seeding is idempotent and a wrong price in the project is reported, not overwritten', async () => {
    const fake = createFakeRoot();
    const ctx = { ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 };
    expect((await runSteps(shippingSteps(ctx), () => {})).changed).toBe(3);
    expect(await runSteps(shippingSteps(ctx), () => {})).toMatchObject({ ok: true, changed: 0 });
    const wrong = createFakeRoot({
      shippingMethods: [{ key: 'mlv-same-day', isDefault: false, zoneRates: [{ zone: { id: 'z' }, shippingRates: [{ price: { centAmount: 50000, currencyCode: 'USD' } }] }] }],
    });
    const r = await runSteps(shippingSteps({ ...makeCtx(wrong.root, { dryRun: false }, () => {}), pauseMs: 0 }), () => {});
    expect(r.ok).toBe(false);
  });
});

const m0 = (ms: typeof SHIPPING_METHODS) => ms[0];
