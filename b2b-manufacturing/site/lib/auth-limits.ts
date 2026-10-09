import 'server-only';
import { ApiError } from './errors';
import { customObjectStore } from './ct/rate-limit-store';
import { createLimiter, LIMITS, limitKey, type RateLimiter } from './rate-limit';

/** The shared limiter (Custom Object store). Replaced in tests with `setLimiter`. */
let limiter: RateLimiter = createLimiter(customObjectStore);
export const setLimiter = (next: RateLimiter): void => { limiter = next; };

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

const GENERIC = 'Too many attempts. Please try again later.';

/** Throws a 429 with the generic message and a Retry-After when `key` is over its limit. */
export async function enforce(route: keyof typeof LIMITS, ...parts: string[]): Promise<void> {
  const result = await limiter.hit(limitKey(route, ...parts), LIMITS[route]);
  if (!result.allowed) throw new ApiError(429, GENERIC, { retryAfter: result.retryAfterSec });
}

export const limitRegistration = (request: Request) => enforce('register', clientKey(request));
export const limitLogin = (request: Request, email: string) => enforce('login', clientKey(request), email.toLowerCase());
