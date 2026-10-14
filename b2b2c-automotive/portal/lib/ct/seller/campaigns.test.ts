/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWFake, type WFake } from '@/lib/portal/w-fixture-root';
import { inBand } from '@/lib/catalog/sort-order';
import { clearCatalogCaches } from './catalog-data';

let fake: WFake;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));
vi.mock('./w-root', () => ({ wRoot: async () => fake.root }));

import { createCoopDiscount, listCampaigns, submitClaim } from './campaigns';
import { getDiscount, listDiscounts, setDiscountActive } from './discounts';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const NOW = Date.parse('2026-10-12T12:00:00Z');
const BRAKE = 'tst-w-brake-week';

beforeEach(() => {
  fake = createWFake({ demo: true });
  clearCatalogCaches();
});

const cartDiscounts = () => [...fake.state.cartDiscounts.values()];

describe('coop discount draft', () => {
  it('creates an inactive discount keyed coop-<campaign>-<store>, a suffixed code and a Malva-funded band sortOrder', async () => {
    const result = await createCoopDiscount(NORTH, BRAKE, NOW);
    expect(result).toMatchObject({ key: `coop-${BRAKE}-${NORTH}`, code: 'BRAKE8-MAU-RESELLER-NORTH', isActive: false });
    const discount = cartDiscounts().find((d) => d.key === result.key);
    expect(discount).toMatchObject({
      isActive: false,
      requiresDiscountCode: true,
      cartPredicate: 'true',
      value: { type: 'relative', permyriad: 800 },
      target: { type: 'lineItems', predicate: 'sku in ("MLV-BP-41001", "MLV-BD-42001", "MLV-BP-41003")' },
      stores: [{ typeId: 'store', key: NORTH }],
      custom: { type: { typeId: 'type', key: 'mau-cart-discount-fields' }, fields: { fundedBy: 'malva', storeKey: NORTH } },
    });
    expect(inBand(discount?.sortOrder, 'malva-funded')).toBe(true);
    const code = [...fake.state.codes.values()].find((c) => c.code === 'BRAKE8-MAU-RESELLER-NORTH');
    expect(code).toMatchObject({ isActive: true, cartDiscounts: [{ typeId: 'cart-discount', id: discount?.id }] });
    expect([...fake.state.codes.values()].some((c) => c.code === 'BRAKE8')).toBe(false);
  });

  it('a second call for the same store is a 409; another store can still create its own', async () => {
    await createCoopDiscount(NORTH, BRAKE, NOW);
    await expect(createCoopDiscount(NORTH, BRAKE, NOW)).rejects.toMatchObject({ status: 409, code: 'DISCOUNT_EXISTS' });
    await expect(createCoopDiscount(SOUTH, BRAKE, NOW)).resolves.toMatchObject({ code: 'BRAKE8-MAU-RESELLER-SOUTH' });
    expect(cartDiscounts().filter((d) => String(d.key).startsWith('coop-'))).toHaveLength(2);
  });

  it('an ended campaign is CAMPAIGN_ENDED and nothing is written', async () => {
    fake.resetCalls();
    await expect(createCoopDiscount(NORTH, 'tst-w-summer-filters', NOW)).rejects.toMatchObject({ status: 409, code: 'CAMPAIGN_ENDED' });
    expect(fake.writes()).toHaveLength(0);
  });

  it('an unknown campaign is a 404', async () => {
    await expect(createCoopDiscount(NORTH, 'nope', NOW)).rejects.toMatchObject({ status: 404 });
  });

  it('a code that is taken removes the discount again (all or nothing)', async () => {
    await createCoopDiscount(NORTH, BRAKE, NOW);
    for (const [id, d] of fake.state.cartDiscounts) if (String(d.key).startsWith('coop-')) fake.state.cartDiscounts.delete(id);
    await expect(createCoopDiscount(NORTH, BRAKE, NOW)).rejects.toMatchObject({ status: 409, code: 'CODE_TAKEN' });
    expect(cartDiscounts().some((d) => String(d.key).startsWith('coop-'))).toBe(false);
  });
});

describe('coop discounts in the catalog discount layer', () => {
  it('the store sees its own co-op discount locked as Malva funded, and another store does not see it', async () => {
    const north = await createCoopDiscount(NORTH, BRAKE, NOW);
    const own = (await listDiscounts(NORTH, 'cart')).find((d) => d.key === north.key);
    expect(own).toMatchObject({ funded: 'malva', isActive: false, code: 'BRAKE8-MAU-RESELLER-NORTH' });
    expect((await listDiscounts(SOUTH, 'cart')).some((d) => d.key === north.key)).toBe(false);
    await expect(getDiscount(SOUTH, 'cart', north.id)).rejects.toMatchObject({ status: 404 });
  });

  it('the reseller may switch the co-op discount on and off but not edit or delete it; a global Malva discount stays locked', async () => {
    const north = await createCoopDiscount(NORTH, BRAKE, NOW);
    expect((await setDiscountActive(NORTH, 'cart', north.id, true)).isActive).toBe(true);
    expect((await setDiscountActive(NORTH, 'cart', north.id, false)).isActive).toBe(false);
    await expect(setDiscountActive(SOUTH, 'cart', north.id, true)).rejects.toMatchObject({ status: 404 });
    const welcome = cartDiscounts().find((d) => d.key === 'mau-cd-malva-welcome');
    await expect(setDiscountActive(NORTH, 'cart', welcome?.id, false)).rejects.toMatchObject({ status: 403, code: 'LOCKED_MALVA_FUNDED' });
  });
});

describe('campaign list and claims', () => {
  it('lists campaigns with Ended chip data, eligible products (first 5) and the store discount state', async () => {
    await createCoopDiscount(NORTH, BRAKE, NOW);
    const north = await listCampaigns(NORTH, NOW);
    expect(north.map((c) => [c.key, c.ended])).toEqual([[BRAKE, false], ['tst-w-summer-filters', true]]);
    expect(north[0].discount).toMatchObject({ key: `coop-${BRAKE}-${NORTH}`, isActive: false });
    expect(north[0].eligible.map((e) => e.sku)).toEqual(['MLV-BP-41001', 'MLV-BD-42001', 'MLV-BP-41003']);
    expect(north[0].eligibleMore).toBe(0);
    expect((await listCampaigns(SOUTH, NOW))[0].discount).toBeNull();
  });

  it('a campaign object has no edit function: the module only exports reads, the discount and the claim', async () => {
    const names = Object.keys(await import('./campaigns')).sort();
    expect(names).toEqual(['createCoopDiscount', 'discountKeyOf', 'listCampaigns', 'storeCode', 'submitClaim']);
  });

  it('a claim is stored per store as submitted; a second one waits; the other store is not affected', async () => {
    await submitClaim(NORTH, BRAKE, { amountCents: 12000, invoiceReference: 'INV-1', note: 'Flyers' }, NOW);
    expect((await listCampaigns(NORTH, NOW))[0].claim).toEqual({ status: 'submitted', amountCents: 12000, invoiceReference: 'INV-1' });
    expect((await listCampaigns(SOUTH, NOW))[0].claim).toEqual({ status: 'none' });
    await expect(submitClaim(NORTH, BRAKE, { amountCents: 1, invoiceReference: 'x', note: '' }, NOW)).rejects.toMatchObject({ status: 409, code: 'CLAIM_PENDING' });
    expect(fake.state.objects.get(`malva-coop-claims/${BRAKE}--${NORTH}`)?.value).toMatchObject({ status: 'submitted', storeKey: NORTH });
  });
});
