import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { demoCredentials, demoLoginEnabled } from '@/lib/auth/demo-customers';
import { limitLogin, signInAndRespond } from '@/lib/auth/login-flow';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/demo-login { key } -> same as /api/auth/login. The server maps the key to the seeded email and reads
 * the shared demo password from the environment (D-040); neither reaches the browser. Shares the login rate limit.
 */
export const POST = handle('/api/auth/demo-login', async (req) => {
  if (!demoLoginEnabled()) return domainError('not_found', 404);
  const raw: unknown = await req.json().catch(() => null);
  const key = (raw as { key?: unknown } | null)?.key;
  const credentials = typeof key === 'string' ? demoCredentials(key) : null;
  if (!credentials) return domainError('invalid_request', 400);
  const limited = limitLogin(req, credentials.email);
  if (limited) return limited;
  return signInAndRespond(credentials.email, credentials.password, await getSession());
});
