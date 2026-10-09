import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { ApiError } from './errors';
import { getSession, type Session } from './session';

export { ApiError };

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * Cross-site requests may not change state (defence in depth next to the SameSite=Lax cookie). Browsers send `Sec-Fetch-Site`;
 * when it, or `Origin`, says the request came from another site, the handler is not run. Non-browser clients send neither and pass.
 */
export function isCrossSite(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site) return site !== 'same-origin' && site !== 'none';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host !== (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host); } catch { return true; }
}

/** Wrap a handler: any failure becomes `{ error }` with a safe message, never the raw SDK error, body or credentials. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      const first = args[0];
      if (first instanceof Request && isCrossSite(first)) throw new ApiError(403, 'Request not allowed.');
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        const retryAfter = typeof error.data?.retryAfter === 'number' ? { 'Retry-After': String(error.data.retryAfter) } : undefined;
        return NextResponse.json({ ...error.data, error: error.message }, { status: error.status, headers: retryAfter });
      }
      console.error('api error', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

export async function requireCustomer(locale?: string): Promise<Session & { customerId: string }> {
  const session = await getSession(locale);
  if (!session.customerId) throw new ApiError(401, 'Please sign in.');
  return session as Session & { customerId: string };
}

export async function requireBusinessUnit(locale?: string): Promise<Session & { customerId: string; businessUnitKey: string }> {
  const session = await requireCustomer(locale);
  if (!session.businessUnitKey) throw new ApiError(400, 'No active business unit');
  return session as Session & { customerId: string; businessUnitKey: string };
}

export const ok = (body: unknown) => json(body);

/**
 * Reads and validates a JSON body with a zod schema. A body that is not JSON or fails the schema is a 400 whose message is the first
 * issue; `fieldErrors` names each failing field (first message per field).
 */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S, fallback = 'Check your details and try again.'): Promise<z.infer<S>> {
  const raw = await request.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) { const key = String(issue.path[0] ?? ''); if (key && !fieldErrors[key]) fieldErrors[key] = issue.message; }
  throw new ApiError(400, Object.values(fieldErrors)[0] ?? fallback, { fieldErrors });
}
