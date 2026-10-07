import { INTRO_DEFS } from '../../lib/config/pricing';
import { EXIT } from './config';
import { apiLookup, buildIntroManifests, type LookupFn } from './data/cart-discounts/intro-defs';
import { applyDiscounts, main } from './discounts';
import { FakeCt } from './test/fake-ct';
import type { CartDiscountDraft } from './types';
import { planCartDiscount } from './reconcilers/cartDiscount';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom', CTP_SEED_AUTH_URL: 'a', CTP_SEED_API_URL: 'b', CTP_SEED_CLIENT_ID: 'c', CTP_SEED_CLIENT_SECRET: 'd' };
const SKUS: Record<string, string> = { 'malva-offer-wireless-5g': 'MLV-AIR-5G-12M', 'malva-offer-cable-100': 'MLV-CBL-100-24M' };
const STANDING: Record<string, { USD: number; EUR: number }> = {
  'malva-offer-wireless-5g': { USD: 5500, EUR: 5000 },
  'malva-offer-cable-100': { USD: 3999, EUR: 3699 },
};
const lookup: LookupFn = async (def) => ({ sku: SKUS[def.offerKey] as string, standing: STANDING[def.offerKey] as { USD: number; EUR: number } });

async function manifests(): Promise<CartDiscountDraft[]> {
  return buildIntroManifests(lookup);
}

describe('seed:discounts', () => {
  it('generated manifests: key, absolute value equals standing - intro for USD and EUR, no validity dates', async () => {
    const [air, cable] = await manifests();
    expect(air?.key).toBe('malva-cd-intro-wireless-5g-12');
    expect(cable?.key).toBe('malva-cd-intro-cable-100-24');
    expect(air?.value).toEqual({
      type: 'absolute',
      money: [
        { currencyCode: 'USD', centAmount: 2000 },
        { currencyCode: 'EUR', centAmount: 1800 },
      ],
    });
    expect((cable?.value as { money: { centAmount: number }[] }).money.map((m) => m.centAmount)).toEqual([1000, 900]);
    expect(air?.target).toEqual({ type: 'lineItems', predicate: 'sku = "MLV-AIR-5G-12M"' });
    expect(air?.validFrom).toBeUndefined();
    expect(air?.validUntil).toBeUndefined();
    expect(air?.recurringOrderScope).toEqual({ type: 'AnyOrder' });
    expect(air?.isActive).toBe(true);
    expect(air?.requiresDiscountCode).toBe(false);
    expect(new Set([air?.sortOrder, cable?.sortOrder]).size).toBe(2);
  });

  it('refuses an intro amount that is not below the standing price', async () => {
    await expect(buildIntroManifests(async () => ({ sku: 'X', standing: { USD: 3000, EUR: 3000 } }), [INTRO_DEFS[0] as (typeof INTRO_DEFS)[number]])).rejects.toThrow(/not below/);
  });

  it('refuses a project key other than spec-test-b2c-telecom', async () => {
    const api = new FakeCt();
    const log: string[] = [];
    const code = await main(['--confirm-project', 'other-project'], { api, source: { ...SOURCE, CTP_SEED_PROJECT_KEY: 'other-project' }, lookup, log: (l) => log.push(l) });
    expect(code).toBe(EXIT.TARGET_REFUSED);
    expect(api.writes).toBe(0);
  });

  it('refuses to write without the confirm flag', async () => {
    const api = new FakeCt();
    expect(await main([], { api, source: SOURCE, lookup, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(api.writes).toBe(0);
  });

  it('refuses a manifest key not starting malva-cd-', async () => {
    const api = new FakeCt();
    const [first] = await manifests();
    await expect(applyDiscounts(api, [{ ...(first as CartDiscountDraft), key: 'FurnitureBOGO' }])).rejects.toThrow(/malva-cd-/);
    expect(api.writes).toBe(0);
  });

  it('creates when 404, updates when present, and running twice sends no create', async () => {
    const api = new FakeCt();
    const log: string[] = [];
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom'], { api, source: SOURCE, lookup, log: (l) => log.push(l) })).toBe(EXIT.OK);
    expect(api.log.filter((l) => l.startsWith('create cart-discounts'))).toHaveLength(2);
    expect(api.keysOf('cart-discounts').sort()).toEqual(['malva-cd-intro-cable-100-24', 'malva-cd-intro-wireless-5g-12']);

    const writes = api.writes;
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom'], { api, source: SOURCE, lookup, log: (l) => log.push(l) })).toBe(EXIT.OK);
    expect(api.writes).toBe(writes);
    expect(api.log.filter((l) => l.startsWith('create cart-discounts'))).toHaveLength(2);

    // a changed standing price updates the existing discount
    const changed: LookupFn = async (def) => ({ sku: SKUS[def.offerKey] as string, standing: { USD: (STANDING[def.offerKey] as { USD: number }).USD + 100, EUR: (STANDING[def.offerKey] as { EUR: number }).EUR } });
    const outcomes = await applyDiscounts(api, await buildIntroManifests(changed));
    expect(outcomes.map((o) => o.result)).toEqual(['updated', 'updated']);
    expect(api.log.filter((l) => l.startsWith('update cart-discounts')).length).toBeGreaterThan(0);
  });

  it('Campaign withdrawn after purchase: deactivating changes only isActive', async () => {
    const [air] = (await manifests()) as [CartDiscountDraft];
    const existing = { id: 'x', version: 1, ...air };
    const plan = planCartDiscount(existing, { ...air, isActive: false });
    expect(plan.actions).toEqual([{ action: 'changeIsActive', isActive: false }]);
    expect(plan.changes.map((c) => c.path)).toEqual(['isActive']);
  });

  it('apiLookup reads the term variant and its recurring prices and fails loudly when missing', async () => {
    const projection = {
      masterVariant: { sku: 'A-M2M', attributes: [{ name: 'contract-term', value: { key: 'month-to-month' } }], prices: [] },
      variants: [
        {
          sku: 'A-12M',
          attributes: [{ name: 'contract-term', value: { key: '12-months' } }],
          prices: [
            { value: { currencyCode: 'USD', centAmount: 5500 }, country: 'US', recurrencePolicy: { id: 'p' } },
            { value: { currencyCode: 'EUR', centAmount: 5000 }, country: 'DE', recurrencePolicy: { id: 'p' } },
            { value: { currencyCode: 'USD', centAmount: 99 }, country: 'US' },
          ],
        },
      ],
    };
    const api = { get: async () => projection } as unknown as Parameters<typeof apiLookup>[0];
    const def = INTRO_DEFS[0] as (typeof INTRO_DEFS)[number];
    await expect(apiLookup(api)(def)).resolves.toEqual({ sku: 'A-12M', standing: { USD: 5500, EUR: 5000 } });
    const none = { get: async () => null } as unknown as Parameters<typeof apiLookup>[0];
    await expect(apiLookup(none)(def)).rejects.toThrow(/run the seed first/);
    const noTerm = { get: async () => ({ masterVariant: projection.masterVariant }) } as unknown as Parameters<typeof apiLookup>[0];
    await expect(apiLookup(noTerm)(def)).rejects.toThrow(/no variant/);
  });
});
