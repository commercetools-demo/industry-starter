import 'server-only';
import { randomInt } from 'node:crypto';
import { channelFor } from '@/content/contact';
import { forwardContact } from '@/lib/contact/forward';
import { limitClient } from '@/lib/http/limit';
import { validateContact } from '@/lib/contact/validate';
import { resolveLocalized } from '@/lib/content/localized';
import { isLocaleKey, marketForLocale } from '@/lib/utils';

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0, O, 1, I
const LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

export function makeReference(now = new Date()): string {
  const day = now.toISOString().slice(0, 10).replaceAll('-', '');
  let tail = '';
  for (let i = 0; i < 6; i += 1) tail += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `MC-${day}-${tail}`;
}

/** Same body shape as the rest of the API: `{ error: { code, message } }`. */
function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function log(line: { reference?: string; topic?: string; status: number; correlationId: string }): void {
  // Never the name, email, order number or message.
  console.log(JSON.stringify({ route: 'contact', ...line }));
}

/**
 * POST /api/contact. 202 only after the receiver answered 2xx; 400 invalid_request (no field details, never the
 * entered value); 415; 429 with Retry-After; 503 contact_unavailable when the enquiry could not be passed on.
 */
export async function handleContact(req: Request): Promise<Response> {
  const correlationId = crypto.randomUUID();
  if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    log({ status: 415, correlationId });
    return fail('unsupported_media_type', 'Unsupported media type', 415);
  }

  const limited = limitClient(req, 'contact', LIMIT);
  if (limited) {
    log({ status: 429, correlationId });
    return limited;
  }

  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const checked = validateContact(body);
  const honeypot = typeof body.website === 'string' && body.website.trim() !== '';
  if (!checked.ok || honeypot) {
    log({ status: 400, correlationId });
    return fail('invalid_request', 'The request could not be understood', 400);
  }

  const locale = isLocaleKey(body.locale) ? body.locale : 'en-US';
  const country = marketForLocale(locale).country;
  const reference = makeReference();
  const accepted = await forwardContact({
    reference,
    receivedAt: new Date().toISOString(),
    locale,
    country,
    topic: checked.value.topic,
    orderNumber: checked.value.orderNumber,
    name: checked.value.name,
    email: checked.value.email,
    message: checked.value.message,
  });
  if (!accepted) {
    log({ reference, topic: checked.value.topic, status: 503, correlationId });
    return fail('contact_unavailable', 'The service is temporarily unavailable. Please try again', 503);
  }

  const channel = resolveLocalized(channelFor(country).label, locale).value;
  log({ reference, topic: checked.value.topic, status: 202, correlationId });
  return Response.json({ reference, channel }, { status: 202 });
}
