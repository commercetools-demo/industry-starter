import { authFailure } from '@/lib/auth/api';
import { assertSameOrigin } from '@/lib/auth/origin';
import { json } from '@/lib/ct/http';
import { updateSession } from '@/lib/ct/session';

export const dynamic = 'force-dynamic';

/** Clears the identity fields and the cart reference of the session; keeps `anonymousId`. Needs no commercetools call. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const response = json({ ok: true });
    await updateSession({ customerId: undefined, signedInAt: undefined, cartId: undefined }, response);
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
