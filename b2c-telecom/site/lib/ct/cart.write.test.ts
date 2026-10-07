// @vitest-environment node
import { ApiError } from '@/lib/api-error';
import { appletv, cable500, phoneEssential, phoneUnlimited, routerAx3000 } from '@/lib/cart/__fixtures__/offers';
import { fakeCart, type FakeCartHandle } from '@/test/fixtures/fakeCart';
import type { Offer, OfferVariant } from '@/lib/types';

const world = vi.hoisted(() => ({ handle: undefined as unknown }));
const h = (): FakeCartHandle => world.handle as FakeCartHandle;

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('./client', () => ({
  getApiRoot: () => ({
    carts: () => ({
      withId: () => ({
        get: () => ({ execute: async () => ({ body: structuredClone(h().cart) }) }),
        post: ({ body }: { body: { version: number; actions: { action: string }[] } }) => ({ execute: async () => ({ body: structuredClone(h().apply(body.version, body.actions)) }) }),
      }),
    }),
  }),
}));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('./recurring', async (original) => ({
  ...(await original<typeof import('./recurring')>()),
  getMonthlyPolicy: async () => ({ id: 'pol-1', key: 'malva-monthly', version: 1 }),
}));

import { addOfferLine, changeLineQuantity, normalizeCart, removeLine } from './cart';

const PRICES = {
  'MLV-CBL-500-24M': { recurring: 5999, oneTime: 2500 },
  'MLV-CBL-500-M2M': { recurring: 6999, oneTime: 2500 },
  'MLV-PHN-UNL-24M': { recurring: 5000 },
  'MLV-PHN-UNL-M2M': { recurring: 5500 },
  'MLV-PHN-ESS-M2M': { recurring: 2500 },
  'MLV-ADD-APPLETV-MTH': { recurring: 999 },
  'MLV-EQP-AX3000-RENT': { recurring: 800 },
  'MLV-EQP-AX3000-BUY': { oneTime: 12999 },
};
const variantOf = (offer: Offer, sku: string): OfferVariant => offer.variants.find((v) => v.sku === sku) as OfferVariant;
type Action = { action: string; [key: string]: unknown };
const actionsOf = (index: number): Action[] => h().updates[index]?.actions ?? [];

