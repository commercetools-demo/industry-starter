// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Environment of the hosted Checkout (workstream O). No `server-only` (pure, testable); no value is put in an error message.
type Env = Record<string, string | undefined>;

const APP_KEY = /^[A-Za-z0-9_-]{2,256}$/;

export interface CheckoutEnv {
  /** Key of the Checkout Application (OA-05). `undefined` while the owner has not created it; required in production. */
  applicationKey: string | undefined;
  /** The dev-only completion helper (O-08) is on. Never true in production. */
  devComplete: boolean;
}

const isTrue = (value: string | undefined) => value?.trim().toLowerCase() === 'true';

export function checkoutEnv(env: Env = process.env): CheckoutEnv {
  const production = env.NODE_ENV === 'production';
  const raw = env.CTP_CHECKOUT_APP_KEY?.trim();
  if (raw !== undefined && raw !== '' && !APP_KEY.test(raw)) throw new Error('CTP_CHECKOUT_APP_KEY has an invalid format');
  if (production && !raw) throw new Error('Missing environment variable CTP_CHECKOUT_APP_KEY');
  if (production && isTrue(env.CHECKOUT_DEV_COMPLETE)) throw new Error('CHECKOUT_DEV_COMPLETE must not be set in production');
  return { applicationKey: raw || undefined, devComplete: !production && isTrue(env.CHECKOUT_DEV_COMPLETE) };
}

export interface CheckoutDevHosts {
  /** Base of a local stand-in for the Sessions API (the URL gets `/{projectKey}/sessions` appended). */
  sessionsUrl: string;
  /** Base of a local stand-in for the hosted Checkout app; the SDK accepts a URL where it expects a region. */
  appUrl: string;
}

/**
 * DEV ONLY: lets a developer point the Sessions API and the hosted app at a local stand-in (a rehearsal without Stripe). Both variables must
 * be http(s) URLs; in production the answer is always `null`, whatever is set.
 */
export function checkoutDevHosts(env: Env = process.env): CheckoutDevHosts | null {
  if (env.NODE_ENV === 'production') return null;
  const clean = (value: string | undefined) => {
    try {
      const url = new URL(value?.trim() ?? '');
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin + url.pathname.replace(/\/+$/, '') : null;
    } catch {
      return null;
    }
  };
  const sessionsUrl = clean(env.CHECKOUT_DEV_SESSIONS_URL);
  const appUrl = clean(env.CHECKOUT_DEV_APP_URL);
  return sessionsUrl && appUrl ? { sessionsUrl, appUrl } : null;
}

/** Same as `checkoutEnv` but never throws: for pages that must render a message instead of failing (a production misconfiguration reads as "not configured"). */
export function checkoutEnvSafe(env: Env = process.env): CheckoutEnv {
  try {
    return checkoutEnv(env);
  } catch {
    return { applicationKey: undefined, devComplete: false };
  }
}
