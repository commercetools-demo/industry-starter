import { NextResponse } from 'next/server';
import { handle, requireCustomer } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { addAllToBag } from '@/lib/account/saved';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shopping-lists/add-to-cart -> 200 { added, skipped: [{ productId, name, reason }], cart }. Every saved product goes
 * into the CURRENT bag as a delivery line; the ones that cannot be bought are listed, the rest stay in the bag, and the list
 * is unchanged. 409 list_empty when nothing is saved.
 */
export const POST = handle('/api/shopping-lists/add-to-cart', async () => {
  const { customerId } = await requireCustomer();
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const out = await addAllToBag(customerId, session, market);
  if (!out) return domainError('list_empty', 409);
  return setSessionCookie(
    NextResponse.json(out.result, { headers: { 'Cache-Control': 'no-store' } }),
    await createSessionToken(out.session),
  );
});
