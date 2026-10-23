import { domainError } from '@/lib/api-domain';
import { handle } from '@/lib/api';
import { limitLogin, signInAndRespond } from '@/lib/auth/login-flow';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login { email, password } -> 200 { customer, cart } plus a fresh session cookie.
 * 401 invalid_credentials is identical for unknown and wrong; 429 too_many_attempts carries retryAfterSeconds.
 */
export const POST = handle('/api/auth/login', async (req) => {
  const raw: unknown = await req.json().catch(() => null);
  const { email, password } = (raw ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return domainError('invalid_request', 400);
  }
  const limited = limitLogin(req, email);
  if (limited) return limited;
  return signInAndRespond(email.trim(), password, await getSession());
});
