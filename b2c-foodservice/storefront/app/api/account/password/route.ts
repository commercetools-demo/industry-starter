import { handle, requireCustomer } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { validatePassword } from '@/lib/auth/password-policy';
import { changePassword, isInvalidCurrentPassword } from '@/lib/ct/customer';
import { SAFE_MESSAGES } from '@/lib/errors';
import { hashKey, rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * POST /api/account/password { currentPassword, newPassword } -> 200 { ok: true }.
 * 429 rate_limited (5 tries per 10 minutes per customer, `retryAfterSeconds`); 422 password_policy `{ failed }` (J's policy,
 * checked BEFORE any commercetools call); 400 current_password_invalid. Passwords are never logged or echoed.
 */
export const POST = handle('/api/account/password', async (req) => {
  const { customerId } = await requireCustomer();
  const limited = rateLimit(hashKey('password-change', customerId), { limit: 5, windowMs: TEN_MINUTES });
  if (!limited.allowed) {
    return Response.json(
      { error: { code: 'rate_limited', message: SAFE_MESSAGES.rate_limited, retryAfterSeconds: limited.retryAfterSeconds } },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }
  const raw = (await req.json().catch(() => null)) as { currentPassword?: unknown; newPassword?: unknown } | null;
  const { currentPassword, newPassword } = raw ?? {};
  if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string') {
    return domainError('invalid_request', 400);
  }
  const session = await getSession();
  const check = validatePassword(newPassword, session.customerEmail);
  if (!check.ok) return domainError('password_policy', 422, { failed: check.failed });
  try {
    await changePassword(customerId, currentPassword, newPassword);
  } catch (e) {
    if (isInvalidCurrentPassword(e)) return domainError('current_password_invalid', 400);
    throw e;
  }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
});
