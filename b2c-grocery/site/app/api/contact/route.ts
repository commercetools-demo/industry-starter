import { NextResponse } from 'next/server';
import { validateContact } from '@/lib/contact-validation';
import { clientKey, LIMITS, rateLimit } from '@/lib/rate-limit';

/**
 * Stub contact submit (D-039, D-044): validates and logs topic and length only, delivers nothing.
 * Never log or store name, email or message text.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  // Honeypot: bots fill the hidden `website` field. Pretend success, log nothing.
  const website = typeof body === 'object' && body !== null ? (body as { website?: unknown }).website : undefined;
  if (typeof website === 'string' && website.trim() !== '') return NextResponse.json({ ok: true });

  const limit = rateLimit(clientKey(request, 'contact'), LIMITS.contact);
  if (!limit.ok) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  }

  const result = validateContact(body);
  if (!result.ok) return NextResponse.json({ error: 'VALIDATION', fields: result.errors }, { status: 400 });

  console.info('contact', { topic: result.value.topic, length: result.value.message.length });
  return NextResponse.json({ ok: true });
}
