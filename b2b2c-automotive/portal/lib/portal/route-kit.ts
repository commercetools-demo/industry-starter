// Route Handler helpers for the portal shell and auth routes: G's `lib/api.ts` plus two small response builders.
import 'server-only';

export { ApiError, handle, parseJson, requireCustomer } from '@/lib/api';

export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return Response.json(body, { status: init.status ?? 200, headers: { ...NO_STORE, ...init.headers } });
}

/**
 * A failure with an exact message and an optional machine code. `handle` maps a thrown 401 to the generic "Not signed in",
 * so routes that must say something specific (wrong credentials, missing fields) return this instead of throwing.
 */
export function fail(status: number, error: string, code?: string): Response {
  return json({ error, ...(code ? { code } : {}) }, { status });
}
