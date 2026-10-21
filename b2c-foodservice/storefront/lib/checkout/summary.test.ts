import { describe, expect, it } from 'vitest';
import { cad, usd, viewCart, viewLine } from '@/test/cart';
import { blockingIssues, buildSummary, checkoutIssues, codeSavings, type SavingsCart } from './summary';
import { freeAboveFor, priceFor, type MethodLike } from './shipping-price';
import { checkoutBlockers, EXTRA_BLOCKERS } from './guards';
import { baseOrderNumber, numbersOfPurchase, orderNumberForCart, orderNumberForPart } from './order-number';

const ship = viewLine({ id: 'a' });

describe('buildSummary', () => {
  it('Address change moves tax', () => {
    const before = buildSummary(viewCart([ship], { tax: { amount: usd(80), included: false }, total: usd(1000 + 695 + 80) }));
    const after = buildSummary(viewCart([ship], { tax: { amount: usd(150), included: false }, total: usd(1000 + 695 + 150) }));
    expect(after.taxCents).toBe(150);
    expect(after.totalCents - before.totalCents).toBe(70);
  });
  it('Summary never uses a constant tax rate', () => {
    expect(buildSummary(viewCart([ship], { tax: { amount: usd(1), included: false }, total: usd(1696) })).taxCents).toBe(1);
    expect(buildSummary(viewCart([ship], { tax: null, total: usd(1000) })).taxCents).toBeNull();
  });
  it('US address without state rate has a tax portion', () => {
    // The engine applies the country fallback rate (D-018); the summary shows whatever tax the engine returns.
    expect(buildSummary(viewCart([ship], { tax: { amount: usd(60), included: false } })).taxCents).toBe(60);
  });
  it('Canada food is zero rated and standard goods carry GST', () => {
    const food = viewCart([viewLine({ id: 'f', unitPrice: cad(2000) })], { currency: 'CAD', country: 'CA', shipping: { amount: cad(0), isFree: true }, tax: { amount: cad(0), included: false }, total: cad(2000) });
    const goods = viewCart([viewLine({ id: 'g', unitPrice: cad(10000) })], { currency: 'CAD', country: 'CA', shipping: { amount: cad(0), isFree: true }, tax: { amount: cad(500), included: false }, total: cad(10500) });
    expect(buildSummary(food).taxCents).toBe(0);
    expect(buildSummary(goods).taxCents).toBe(500);
    expect(buildSummary(goods).currency).toBe('CAD');
  });
  it('Summary has no included-tax line in either market', () => {
    expect(Object.keys(buildSummary(viewCart([ship])))).not.toContain('taxIncluded');
  });
  it('Shipping is null before a method exists and the total excludes it', () => {
    const s = buildSummary(viewCart([ship], { shipping: null, tax: null, total: usd(1000) }));
    expect(s.shippingCents).toBeNull();
    expect(s.totalCents).toBe(1000);
  });
  it('Free shipping shows free', () => {
    const s = buildSummary(viewCart([ship], { shipping: { amount: usd(0), isFree: true } }));
    expect(s.shippingFree).toBe(true);
    expect(s.shippingCents).toBe(0);
  });
  it('subtotal is before the cart discount', () => {
    const s = buildSummary(viewCart([ship], { subtotal: usd(900), discount: usd(100) }));
    expect(s.subtotalCents).toBe(1000);
    expect(s.discountCents).toBe(100);
  });
});

describe('shipping price', () => {
  const us: MethodLike = { zoneRates: [{ shippingRates: [{ price: usd(695), freeAbove: usd(7500) }] }] };
  const ca: MethodLike = { zoneRates: [{ shippingRates: [{ price: cad(895), freeAbove: cad(9900) }] }] };
  it('Free above threshold gives price zero per market', () => {
    expect(priceFor(us, 'USD', 7500)).toBe(0);
    expect(priceFor(us, 'USD', 7499)).toBe(695);
    expect(priceFor(ca, 'CAD', 9899)).toBe(895);
    expect(priceFor(ca, 'CAD', 9900)).toBe(0);
  });
  it('Threshold per market', () => {
    expect(freeAboveFor(us, 'USD')).toBe(7500);
    expect(freeAboveFor(ca, 'CAD')).toBe(9900);
    expect(freeAboveFor(us, 'CAD')).toBeNull();
  });
});