beforeEach(() => {
  world.handle = fakeCart(PRICES);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('addOfferLine', () => {
  it('a 24-month plan is Fixed and a month-to-month plan Dynamic, both on policy malva-monthly', async () => {
    await addOfferLine('cart-1', { offer: cable500, variant: variantOf(cable500, 'MLV-CBL-500-24M'), quantity: 1 });
    expect(actionsOf(0)[0]).toMatchObject({
      action: 'addLineItem',
      sku: 'MLV-CBL-500-24M',
      recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-monthly' }, priceSelectionMode: 'Fixed' },
      custom: { type: { key: 'malva-line-item' }, fields: { offerKey: 'malva-offer-cable-500' } },
    });
    await addOfferLine('cart-1', { offer: phoneUnlimited, variant: variantOf(phoneUnlimited, 'MLV-PHN-UNL-M2M'), quantity: 1 });
    expect(actionsOf(1)[0]?.recurrenceInfo).toMatchObject({ priceSelectionMode: 'Dynamic' });
  });

  it('an add-on is Dynamic with a parent link; one-time equipment has no recurrence; rented equipment is Dynamic', async () => {
    await addOfferLine('cart-1', { offer: cable500, variant: variantOf(cable500, 'MLV-CBL-500-24M'), quantity: 1 });
    const plan = h().cart.lineItems[0]?.id as string;
    await addOfferLine('cart-1', { offer: appletv, variant: variantOf(appletv, 'MLV-ADD-APPLETV-MTH'), quantity: 1, parentLineId: plan });
    await addOfferLine('cart-1', { offer: routerAx3000, variant: variantOf(routerAx3000, 'MLV-EQP-AX3000-BUY'), quantity: 1, parentLineId: plan });
    await addOfferLine('cart-1', { offer: routerAx3000, variant: variantOf(routerAx3000, 'MLV-EQP-AX3000-RENT'), quantity: 1, parentLineId: plan });
    expect(actionsOf(1)[0]).toMatchObject({ recurrenceInfo: { priceSelectionMode: 'Dynamic' }, custom: { fields: { offerKey: 'malva-offer-appletv', parentLineItemId: plan } } });
    expect(actionsOf(2)[0]).not.toHaveProperty('recurrenceInfo');
    expect(actionsOf(3)[0]).toMatchObject({ recurrenceInfo: { priceSelectionMode: 'Dynamic' } });
  });

  it('adds the activation fee custom line item once, in the same update as the plan', async () => {
    await addOfferLine('cart-1', { offer: cable500, variant: variantOf(cable500, 'MLV-CBL-500-24M'), quantity: 1 });
    expect(actionsOf(0).map((a) => a.action)).toEqual(['addLineItem', 'addCustomLineItem']);
    expect(actionsOf(0)[1]).toMatchObject({
      slug: 'activation-fee:malva-offer-cable-500',
      quantity: 1,
      money: { centAmount: 2500, currencyCode: 'USD' },
      taxCategory: { typeId: 'tax-category', key: 'malva-telecom-services' },
    });
    expect(h().cart.customLineItems).toHaveLength(1);
  });

  it('required equipment is added after the plan in a second update, linked to the plan line', async () => {
    const result = await addOfferLine('cart-1', {
      offer: cable500,
      variant: variantOf(cable500, 'MLV-CBL-500-24M'),
      quantity: 1,
      equipment: [{ offer: routerAx3000, variant: variantOf(routerAx3000, 'MLV-EQP-AX3000-RENT') }],
    });
    expect(h().updates).toHaveLength(2);
    const planId = result.lineItems[0]?.id;
    expect(actionsOf(1)[0]).toMatchObject({ action: 'addLineItem', sku: 'MLV-EQP-AX3000-RENT', custom: { fields: { parentLineItemId: planId, offerKey: 'malva-offer-router-ax3000' } } });
    expect(result.lineItems).toHaveLength(2);
  });

  it('a phone plan added again raises the existing line instead of adding a second one', async () => {
    await addOfferLine('cart-1', { offer: phoneUnlimited, variant: variantOf(phoneUnlimited, 'MLV-PHN-UNL-M2M'), quantity: 1 });
    const result = await addOfferLine('cart-1', { offer: phoneUnlimited, variant: variantOf(phoneUnlimited, 'MLV-PHN-UNL-M2M'), quantity: 1 });
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.quantity).toBe(2);
  });

  it('an add-on follows the quantity of its phone plan', async () => {
    await addOfferLine('cart-1', { offer: phoneUnlimited, variant: variantOf(phoneUnlimited, 'MLV-PHN-UNL-M2M'), quantity: 3 });
    const plan = h().cart.lineItems[0]?.id as string;
    const result = await addOfferLine('cart-1', { offer: appletv, variant: variantOf(appletv, 'MLV-ADD-APPLETV-MTH'), quantity: 1, parentLineId: plan });
    expect(result.lineItems[1]?.quantity).toBe(3);
  });

  it('a recurring line without a recurring price is removed again and answered RECURRING_PRICE_MISSING', async () => {
    world.handle = fakeCart({ 'MLV-CBL-500-24M': { oneTime: 2500 } });
    const err = await addOfferLine('cart-1', { offer: cable500, variant: variantOf(cable500, 'MLV-CBL-500-24M'), quantity: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).details?.reason).toBe('RECURRING_PRICE_MISSING');
    expect(h().cart.lineItems).toHaveLength(0);
    expect(h().cart.customLineItems).toHaveLength(0);
  });
});

describe('changeLineQuantity', () => {
  it('moves the dependents and the fee with the plan in one update', async () => {
    await addOfferLine('cart-1', { offer: cable500, variant: variantOf(cable500, 'MLV-CBL-500-24M'), quantity: 1 });
    const plan = h().cart.lineItems[0]?.id as string;
    await addOfferLine('cart-1', { offer: appletv, variant: variantOf(appletv, 'MLV-ADD-APPLETV-MTH'), quantity: 1, parentLineId: plan });
    const before = h().updates.length;
    const cart = await changeLineQuantity('cart-1', plan, 2);
    expect(h().updates.length).toBe(before + 1);
    expect(cart.lineItems.map((l) => l.quantity)).toEqual([2, 2]);
    expect(cart.customLineItems[0]?.quantity).toBe(2);
  });

  it('unknown line is LINE_NOT_FOUND', async () => {
    const err = await changeLineQuantity('cart-1', 'nope', 2).catch((e: unknown) => e);
    expect((err as ApiError).details?.reason).toBe('LINE_NOT_FOUND');
  });
});

describe('removeLine', () => {
  async function bundle() {
    await addOfferLine('cart-1', { offer: cable500, variant: variantOf(cable500, 'MLV-CBL-500-24M'), quantity: 1 });
    const plan = h().cart.lineItems[0]?.id as string;
    await addOfferLine('cart-1', { offer: appletv, variant: variantOf(appletv, 'MLV-ADD-APPLETV-MTH'), quantity: 1, parentLineId: plan });
    return plan;
  }

  it('without cascade a line with dependents throws HAS_DEPENDENTS naming them', async () => {
    const plan = await bundle();
    const err = await removeLine('cart-1', plan, { cascade: false, locale: 'en-US' }).catch((e: unknown) => e);
    expect((err as ApiError).details).toMatchObject({ reason: 'HAS_DEPENDENTS', dependents: [{ name: 'MLV-ADD-APPLETV-MTH' }] });
    expect(h().cart.lineItems).toHaveLength(2);
  });

  it('cascade removes the line, its dependents and its fee in one update', async () => {
    const plan = await bundle();
    const before = h().updates.length;
    const cart = await removeLine('cart-1', plan, { cascade: true, locale: 'en-US' });
    expect(h().updates.length).toBe(before + 1);
    expect(cart.lineItems).toHaveLength(0);
    expect(cart.customLineItems).toHaveLength(0);
  });

  it('removing an add-on leaves the plan and its fee', async () => {
    await bundle();
    const addon = h().cart.lineItems[1]?.id as string;
    const cart = await removeLine('cart-1', addon, { cascade: false, locale: 'en-US' });
    expect(cart.lineItems).toHaveLength(1);
    expect(cart.customLineItems).toHaveLength(1);
  });
});

describe('normalizeCart', () => {
  const offers = { [cable500.key]: cable500, [phoneEssential.key]: phoneEssential, [appletv.key]: appletv };

  it('caps a phone plan at 5 lines and its fee follows', async () => {
    world.handle = fakeCart(PRICES);
    await addOfferLine('cart-1', { offer: phoneEssential, variant: variantOf(phoneEssential, 'MLV-PHN-ESS-M2M'), quantity: 7 });
    const fixed = await normalizeCart(structuredClone(h().cart), offers);
    expect(fixed.lineItems[0]?.quantity).toBe(5);
  });

  it('re-links a dangling parent when exactly one plan can be the parent', async () => {
    await addOfferLine('cart-1', { offer: cable500, variant: variantOf(cable500, 'MLV-CBL-500-24M'), quantity: 1 });
    const plan = h().cart.lineItems[0]?.id as string;
    await addOfferLine('cart-1', { offer: appletv, variant: variantOf(appletv, 'MLV-ADD-APPLETV-MTH'), quantity: 1, parentLineId: plan });
    (h().cart.lineItems[1] as unknown as { custom: { fields: Record<string, string> } }).custom.fields.parentLineItemId = 'gone';
    const fixed = await normalizeCart(structuredClone(h().cart), offers);
    expect((fixed.lineItems[1]?.custom?.fields as Record<string, string>).parentLineItemId).toBe(plan);
  });

  it('writes nothing for a clean cart and returns the same object', async () => {
    await addOfferLine('cart-1', { offer: cable500, variant: variantOf(cable500, 'MLV-CBL-500-24M'), quantity: 1 });
    const before = h().updates.length;
    const cart = structuredClone(h().cart);
    expect(await normalizeCart(cart, offers)).toBe(cart);
    expect(h().updates.length).toBe(before);
  });
});
