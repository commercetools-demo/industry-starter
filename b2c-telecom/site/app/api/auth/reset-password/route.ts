import { authError, authFailure, rateLimited, readAuthBody, stringField } from '@/lib/auth/api';
import { assertSameOrigin } from '@/lib/auth/origin';
import { rateLimit } from '@/lib/auth/rate-limit';
import { RATE_LIMITS } from '@/lib/config/auth';
import { checkPassword } from '@/lib/config/password';
import { InvalidTokenError, markSessionsInvalid, resetPassword, verifyEmailNow } from '@/lib/ct/customer';
import { json } from '@/lib/ct/http';
import { getSession, updateSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';
import { clientKey } from '@/lib/rate-limit';
import { isSupportedLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const INVALID_TOKEN_MESSAGE = 'This reset link is no longer usable.';

/**
 * Sets the new password with the single-use token. Order: same origin, rate limit, password policy (400 before ANY commercetools
 * call), reset, confirm the email when it is not confirmed yet (the link proves control, D-031), invalidate every earlier session,
 * clear the caller's own session. The user must log in again.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = rateLimit(clientKey(request, 'reset-password'), RATE_LIMITS.resetPasswordIp);
    if (!ip.ok) return rateLimited(ip.retryAfterSeconds);

    const body = await readAuthBody(request);
    const token = stringField(body, 'token');
    const password = stringField(body, 'password');
    const policy = checkPassword(password);
    if (!policy.ok) return authError(400, 'WEAK_PASSWORD', 'The password does not meet the requirements.', { failed: policy.failed });
    if (token.length === 0) return authError(400, 'INVALID_TOKEN', INVALID_TOKEN_MESSAGE);

    let customer;
    try {
      customer = await resetPassword(token, password);
    } catch (error) {
      if (error instanceof InvalidTokenError) return authError(400, 'INVALID_TOKEN', INVALID_TOKEN_MESSAGE);
      throw error;
    }
    if (!customer.isEmailVerified) {
      try {
        await verifyEmailNow(customer);
      } catch (error) {
        console.error('[auth] email confirmation failed', error instanceof Error ? error.name : 'unknown');
      }
    }
    try {
      await markSessionsInvalid(customer.id);
    } catch (error) {
      // The password is already changed; report the failure without values and let the reset succeed.
      console.error('[auth] sessions could not be invalidated', error instanceof Error ? error.name : 'unknown');
    }

    const locale = isSupportedLocale(body.locale) ? body.locale : (await getMarket()).locale;
    const response = json({ ok: true, redirectTo: `/${locale}/login?reset=1` });
    if ((await getSession()).customerId) await updateSession({ customerId: undefined, signedInAt: undefined, cartId: undefined }, response);
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
