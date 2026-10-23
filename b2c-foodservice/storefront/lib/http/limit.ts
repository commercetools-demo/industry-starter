import { jsonError } from '@/lib/api';
import { hashKey, rateLimit, type RateLimitOptions } from '@/lib/rate-limit';

function clientAddress(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Per-client limit for a route that has no customer id (workstream Q, S10). The key is a hash of the route name and the
 * client address, never logged. Returns the `429 rate_limited` response with `Retry-After`, or null when allowed.
 * In-memory and per instance: the host's rate-limit rule is the second layer (RELEASE-CHECKLIST, Q-Q-7).
 */
export function limitClient(req: Request, route: string, options: RateLimitOptions): Response | null {
  const result = rateLimit(hashKey('route', route, clientAddress(req)), options);
  if (result.allowed) return null;
  const res = jsonError('rate_limited', 429);
  res.headers.set('Retry-After', String(result.retryAfterSeconds));
  return res;
}
