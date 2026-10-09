import { timingSafeEqual } from 'node:crypto';
import { finalizeOrder } from '@/lib/ct/orders';
import { log } from '@/lib/log';

/** Header the caller sends. The value is `ORDER_FINALIZE_SECRET` (server-only, never in git). */
const FINALIZE_SECRET_HEADER = 'x-order-secret';

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get(FINALIZE_SECRET_HEADER) ?? '');
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

type Payload = { orderId?: unknown; resource?: { id?: unknown; typeId?: unknown }; message?: { data?: unknown } } | null;

/** The order id from `{ orderId }`, a commercetools message body (`{ resource: { id } }`) or a Pub/Sub push envelope (`{ message: { data } }`, base64 of the message). */
function orderIdOf(value: unknown): string | null {
  const v = value as Payload;
  let id: string | null = null;
  if (typeof v?.orderId === 'string') id = v.orderId;
  else if (v?.resource && typeof v.resource.id === 'string' && (v.resource.typeId === undefined || v.resource.typeId === 'order')) id = v.resource.id;
  else if (typeof v?.message?.data === 'string') {
    try {
      return orderIdOf(JSON.parse(Buffer.from(v.message.data, 'base64').toString('utf8')));
    } catch {
      return null;
    }
  }
  return id && /^[\w-]{1,64}$/.test(id) ? id : null;
}

/**
 * POST /api/internal/order-created: the safety net for an order Checkout created while the buyer's browser never called
 * back (tab closed, network lost). A commercetools Subscription on `OrderCreated` (delivered by a Connect event app or a
 * queue consumer) posts the order here and the same `finalizeOrder` runs, idempotently. Never public: without
 * `ORDER_FINALIZE_SECRET` (16+ characters) it answers 503, without the matching header 401 with no detail. Answers the
 * outcome code only, never an id or a number. Not cached. Optional: the order page also finalizes lazily when it is read.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.ORDER_FINALIZE_SECRET?.trim();
  const headers = { 'cache-control': 'no-store' };
  if (!secret || secret.length < 16) return Response.json({ error: 'Not available.' }, { status: 503, headers });
  if (!authorized(request, secret)) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers });
  const orderId = orderIdOf(await request.json().catch(() => null));
  if (!orderId) return Response.json({ error: 'Bad request.' }, { status: 400, headers });
  try {
    const outcome = await finalizeOrder(orderId);
    // A retryable outcome answers 5xx so the queue redelivers; a refusal is final and acknowledged.
    const final = outcome.ok || outcome.code === 'DISPENSE_REFUSED' || outcome.code === 'FUNDING_CHANGED';
    return Response.json({ ok: outcome.ok, ...(outcome.ok ? { replay: outcome.replay } : { code: outcome.code }) }, { status: final ? 200 : outcome.code === 'NOT_FOUND' ? 404 : 503, headers });
  } catch (error) {
    log.error('checkout', 'order-created finalize failed', error instanceof Error ? error : { name: typeof error });
    return Response.json({ error: 'The run failed.' }, { status: 500, headers });
  }
}
