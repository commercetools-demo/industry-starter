import 'server-only';
import { getSession, type SessionData } from '@/lib/session';

/** An error whose message is safe to show to the visitor. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const SAFE_MESSAGES: Record<number, string> = {
  400: 'The request could not be processed.',
  401: 'Please sign in to continue.',
  403: 'You do not have access to this.',
  404: 'Not found.',
  409: 'This changed in the meantime. Please try again.',
  429: 'Too many requests. Please try again shortly.',
};
const GENERIC = 'Something went wrong. Please try again.';

/** Pulls an HTTP status out of an unknown thrown value (commercetools SDK errors carry `statusCode`/`status`). */
function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const e = error as { statusCode?: unknown; status?: unknown };
  const value = typeof e.statusCode === 'number' ? e.statusCode : e.status;
  return typeof value === 'number' && value >= 400 && value < 600 ? value : undefined;
}

/** Maps any thrown value to a safe `{ error }` response: never the raw error, request body or credentials. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  const status = statusOf(error);
  if (status && status < 500) {
    return Response.json({ error: SAFE_MESSAGES[status] ?? SAFE_MESSAGES[400] }, { status });
  }
  // Log the class and status only: the message may echo a request body (health-data-minimization).
  console.error('[api] unhandled error', error instanceof Error ? error.name : typeof error, status ?? '');
  return Response.json({ error: GENERIC }, { status: status ?? 500 });
}

/**
 * Route Handler wrapper. Usage:
 *
 *   export async function GET() {
 *     return handle(async () => {
 *       const { customerId } = await requireCustomer();
 *       return getOrders(customerId); // one function from lib/ct/<namespace>.ts
 *     });
 *   }
 *
 * A returned `Response` is passed through; any other value is sent as JSON.
 */
export async function handle(fn: () => Promise<unknown> | unknown): Promise<Response> {
  try {
    const result = await fn();
    return result instanceof Response ? result : Response.json(result ?? null);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Patient-data endpoints: throws a 401 ApiError before any commercetools call when not signed in. */
export async function requireCustomer(): Promise<SessionData & { customerId: string }> {
  const session = await getSession();
  if (!session.customerId) throw new ApiError(401, SAFE_MESSAGES[401]);
  return { ...session, customerId: session.customerId };
}
