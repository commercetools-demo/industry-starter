import { ApiError, handle, requireCustomer } from '@/lib/api';
import { readJsonObject } from '@/lib/auth-route';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { enableAutoRefill, listRefills, type EnableSource } from '@/lib/ct/auto-refill';
import { localeOfSession } from '@/lib/order-route';
import { refillErrorResponse } from '@/lib/refill-route';
import { CADENCES, type Cadence } from '@/lib/refill-types';
import { requirePatient, rxContextOf } from '@/lib/rx-route';

const ID = /^[\w-]{1,64}$/;
const REF = /^[\w.-]{1,64}$/;
const MAX_LINES = 20;

/** GET /api/auto-refill: the signed-in customer's auto-refills with the last scheduled check of each. */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    return { refills: await listRefills(session.customerId, localeOfSession(session)) };
  });
}

function parseSource(body: Record<string, unknown>): EnableSource {
  if (typeof body.orderId === 'string') {
    if (!ID.test(body.orderId)) throw new ApiError(400, 'The request could not be processed.');
    return { orderId: body.orderId };
  }
  const rxNumber = typeof body.rxNumber === 'string' ? body.rxNumber : typeof body.rx === 'string' ? body.rx : '';
  const lineRefs = body.lineRefs;
  if (!rxNumber || rxNumber.length > 40 || !Array.isArray(lineRefs) || lineRefs.length === 0 || lineRefs.length > MAX_LINES || !lineRefs.every((r) => typeof r === 'string' && REF.test(r))) {
    throw new ApiError(400, 'Choose at least one medication.');
  }
  return { rxNumber, lineRefs: lineRefs as string[] };
}

/**
 * POST /api/auto-refill { orderId | { rxNumber, lineRefs }, cadence: 'monthly' | 'quarterly' }: sets up a standing
 * order. Every line is re-validated now (prescription rules); needs a saved payment method. 201 with the new
 * auto-refill and the medicines that were left out (named with the reason). The RX number travels in the body only.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const body = await readJsonObject(request);
    const cadence = body.cadence;
    if (typeof cadence !== 'string' || !(CADENCES as readonly string[]).includes(cadence)) throw new ApiError(400, 'Choose how often.');
    const source = parseSource(body);
    const patient = await requirePatient(session.customerId);
    try {
      const result = await enableAutoRefill({ customerId: session.customerId, patient, ctx: rxContextOf(session), source, cadence: cadence as Cadence, provider: await getPaymentProvider() });
      return Response.json(result, { status: 201 });
    } catch (error) {
      return refillErrorResponse(error);
    }
  });
}
