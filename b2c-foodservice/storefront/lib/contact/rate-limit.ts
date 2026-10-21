import 'server-only';
import { createHash } from 'node:crypto';

/**
 * In-memory fixed-window limiter, per server instance (Q-P-4: on serverless hosting a shared store or the host's
 * WAF is the real answer). Same call shape as workstream J's shared limiter so the two can be merged later.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now = Date.now(),
): { ok: boolean; retryAfterSec: number } {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  return { ok: true, retryAfterSec: 0 };
}

/** A stable key from the first `x-forwarded-for` value; the address itself is hashed and never logged. */
export function clientKey(req: Request): string {
  const first = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  return createHash('sha256').update(first).digest('hex').slice(0, 24);
}

export function resetRateLimits(): void {
  hits.clear();
}
