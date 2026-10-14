// Turns a LoginOutcome into the session write shared by the form login and the demo login (R-06, R-17a).
import 'server-only';
import { DEFAULT_LOCALE_KEY, LOCALE_COOKIE, isAppLocale, type AppLocale } from '@/i18n/config';
import { applyBusinessContext, applyLocale } from '@/lib/session-core';
import type { LoginOutcome } from './ports';
import { fail, json } from './route-kit';
import { writeSession } from './seam';

export const INVALID_CREDENTIALS = 'Email or password is incorrect.';

export function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function localeOf(request: Request): AppLocale {
  const value = cookieValue(request, LOCALE_COOKIE);
  return isAppLocale(value) ? value : DEFAULT_LOCALE_KEY;
}

/** Writes the session of a successful sign-in in one update; a pending outcome writes the reduced session. */
export async function startSession(outcome: LoginOutcome, request: Request): Promise<Response> {
  if (outcome.kind === 'invalid') return fail(401, INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  if (outcome.kind === 'pending') {
    await writeSession(() => ({ customerId: outcome.customerId, pending: true }));
    return json({ status: 'pending' });
  }
  // One write: the five business unit and store fields together (cartId cleared), then the locale triple.
  const locale = localeOf(request);
  await writeSession(() => applyLocale(applyBusinessContext({ customerId: outcome.customerId }, outcome.context), locale));
  return json({ status: 'ok' });
}
