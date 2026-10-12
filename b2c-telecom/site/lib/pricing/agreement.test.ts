// @vitest-environment node
// One cart, four surfaces: the bundle, checkout, the confirmation and the account's order all state the same "then monthly" and the same
// amount due at order, because each reads the engine's figures and the standing price (promotions apply to the first order only).
import { cartOffersByKey } from '@/lib/cart/__fixtures__/offers';
import { buildReview } from '@/lib/checkout/review';
import { mapCart } from '@/lib/mappers/cart';
import { mapOrder } from '@/lib/mappers/order';
import type { CheckoutState } from '@/lib/types';
import { ctCart } from '@/test/fixtures/ctCart';
import { ctLine, ctOrder } from '@/test/fixtures/orders';
import { makeState } from '@/test/fixtures/checkoutApi';
import { buildOrderPricingStamp } from './orderStamp';
import { rowsSum } from './summary';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' } as const;
const offers = cartOffersByKey();
const TODAY = '2026-10-07';

const plan = { id: 'L1', sku: 'MLV-CBL-500-24M', offerKey: 'malva-offer-cable-500', price: 5999, mode: 'Fixed' as const, total: 0, discounts: ['cd-intro'], discountCents: 5999 };
const addon = { id: 'L3', sku: 'MLV-ADD-APPLETV-MTH', offerKey: 'malva-offer-appletv', price: 999, mode: 'Dynamic' as const, parent: 'L1' };
const fee = { id: 'F1', offerKey: 'malva-offer-cable-500', money: 2500 };

describe('bundle, checkout, confirmation and account agree', () => {
  const cart = mapCart(ctCart({ lines: [plan, addon], fees: [fee] }), ctx, { offersByKey: offers, stock: {}, issues: [], today: TODAY, discountKeyById: { 'cd-intro': 'malva-cd-intro-free-month' } });

  it('the first month is free: due today is the add-on plus the activation fee, then the standing price of every recurring line', () => {
    expect(cart.summary.dueToday.centAmount).toBe(999 + 2500);
    expect(cart.summary.thenMonthly.centAmount).toBe(5999 + 999);
  });

  it('the rows add up to Due today', () => {
    expect(rowsSum(cart.summary).centAmount).toBe(cart.summary.dueToday.centAmount);
  });

  it('checkout review states the same figures as the bundle', () => {
    const review = buildReview({ ...makeState({ cart }) } as CheckoutState, TODAY);
    expect(review.dueToday).toEqual(cart.summary.dueToday);
    expect(review.monthlyAfterToday).toEqual(cart.summary.thenMonthly);
  });

  it('the plan schedule agrees: Due at order is the cart line total plus its fee, and the standing period is the "then" price', () => {
    const planLine = cart.lines.find((line) => line.kind === 'plan');
    expect(planLine?.schedule?.dueAtOrder.centAmount).toBe((planLine?.total.centAmount ?? 0) + 2500);
    expect(planLine?.schedule?.periods.find((period) => period.kind === 'standing')?.monthlyAmount.centAmount).toBe(5999);
  });

  it('the order placed from it (stamped schedule, mapped like the account does) states the same monthly and total', () => {
    const stamp = buildOrderPricingStamp({ lines: cart.lines, orderDate: TODAY, locale: 'en-US', currencyCode: 'USD', offers });
    expect(stamp.errors).toEqual([]);
    const order = mapOrder(
      ctOrder({
        orderNumber: 'MLV-AGREE',
        createdAt: `${TODAY}T10:00:00.000Z`,
        total: cart.summary.total.centAmount,
        lines: [
          ctLine({ id: 'L1', productKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M', name: 'Cable 500', total: 0, recurring: 'Fixed' }),
          ctLine({ id: 'L3', productKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', total: 999, recurring: 'Dynamic', fields: { parentLineItemId: 'L1' } }),
        ],
        fields: { priceSchedule: stamp.priceSchedule, labelSnapshot: stamp.labelSnapshot, serviceStartDate: stamp.serviceStartDate },
      }),
      'en-US',
    );
    expect(order.monthly.centAmount).toBe(cart.summary.thenMonthly.centAmount);
  });
});
