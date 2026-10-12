// @vitest-environment node
import { cartOffersByKey } from '@/lib/cart/__fixtures__/offers';
import { ctCart } from '@/test/fixtures/ctCart';
import type { BundleIssue } from '@/lib/types';
import { mapCart, type CartMapDeps } from './cart';
import { installLegacyPricingDefs } from '@/test/fixtures/legacyPricing';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' } as const;
const deps = (patch: Partial<CartMapDeps> = {}): CartMapDeps => ({
  offersByKey: cartOffersByKey(),
  stock: {},
  issues: [],
  today: '2026-10-07',
  discountKeyById: { 'cd-intro': 'malva-cd-intro-cable-100-24', 'cd-second': 'malva-cd-second-line-10' },
  ...patch,
});

const planLine = { id: 'L1', sku: 'MLV-CBL-500-24M', offerKey: 'malva-offer-cable-500', price: 5999, mode: 'Fixed' as const };
const feeLine = { id: 'F1', offerKey: 'malva-offer-cable-500', money: 2500 };
const routerLine = { id: 'L2', sku: 'MLV-EQP-AX3000-RENT', offerKey: 'malva-offer-router-ax3000', price: 800, mode: 'Dynamic' as const, parent: 'L1' };
const addonLine = { id: 'L3', sku: 'MLV-ADD-APPLETV-MTH', offerKey: 'malva-offer-appletv', price: 999, mode: 'Dynamic' as const, parent: 'L1' };

installLegacyPricingDefs();