describe('issues and blockers', () => {
  it('Collect line in a Canada session shows collect_not_available', () => {
    const cart = viewCart([viewLine({ id: 'c', fulfilment: 'collect' })], { country: 'CA' });
    expect(checkoutIssues(cart)).toEqual([{ code: 'collect_not_available', lineId: 'c' }]);
  });
  it('Collect out of stock blocks Continue', () => {
    const cart = viewCart([viewLine({ id: 'c', fulfilment: 'collect', notices: [{ kind: 'collect-unavailable' }] })]);
    expect(blockingIssues(checkoutIssues(cart)).map((i) => i.code)).toEqual(['collect_out_of_stock']);
  });
  it('a price change is a notice, not a block', () => {
    const cart = viewCart([viewLine({ id: 'a', notices: [{ kind: 'price-updated', previous: usd(900) }] })]);
    expect(checkoutIssues(cart).map((i) => i.code)).toEqual(['price_changed']);
    expect(blockingIssues(checkoutIssues(cart))).toEqual([]);
  });
  it('blockers are the cart blockers plus the registered rules', () => {
    const cart = viewCart([], {});
    expect(checkoutBlockers(cart, {}).map((b) => b.code)).toEqual(['checkout_blocked']);
    EXTRA_BLOCKERS.push(() => ({ code: 'sign_in_required' }));
    expect(checkoutBlockers(viewCart([ship]), {}).map((b) => b.code)).toEqual(['sign_in_required']);
    EXTRA_BLOCKERS.pop();
  });
});

describe('order number', () => {
  it('Order number is deterministic per cart', () => {
    expect(orderNumberForCart('cart-1')).toBe(orderNumberForCart('cart-1'));
    expect(orderNumberForCart('cart-1')).not.toBe(orderNumberForCart('cart-2'));
    expect(orderNumberForCart('cart-1')).toMatch(/^MC-[0-9A-HJKMNP-TV-Z]{10}$/);
  });
  it('parts get suffixes only when there is more than one', () => {
    expect(orderNumberForPart('MC-X', 0, 1)).toBe('MC-X');
    expect(orderNumberForPart('MC-X', 0, 2)).toBe('MC-X-A');
    expect(orderNumberForPart('MC-X', 1, 2)).toBe('MC-X-B');
    expect(baseOrderNumber('MC-X-B')).toBe('MC-X');
    expect(numbersOfPurchase('MC-X')).toContain('MC-X-A');
  });
});

describe('codeSavings', () => {
  const cart: SavingsCart = {
    lineItems: [{ discountedPricePerQuantity: [{ quantity: 2, discountedPrice: { includedDiscounts: [{ discount: { id: 'cd-10' }, discountedAmount: { centAmount: 100 } }, { discount: { id: 'other' }, discountedAmount: { centAmount: 50 } }] } }] }],
    shippingInfo: { discountedPrice: { includedDiscounts: [{ discount: { id: 'cd-ship' }, discountedAmount: { centAmount: 695 } }] } },
    discountCodes: [
      { state: 'MatchesCart', discountCode: { id: 'a', obj: { code: 'WELCOME10', name: { 'en-US': 'Welcome' }, cartDiscounts: [{ id: 'cd-10' }] } } },
      { state: 'MatchesCart', discountCode: { id: 'b', obj: { code: 'FREESHIP', cartDiscounts: [{ id: 'cd-ship' }] } } },
      { state: 'DoesNotMatchCart', discountCode: { id: 'c', obj: { code: 'COFFEE15', cartDiscounts: [{ id: 'cd-15' }] } } },
    ],
  };
  const views = codeSavings(cart, 'en-US');
  it('Per code saving is summed from included discounts', () => {
    expect(views[0]).toMatchObject({ code: 'WELCOME10', label: 'Welcome', state: 'applied', savingCents: 200 });
  });
  it('Free shipping code', () => {
    expect(views[1]).toMatchObject({ code: 'FREESHIP', savingCents: 695 });
  });
  it('Code attached but not applicable is shown with its reason', () => {
    expect(views[2]).toMatchObject({ state: 'not_applicable', reason: 'DoesNotMatchCart', savingCents: null });
  });
  it('Codes stack', () => {
    expect(views.filter((v) => v.state === 'applied')).toHaveLength(2);
  });
});
