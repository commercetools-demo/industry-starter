import { handle, jsonError } from '@/lib/api';
import { limitClient } from '@/lib/http/limit';
import { isValidEmail } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/newsletter { email } -> 202 { ok: true }; 422 validation_failed for an invalid address.
 * A validated no-op (Q-F-07): nothing is stored and the address is never logged. No email is sent (D-032).
 */
export const POST = handle('/api/newsletter', async (req) => {
  const limited = limitClient(req, 'newsletter', { limit: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const raw: unknown = await req.json().catch(() => null);
  const email = (raw as { email?: unknown } | null)?.email;
  if (typeof email !== 'string' || !isValidEmail(email)) return jsonError('validation_failed', 422);
  return Response.json({ ok: true }, { status: 202 });
});
