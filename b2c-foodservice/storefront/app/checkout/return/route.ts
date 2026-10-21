import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { finalizeWithPolling } from '@/lib/checkout/finalize';
import { ORDER_ID_PATTERN } from '@/lib/checkout/order-access';
import { readPayParts } from '@/lib/checkout/pay-cookie';
import { afterPlacement, applyPlacement } from '@/lib/checkout/placed';
import { getSession } from '@/lib/session';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isLocaleKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ORDER_NUMBER = /^MC-[0-9A-Z]{10}(-[A-H])?$/;

/**
 * GET /checkout/return?orderId=<id> or ?orderNumber=<n> (outside `[locale]`; the payment return URL of the Application, used by
 * redirect payment methods such as 3-D Secure). Finalises the order and answers `303` to
 * `/<order locale>/checkout/confirmation/<orderId>`; the locale is the order's own when it is one of ours, never taken from the
 * query. A payment of a mixed bag that is not the last returns to `/<locale>/checkout?resume=1&part=<next>` for the next payment.
 * Unknown or malformed order: `303` to the "No recent order" page. Nothing from the query is echoed.
 */
export const GET = handle('/checkout/return', async (req) => {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId');
  const orderNumber = url.searchParams.get('orderNumber');
  const ref =
    orderId && ORDER_ID_PATTERN.test(orderId) ? { orderId } : orderNumber && ORDER_NUMBER.test(orderNumber) ? { orderNumber } : null;
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin), 303);
  const none = `/${DEFAULT_LOCALE.locale}/checkout/confirmation`;
  if (!ref) return to(none);

  const order = await finalizeWithPolling(ref);
  if (!order) return to(none);
  const locale = isLocaleKey(order.locale) ? COUNTRY_CONFIG[order.locale].locale : DEFAULT_LOCALE.locale;

  const session = await getSession();
  const placement = await afterPlacement(session, await readPayParts(), order);
  const res = to(placement.next !== null ? `/${locale}/checkout?resume=1&part=${placement.next}` : `/${locale}/checkout/confirmation/${encodeURIComponent(order.id)}`);
  return applyPlacement(res, placement);
});
