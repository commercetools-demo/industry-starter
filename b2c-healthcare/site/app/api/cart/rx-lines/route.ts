import { ApiError, handle, requireCustomer } from '@/lib/api';
import { readJsonObject } from '@/lib/auth-route';
import { addRxLines } from '@/lib/ct/cart';
import { RxNotFoundError, validateRxSelection } from '@/lib/ct/prescriptions';
import { syncCartSession } from '@/lib/cart-route';
import { isLimitError, mapLimitError } from '@/lib/dispense/limit-errors';
import { NO_STORE, requirePatient, rxContextOf } from '@/lib/rx-route';
import type { RxLineView } from '@/lib/types';

const MAX_LINES = 20;
const REF = /^[\w.-]{1,64}$/;
const NOTHING_ADDED = 'None of the selected medications can be added right now.';

function refusedLimit(lineRef: string, error: unknown): RxLineView | null {
  const refusal = mapLimitError(error);
  if (!refusal) return null;
  return { lineRef, name: '', sig: '', qty: 0, price: null, status: 'CEILING', selectable: false, remaining: refusal.remaining, ceiling: refusal.ceiling, scope: 'order', minShelfLifeMonths: null };
}

/**
 * POST /api/cart/rx-lines { rxNumber | rx, lineRefs[] }. Signed-in patients only. The server re-validates the
 * selection (`validateRxSelection`: own prescription, refills, expiry, stock, ceilings, shelf life), creates the
 * cart on the first add and sets `cartId` in the session, then adds the accepted lines; a line already in the cart
 * from the same prescription line is replaced, not duplicated. Answers `{ cart, refused }`; 422 when nothing could be
 * added. The RX number is in the body only and is never logged.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const body = await readJsonObject(request);
    const rxNumber = typeof body.rxNumber === 'string' ? body.rxNumber : typeof body.rx === 'string' ? body.rx : '';
    const lineRefs = body.lineRefs;
    if (!rxNumber || rxNumber.length > 40 || !Array.isArray(lineRefs) || lineRefs.length === 0 || lineRefs.length > MAX_LINES || !lineRefs.every((r) => typeof r === 'string' && REF.test(r))) {
      throw new ApiError(400, 'Choose at least one medication to add.');
    }
    const patient = await requirePatient(session.customerId);
    const ctx = rxContextOf(session);
    let selection;
    try {
      selection = await validateRxSelection(patient, rxNumber, lineRefs as string[], ctx);
    } catch (error) {
      if (error instanceof RxNotFoundError) throw new ApiError(404, 'Prescription not found.');
      throw error;
    }
    const refused = [...selection.refused];
    if (selection.accepted.length === 0) {
      return Response.json({ code: 'NOTHING_ADDED', error: NOTHING_ADDED, refused }, { status: 422, headers: NO_STORE });
    }
    try {
      const { cart } = await addRxLines(session.customerId, session.cartId, selection.rxNumber, selection.accepted, ctx, patient);
      await syncCartSession(cart);
      return Response.json({ cart, refused }, { headers: NO_STORE });
    } catch (error) {
      // The platform's own per-order limit refused the update (the whole update is rejected).
      if (isLimitError(error)) {
        const rows = selection.accepted.map((a) => refusedLimit(a.lineRef, error)).filter((r): r is RxLineView => r !== null);
        return Response.json({ code: 'NOTHING_ADDED', error: NOTHING_ADDED, refused: [...refused, ...rows] }, { status: 422, headers: NO_STORE });
      }
      throw error;
    }
  });
}
