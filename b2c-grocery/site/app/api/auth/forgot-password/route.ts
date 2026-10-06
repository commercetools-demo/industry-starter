import { NextResponse } from 'next/server';
import { blockedByRateLimit } from '@/lib/auth-api';
import { readJson } from '@/lib/cart-api';
import { createPasswordResetToken } from '@/lib/ct/auth';
import { isDevStubEnabled, setLastResetLink } from '@/lib/dev-stub';
import { getMarket } from '@/lib/session';

/**
 * Always `{ ok: true }`: the answer never depends on whether the email exists or whether commercetools failed.
 * In development the reset link is stored for the stub page; in production nothing is stored or logged (D-038).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const blocked = blockedByRateLimit(request, 'forgot');
  if (blocked) return blocked;

  const { email } = await readJson(request);
  if (typeof email === 'string' && email.trim()) {
    try {
      const token = await createPasswordResetToken(email.trim());
      if (token && isDevStubEnabled()) {
        const { locale } = await getMarket();
        setLastResetLink(email.trim(), `${new URL(request.url).origin}/${locale}/account/reset-password?token=${encodeURIComponent(token)}`);
      }
    } catch {
      // Swallowed on purpose: a different response would reveal state. The message is not logged because it can contain the email.
    }
  }
  return NextResponse.json({ ok: true });
}
