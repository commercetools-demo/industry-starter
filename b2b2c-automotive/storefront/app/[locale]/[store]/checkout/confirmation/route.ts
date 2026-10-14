// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /{locale}/{store}/checkout/confirmation?orderId=` (or `?orderNumber=`): the alias for a `checkout_completed` navigation that has no
// number segment yet (workstream P-06). The one registered return URL `/checkout/return` owns the order resolution (buyer rule, number,
// branch, clearing the ordered cart), so this handler only validates the parameter and hands over to it with a 303: a stranger and an
// unknown order get the same 404 there. A Route Handler because the return URL has no locale, which the locale-aware redirect cannot express.
import { ORDER_NUMBER_FORMAT } from '@/lib/checkout/order-number';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADERS = { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'private, no-store' } as const;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');
  const orderNumber = searchParams.get('orderNumber');
  const target = orderId && UUID.test(orderId) ? `/checkout/return?orderId=${orderId}` : orderNumber && ORDER_NUMBER_FORMAT.test(orderNumber) ? `/checkout/return?orderNumber=${orderNumber}` : null;
  if (!target) return new Response('Not found', { status: 404, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(null, { status: 303, headers: { ...HEADERS, Location: target } });
}
