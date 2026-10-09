import 'server-only';
import { TooManyAttemptsError, type IdentityUser } from '@/lib/ct/identity';
import type { AccountUser } from '@/lib/types';

// Small helpers shared by the Route Handlers under app/api/auth and app/api/account/password.

/** Same text for an unknown email and a wrong password: nothing may tell them apart. */
export const LOGIN_FAILED = 'The email or password is not correct.';
/** Registration refusal; deliberately silent about whether the address already has an account. */
export const REGISTER_REFUSED = 'We could not create an account with those details. If you already have one, sign in instead.';
export const WRONG_CURRENT_PASSWORD = 'Your current password is not correct.';
export const FIELDS_INVALID = 'Check the highlighted fields.';

/** Client address for the attempt buckets: the platform's header first (Netlify), then the proxy chain. Empty when unknown. */
export function clientKeyOf(request: Request): string {
  const direct = request.headers.get('x-nf-client-connection-ip') ?? request.headers.get('x-real-ip');
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
  return (direct ?? forwarded ?? '').trim();
}

/** Parsed JSON object body; anything else (invalid JSON, array, primitive) is an empty object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** The minimal user the browser receives: id, names for initials, and the patient's own email. */
export function toAccountUser(user: IdentityUser): AccountUser {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email };
}

/** 429 with Retry-After. The text is identical for known and unknown accounts. */
export function tooManyAttempts(error: TooManyAttemptsError): Response {
  const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
  return Response.json(
    { error: `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` },
    { status: 429, headers: { 'retry-after': String(error.retryAfterSeconds) } },
  );
}
