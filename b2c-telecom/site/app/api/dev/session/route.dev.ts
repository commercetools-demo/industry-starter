import { ApiError } from '@/lib/api-error';
import { errorResponse, json } from '@/lib/ct/http';
import { ensureAnonymousId } from '@/lib/ct/identity';
import { clearSessionCookie, getSession, updateSession } from '@/lib/ct/session';

// Development-only: sets a test session cookie so cookie flags can be inspected before the sign-in flow exists.
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const kind = typeof body === 'object' && body !== null ? (body as { kind?: unknown }).kind : undefined;
    const res = json({ ok: true });
    if (kind === 'anonymous') {
      await updateSession({ anonymousId: ensureAnonymousId(await getSession()).anonymousId }, res);
    } else if (kind === 'customer') {
      await updateSession({ customerId: 'dev-customer', anonymousId: undefined }, res);
    } else if (kind === 'clear') {
      clearSessionCookie(res);
    } else {
      throw new ApiError('VALIDATION', 'kind must be anonymous, customer or clear');
    }
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
