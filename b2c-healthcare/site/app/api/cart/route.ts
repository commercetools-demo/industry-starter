import { handle, requireCustomer } from '@/lib/api';
import { getCartSummary, getCartValidated } from '@/lib/ct/cart';
import { syncCartSession, toSummary } from '@/lib/cart-route';
import { NO_STORE, requirePatient, rxContextOf } from '@/lib/rx-route';

/**
 * GET /api/cart: the signed-in customer's cart, every line re-validated against the prescription rules (lines that
 * cannot be dispensed carry `unavailable`; none is removed) and the platform's recalculated totals. `?view=summary`
 * is the cheap header read (id, version, counts; no re-validation, no write). `null` when there is no cart. The
 * session's `cartId` is set, or cleared when it was stale. Never cached: it is per patient and lists medications.
 */
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    if (new URL(request.url).searchParams.get('view') === 'summary') {
      const cart = await getCartSummary(session.customerId, session.cartId, rxContextOf(session).currency);
      await syncCartSession(cart);
      return Response.json(cart ? toSummary(cart) : null, { headers: NO_STORE });
    }
    const patient = await requirePatient(session.customerId);
    const cart = await getCartValidated(patient, session.customerId, session.cartId, rxContextOf(session));
    await syncCartSession(cart);
    return Response.json(cart, { headers: NO_STORE });
  });
}
