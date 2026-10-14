// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /checkout/return`: the one payment return URL of the hosted Checkout Application (O D4a). It has no locale and no store, so the proxy
// (G) lets it through and the ORDER decides where the shopper goes. Idempotent: calling it twice leads to the same confirmation.
//   ?orderId=<uuid> | ?orderNumber=MA-XXXXXXXX  -> 303 to /{locale}/{store}/checkout/confirmation/{number}; the ordered cart leaves the session
//   no order in the query (payment cancelled or expired) -> 303 back to the checkout page of the session store, which starts a new session
//   anything else (unknown, malformed, not yours)        -> the same plain 404 for every reason
// A Route Handler, not a page: it must write the session cookie (a Server Component cannot).
import { resolveReturn } from '@/lib/checkout/return';
import { getLocale, getSession, updateSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'private, no-store' } as const;
const notFound = () => new Response('Not found', { status: 404, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
const redirect = (location: string) => new Response(null, { status: 303, headers: { ...HEADERS, Location: location } });

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId') ?? undefined;
  const orderNumber = searchParams.get('orderNumber') ?? undefined;
  const session = await getSession();

  if (!orderId && !orderNumber) {
    if (!session.storeKey) return notFound();
    const { locale } = await getLocale();
    return redirect(`/${locale}/${session.storeKey}/checkout?status=cancelled`);
  }

  const result = await resolveReturn({ orderId, orderNumber }, session).catch((error: unknown) => {
    console.error(`[checkout] return failed (${error instanceof Error ? error.constructor.name : typeof error})`);
    return null;
  });
  if (!result || result.status === 'not-found') return notFound();
  if (result.cartId && session.cartId === result.cartId) {
    await updateSession((s) => {
      const next = { ...s };
      delete next.cartId;
      return next;
    });
  }
  return redirect(result.path);
}
