import { authFailure, padResponse, rateLimited, readAuthBody, stringField } from '@/lib/auth/api';
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email';
import { assertSameOrigin } from '@/lib/auth/origin';
import { rateLimit } from '@/lib/auth/rate-limit';
import { RATE_LIMITS } from '@/lib/config/auth';
import { createPasswordResetToken } from '@/lib/ct/customer';
import { json } from '@/lib/ct/http';
import { getMarket } from '@/lib/market/server';
import { clientKey } from '@/lib/rate-limit';
import { isSupportedLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Prepares a reset token. The answer never depends on whether the account exists: always `200 { ok: true }`, padded to a minimum time,
 * every commercetools failure swallowed (the 404 of an unknown email included). Only with DEMO_SHOW_RESET_LINK=true and an existing
 * account the answer also carries `demoLink` (D-033: no email is sent). The token is never logged.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    assertSameOrigin(request);
    const ip = rateLimit(clientKey(request, 'forgot-password'), RATE_LIMITS.forgotPasswordIp);
    if (!ip.ok) return rateLimited(ip.retryAfterSeconds);

    const body = await readAuthBody(request);
    const email = normalizeEmail(stringField(body, 'email'));
    const locale = isSupportedLocale(body.locale) ? body.locale : (await getMarket()).locale;

    let demoLink: string | undefined;
    // Over the per-email limit: still the generic answer, but no token is created.
    if (isPlausibleEmail(email) && rateLimit(`forgot-password:email:${email}`, RATE_LIMITS.forgotPasswordEmail).ok) {
      try {
        const token = await createPasswordResetToken(email);
        if (token && process.env.DEMO_SHOW_RESET_LINK === 'true') demoLink = `/${locale}/reset-password?token=${encodeURIComponent(token.value)}`;
      } catch (error) {
        console.error('[auth] reset token unavailable', error instanceof Error ? error.name : 'unknown');
      }
    }
    await padResponse(startedAt);
    return json(demoLink ? { ok: true, demoLink } : { ok: true });
  } catch (error) {
    return authFailure(error);
  }
}
