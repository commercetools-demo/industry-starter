import { handle, requireCustomer } from '@/lib/api';
import { readJsonObject } from '@/lib/auth-route';
import { lookupPrescription } from '@/lib/ct/prescriptions';
import { getPatient } from '@/lib/ct/patient';
import { notFoundMessage } from '@/lib/dispense/rx-number';
import { lookupLimiter, NO_STORE, rxContextOf } from '@/lib/rx-route';

/** Same text and status for a number that does not exist and one that belongs to someone else. */
const RATE_LIMITED = 'Too many lookups. Please try again in a few minutes.';

/**
 * POST /api/prescriptions/lookup { rx }. Signed-in patients only. The number is normalised (`rx 48213` becomes
 * `RX-48213`), looked up among the patient's OWN prescriptions, and answered with the card. An unknown number and
 * someone else's number get the identical 404 body, and each such attempt counts toward the rate limit (5 failed
 * lookups per 10 minutes per customer, F-05). The input and the prescription are never logged or placed in a URL:
 * this handler writes no log line and the body is not echoed anywhere but into the 404 text (HTML-escaped).
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const body = await readJsonObject(request);
    const input = typeof body.rx === 'string' ? body.rx : '';

    const limiter = await lookupLimiter();
    const status = await limiter.status(session.customerId);
    if (status.limited) {
      return Response.json({ code: 'RATE_LIMITED', error: RATE_LIMITED, retryAfterSeconds: status.retryAfterSeconds }, { status: 429, headers: { ...NO_STORE, 'retry-after': String(status.retryAfterSeconds) } });
    }

    const patient = await getPatient(session.customerId);
    const view = patient ? await lookupPrescription(patient, input, rxContextOf(session)) : null;
    if (!view) {
      await limiter.recordFailure(session.customerId);
      return Response.json({ code: 'NOT_FOUND', error: notFoundMessage(input) }, { status: 404, headers: NO_STORE });
    }
    return Response.json(view, { headers: NO_STORE });
  });
}
