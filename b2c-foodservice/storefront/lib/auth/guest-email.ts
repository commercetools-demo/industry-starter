import 'server-only';
import { cookies } from 'next/headers';
import { isEmailShape } from '@/lib/auth/email-shape';

/** HTTP-only cookie the checkout (workstream K) sets after a guest order, so the register form can pre-fill the email. */
export const GUEST_EMAIL_COOKIE = 'mcf_guest_email';

/** The prefill email, or '' when there is none or it does not look like an address. Never read from the URL. */
export async function readGuestEmail(): Promise<string> {
  const value = (await cookies()).get(GUEST_EMAIL_COOKIE)?.value?.trim() ?? '';
  return isEmailShape(value) ? value : '';
}
