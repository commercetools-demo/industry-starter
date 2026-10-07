import 'server-only';
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { mapCart } from '@/lib/mappers/cart';
import { buildOrderPricingStamp, type OrderStamp } from '@/lib/pricing/orderStamp';
import type { Market } from '@/lib/types';
import { getAllOffers } from './catalog';
import { getApiRoot } from './client';
import { getCartDiscountKeys } from './discount-keys';
import { stampOrderCustomFields } from './recurring';
import { withTimeout } from './timeout';

/**
 * For U, right after the order exists: reads the order, builds its price schedules and label snapshot from the ORDER's creation date and
 * its own prices (the order lines are mapped exactly like cart lines) and writes `priceSchedule`, `labelSnapshot` and `serviceStartDate`
 * onto the order. `orderId` comes from the server's own order creation, never from the client. The returned `errors` list plans whose
 * schedule or label could not be built (U decides what to do; the stamp still holds everything that could).
 */
export async function stampOrderPricing(orderId: string, market: Market): Promise<OrderStamp> {
  const { body: order } = await withTimeout(getApiRoot().orders().withId({ ID: orderId }).get().execute(), 'order-stamp.read');
  const [offers, discountKeyById] = await Promise.all([getAllOffers(market), getCartDiscountKeys()]);
  const offersByKey = Object.fromEntries(offers.map((offer) => [offer.key, offer]));
  const orderDate = order.createdAt.slice(0, 10);
  // An order has the cart's shape for everything the mapper reads (lines, custom line items, prices, discount codes).
  const mapped = mapCart(order as unknown as CtCart, market, { offersByKey, stock: {}, issues: [], today: orderDate, discountKeyById });
  const stamp = buildOrderPricingStamp({ lines: mapped.lines, orderDate, locale: market.locale, currencyCode: market.currency, offers: offersByKey });
  await stampOrderCustomFields(orderId, { priceSchedule: stamp.priceSchedule, labelSnapshot: stamp.labelSnapshot, serviceStartDate: stamp.serviceStartDate });
  return stamp;
}