describe('mapCart', () => {
  it('splits monthly and one-time, marks the fee line and excludes it from the item count', () => {
    const cart = mapCart(ctCart({ lines: [planLine, routerLine, addonLine], fees: [feeLine] }), ctx, deps());
    expect(cart.summary.plans.centAmount).toBe(5999);
    expect(cart.summary.addons.centAmount).toBe(800 + 999);
    expect(cart.summary.monthly.centAmount).toBe(5999 + 800 + 999);
    expect(cart.summary.oneTime.centAmount).toBe(2500);
    expect(cart.summary.total.centAmount).toBe(5999 + 800 + 999 + 2500);
    const fee = cart.lines.find((line) => line.kind === 'fee');
    expect(fee).toMatchObject({ source: 'custom-line-item', chargeType: 'one-time', offerKey: 'malva-offer-cable-500', parentLineId: 'L1', sku: null });
    expect(cart.itemCount).toBe(3);
  });

  it('maps recurrence, parent link, required equipment and appliedDiscountKeys', () => {
    const cart = mapCart(
      ctCart({ lines: [{ ...planLine, discounts: ['cd-second'] }, routerLine], fees: [feeLine] }),
      ctx,
      deps({ offersByKey: { ...cartOffersByKey(), 'malva-offer-cable-500': { ...cartOffersByKey()['malva-offer-cable-500'], includedOffers: [] } } }),
    );
    const plan = cart.lines.find((line) => line.id === 'L1');
    expect(plan).toMatchObject({ kind: 'plan', termMonths: 24, chargeType: 'recurring', recurrence: { policyKey: 'malva-monthly', priceSelectionMode: 'Fixed' }, appliedDiscountKeys: ['malva-cd-second-line-10'] });
    expect(cart.lines.find((line) => line.id === 'L2')).toMatchObject({ kind: 'equipment', parentLineId: 'L1', recurrence: { priceSelectionMode: 'Dynamic' } });
  });

  it('a one-time line has no recurrence', () => {
    const cart = mapCart(ctCart({ lines: [planLine, { id: 'L9', sku: 'MLV-EQP-AX3000-BUY', offerKey: 'malva-offer-router-ax3000', price: 12999, parent: 'L1' }] }), ctx, deps());
    expect(cart.lines.find((line) => line.id === 'L9')).toMatchObject({ chargeType: 'one-time', recurrence: null });
    expect(cart.summary.oneTime.centAmount).toBe(12999);
  });

  it('the total is the engine total, not a sum of the lines', () => {
    const cart = mapCart(ctCart({ lines: [planLine], totalPrice: 1234 }), ctx, deps());
    expect(cart.summary.total.centAmount).toBe(1234);
  });

  it('attaches schedule and label to plans only; the add-on has neither', () => {
    const cart = mapCart(ctCart({ lines: [planLine, addonLine], fees: [feeLine] }), ctx, deps());
    const plan = cart.lines.find((line) => line.id === 'L1');
    expect(plan?.schedule?.dueAtOrder.centAmount).toBe(5999 + 2500);
    expect(plan?.label?.id).toBe('MLV-CBL-500-24M');
    expect(plan?.label?.oneTime[0]).toEqual({ k: 'Activation fee', v: '$25.00' });
    const addon = cart.lines.find((line) => line.id === 'L3');
    expect(addon?.schedule).toBeNull();
    expect(addon?.label).toBeNull();
  });

  it('intro applied only when the discount key is on the line', () => {
    const intro = { id: 'L1', sku: 'MLV-CBL-100-24M', offerKey: 'malva-offer-cable-100', price: 3999, mode: 'Fixed' as const };
    const withIntro = mapCart(ctCart({ lines: [{ ...intro, discounts: ['cd-intro'] }] }), ctx, deps());
    expect(withIntro.lines[0]?.schedule?.periods[0]).toMatchObject({ kind: 'intro', months: 6 });
    const without = mapCart(ctCart({ lines: [intro] }), ctx, deps());
    expect(without.lines[0]?.schedule?.periods.some((period) => period.kind === 'intro')).toBe(false);
  });

  it('a plan without label data becomes a blocking issue', () => {
    const offers = cartOffersByKey();
    const broken = { ...offers['malva-offer-cable-500'], facts: { ...(offers['malva-offer-cable-500'].facts as object), typicalLatencyMs: undefined } } as never;
    const cart = mapCart(ctCart({ lines: [planLine], fees: [feeLine] }), ctx, deps({ offersByKey: { ...offers, 'malva-offer-cable-500': broken } }));
    expect(cart.lines[0]?.label).toBeNull();
    expect(cart.issues[0]).toMatchObject({ code: 'LABEL_DATA_MISSING', lineId: 'L1' });
    expect(cart.canCheckout).toBe(false);
    expect(cart.checkoutBlockedBy).toContain('ISSUES');
  });

  it('a committed plan without a month-to-month price cannot be scheduled and becomes a blocking issue', () => {
    const cart = mapCart(ctCart({ lines: [{ id: 'L1', sku: 'MLV-CBL-GIG-24M', offerKey: 'malva-offer-cable-gig', price: 7999, mode: 'Fixed' }] }), ctx, deps());
    expect(cart.lines[0]?.schedule).toBeNull();
    expect(cart.issues[0]).toMatchObject({ code: 'SCHEDULE_NOT_PRICEABLE', lineId: 'L1' });
  });

  it('every DiscountCodeState maps to the right state and reason', () => {
    const states: [string, string, string | null][] = [
      ['MatchesCart', 'applied', null],
      ['DoesNotMatchCart', 'not-applicable', 'not-applicable'],
      ['NotActive', 'not-active', 'not-active'],
      ['NotValid', 'not-valid', 'not-valid'],
      ['MaxApplicationReached', 'max-reached', 'max-reached'],
      ['ApplicationStoppedByPreviousDiscount', 'stopped', 'stopped'],
      ['ApplicationStoppedByGroupBestDeal', 'stopped', 'stopped'],
    ];
    for (const [ct, state, reason] of states) {
      const cart = mapCart(ctCart({ lines: [planLine], codes: [{ id: 'c1', code: 'MALVA-CABLE5', state: ct }] }), ctx, deps());
      expect(cart.discountCodes).toEqual([{ code: 'MALVA-CABLE5', state, reason }]);
    }
  });

  it('Discount stops applying: DoesNotMatchCart is reported as not applicable with a reason and totals exclude it', () => {
    const before = mapCart(ctCart({ lines: [{ ...planLine, total: 5499, discounts: ['cd-intro'], discountCents: 500 }], fees: [feeLine], codes: [{ id: 'c1', code: 'MALVA-CABLE5', state: 'MatchesCart' }] }), ctx, deps());
    expect(before.discountCodes[0]?.state).toBe('applied');
    expect(before.summary.discountTotal.centAmount).toBe(500);
    const after = mapCart(ctCart({ lines: [addonLine], codes: [{ id: 'c1', code: 'MALVA-CABLE5', state: 'DoesNotMatchCart' }] }), ctx, deps());
    expect(after.discountCodes[0]).toEqual({ code: 'MALVA-CABLE5', state: 'not-applicable', reason: 'not-applicable' });
    expect(after.summary.discountTotal.centAmount).toBe(0);
  });

  it('first-month promotion: the schedule starts with its own first period at the price the engine charges now, so Due at order equals the cart', () => {
    const cart = mapCart(ctCart({ lines: [{ ...planLine, total: 0, discounts: ['cd-intro'], discountCents: 5999 }], fees: [feeLine] }), ctx, deps());
    const plan = cart.lines.find((line) => line.kind === 'plan');
    expect(plan?.promoPerUnit?.centAmount).toBe(5999);
    expect(plan?.schedule?.periods.map((p) => [p.kind, p.monthlyAmount.centAmount])).toEqual([
      ['intro', 0],
      ['standing', 5999],
    ]);
    expect(plan?.schedule?.dueAtOrder.centAmount).toBe(cart.summary.dueToday.centAmount);
    // Then monthly is the standing price: the promotion never reaches recurring orders
    expect(cart.summary.thenMonthly.centAmount).toBe(5999);
  });

  describe('promotions', () => {
    const names = { 'cd-intro': { 'en-US': 'First month free', 'de-DE': 'Erster Monat gratis' }, 'cd-welcome': { 'en-US': 'Welcome offer', 'de-DE': 'Willkommensangebot' } };
    const promoDeps = () => deps({ discountKeyById: { 'cd-intro': 'malva-cd-intro-free-month', 'cd-welcome': 'malva-cd-welcome-10' }, discountNameById: names });

    it('one-line promotion sits under its line with its name and the engine amount; an order-level one is listed after the lines', () => {
      const cart = mapCart(ctCart({ lines: [{ ...planLine, total: 0, discounts: ['cd-intro'], discountCents: 5999 }, addonLine], fees: [feeLine], discountOnTotal: 1000, discountOnTotalId: 'cd-welcome' }), ctx, promoDeps());
      const plan = cart.lines.find((line) => line.kind === 'plan');
      expect(plan?.promotions).toEqual([{ key: 'malva-cd-intro-free-month', name: 'First month free', amount: { centAmount: 5999, currencyCode: 'USD' }, lineIds: ['L1'] }]);
      expect(cart.promotions).toEqual([{ key: 'malva-cd-welcome-10', name: 'Welcome offer', amount: { centAmount: 1000, currencyCode: 'USD' }, lineIds: [] }]);
      expect(cart.lines.find((line) => line.kind === 'addon')?.promotions).toBeUndefined();
    });

    it('a promotion that reduced several lines is listed after the lines with the total off', () => {
      const cart = mapCart(ctCart({ lines: [{ ...planLine, total: 5499, discounts: ['cd-intro'], discountCents: 500 }, { ...addonLine, total: 499, discounts: ['cd-intro'], discountCents: 500 }] }), ctx, promoDeps());
      expect(cart.promotions).toMatchObject([{ key: 'malva-cd-intro-free-month', amount: { centAmount: 1000 }, lineIds: ['L1', 'L3'] }]);
      expect(cart.lines.every((line) => line.promotions === undefined)).toBe(true);
    });

    it('localised name with fallback to en-US and then to the key; nothing applied gives an empty list', () => {
      const german = mapCart(ctCart({ lines: [{ ...planLine, total: 0, discounts: ['cd-intro'], discountCents: 5999 }] }), { ...ctx, locale: 'de-DE' }, promoDeps());
      expect(german.lines[0]?.promotions?.[0]?.name).toBe('Erster Monat gratis');
      const noNames = mapCart(ctCart({ lines: [{ ...planLine, total: 0, discounts: ['cd-intro'], discountCents: 5999 }] }), ctx, deps({ discountKeyById: { 'cd-intro': 'malva-cd-intro-free-month' } }));
      expect(noNames.lines[0]?.promotions?.[0]?.name).toBe('malva-cd-intro-free-month');
      expect(mapCart(ctCart({ lines: [planLine] }), ctx, promoDeps()).promotions).toEqual([]);
    });

    it('removing the line it depended on removes the promotion', () => {
      expect(mapCart(ctCart({ lines: [addonLine] }), ctx, promoDeps()).promotions).toEqual([]);
    });
  });

  it('discountTotal sums line discounts and the discount on the total', () => {
    const cart = mapCart(ctCart({ lines: [{ ...planLine, total: 5499, discounts: ['cd-intro'], discountCents: 500 }], discountOnTotal: 100 }), ctx, deps());
    expect(cart.summary.discountTotal.centAmount).toBe(600);
    expect(cart.summary.orderDiscount.centAmount).toBe(100);
  });

  it('tax is null until the engine has a taxed price', () => {
    expect(mapCart(ctCart({ lines: [planLine] }), ctx, deps()).summary.tax).toBeNull();
    expect(mapCart(ctCart({ lines: [planLine], taxed: { net: 1000, gross: 1190 } }), ctx, deps()).summary.tax?.centAmount).toBe(190);
  });

  it('canCheckout: false for empty, false below the minimum, false with issues, true otherwise', () => {
    const empty = mapCart(ctCart(), ctx, deps());
    expect(empty).toMatchObject({ canCheckout: false, checkoutBlockedBy: ['EMPTY'], itemCount: 0 });
    expect(empty.minimumOrder?.shortfall).toBeNull();
    const small = mapCart(ctCart({ lines: [{ id: 'L1', sku: 'MLV-PHN-ESS-M2M', offerKey: 'malva-offer-phone-essential', price: 2500, mode: 'Dynamic' }] }), ctx, deps());
    expect(small.checkoutBlockedBy).toEqual(['MINIMUM_ORDER']);
    expect(small.minimumOrder?.shortfall).toEqual({ centAmount: 500, currencyCode: 'USD' });
    const issue: BundleIssue = { code: 'X', severity: 'blocking', lineId: 'L1', offerKey: null, resolution: 'remove', reasons: [] };
    expect(mapCart(ctCart({ lines: [planLine], fees: [feeLine] }), ctx, deps({ issues: [issue] })).checkoutBlockedBy).toEqual(['ISSUES']);
    const ok = mapCart(ctCart({ lines: [planLine], fees: [feeLine] }), ctx, deps());
    expect(ok).toMatchObject({ canCheckout: true, checkoutBlockedBy: [] });
  });

  it('stock: equipment below the requested quantity is out of stock and blocks', () => {
    const cart = mapCart(ctCart({ lines: [planLine, routerLine] }), ctx, deps({ stock: { 'MLV-EQP-AX3000-RENT': 0 } }));
    expect(cart.lines.find((line) => line.id === 'L2')?.stock).toEqual({ available: 0, inStock: false });
    expect(cart.issues[0]).toMatchObject({ code: 'OUT_OF_STOCK', lineId: 'L2' });
  });

  it('reads the postal code custom field and the included-at-no-charge flag', () => {
    const cart = mapCart(
      ctCart({ postalCode: '10001', lines: [planLine, { ...addonLine, price: 999, total: 0 }] }),
      ctx,
      deps({ offersByKey: { ...cartOffersByKey(), 'malva-offer-cable-500': { ...cartOffersByKey()['malva-offer-cable-500'], includedOffers: ['malva-offer-appletv'] } } }),
    );
    expect(cart.postalCode).toBe('10001');
    expect(cart.lines.find((line) => line.id === 'L3')?.includedAtNoCharge).toBe(true);
  });
});
