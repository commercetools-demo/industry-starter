import { NextResponse } from 'next/server';
import { handle, requireCustomer } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { WrongPasswordError, deleteCustomerAccount } from '@/lib/ct/customer';
import { SAFE_MESSAGES } from '@/lib/errors';
import { hashKey, rateLimit } from '@/lib/rate-limit';
import { clearSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * POST /api/account/delete { confirmPassword } -> 200 { ok: true } and the session cookie is cleared.
 * The password is re-verified first; a wrong or missing one is 400 current_password_invalid and nothing is deleted.
 * 429 rate_limited (5 tries per 10 minutes). The customer is deleted with `dataErasure: false`: order records stay.
 */
export const POST = handle('/api/account/delete', async (req) => {
  const { customerId } = await requireCustomer();
  const limited = rateLimit(hashKey('delete-account', customerId), { limit: 5, windowMs: TEN_MINUTES });
  if (!limited.allowed) {
    return Response.json(
      { error: { code: 'rate_limited', message: SAFE_MESSAGES.rate_limited, retryAfterSeconds: limited.retryAfterSeconds } },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }
  const raw = (await req.json().catch(() => null)) as { confirmPassword?: unknown } | null;
  const password = raw?.confirmPassword;
  if (typeof password !== 'string' || password === '') return domainError('current_password_invalid', 400);
  try {
    await deleteCustomerAccount(customerId, password);
  } catch (e) {
    if (e instanceof WrongPasswordError) return domainError('current_password_invalid', 400);
    throw e;
  }
  return clearSessionCookie(NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } }));
});
