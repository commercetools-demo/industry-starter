import 'server-only';
import { hashKey, rateLimit, type RateLimitOptions } from '@/lib/rate-limit';

/**
 * Assistant route guard (T-24). The same-origin and JSON checks already ran in `handle()` (`lib/http/guard.ts`), so this runs after
 * them: the switch first, then the rate limit by cost class. A disabled or unconfigured assistant answers a named 503 and never
 * reaches the model, the store or the MCP.
 */
export type RateClass = 'session' | 'turn' | 'card' | 'adopt';

export const RATE_LIMITS: Record<RateClass, RateLimitOptions> = {
  session: { limit: 30, windowMs: 10 * 60 * 1000 },
  turn: { limit: 20, windowMs: 10 * 60 * 1000 },
  card: { limit: 60, windowMs: 10 * 60 * 1000 },
  adopt: { limit: 20, windowMs: 10 * 60 * 1000 },
};

export type AssistantFailure = 'assistant_disabled' | 'assistant_unavailable';

export function assistantEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ASSISTANT_ENABLED?.trim().toLowerCase() === 'true';
}

/** True when the keys the turn needs are present (names only are checked; values are never logged). */
export function assistantConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

function failure(code: AssistantFailure, status: number, headers?: Record<string, string>): Response {
  const message = code === 'assistant_disabled' ? 'The assistant is not available' : 'The assistant is temporarily unavailable';
  return Response.json({ error: { code, message } }, { status, headers });
}

function clientAddress(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Returns the refusal response, or null when the call may go on. `principal` is the session's agent session id or anonymous id when
 * known; the client address is always part of the key, so a rotated cookie does not reset the window.
 */
export function guardAssistant(
  req: Request,
  cls: RateClass,
  principal = '',
  env: Record<string, string | undefined> = process.env,
): Response | null {
  if (!assistantEnabled(env)) return failure('assistant_disabled', 503);
  const result = rateLimit(hashKey('assistant', cls, clientAddress(req), principal), RATE_LIMITS[cls]);
  if (!result.allowed) {
    return Response.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Too many requests. Please try again shortly',
        },
      },
      {
        status: 429,
        headers: { 'Retry-After': String(result.retryAfterSeconds) },
      },
    );
  }
  return null;
}

export function unavailable(): Response {
  return failure('assistant_unavailable', 503);
}
