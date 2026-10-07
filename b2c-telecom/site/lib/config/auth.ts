// Constants of the sign-in, registration and password reset flows (workstream R). Never inline these numbers.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** In-memory, per server instance (best effort on serverless). Planner defaults. */
export const RATE_LIMITS = {
  loginIp: { limit: 20, windowMs: 15 * MINUTE_MS },
  registerIp: { limit: 5, windowMs: HOUR_MS },
  forgotPasswordIp: { limit: 5, windowMs: HOUR_MS },
  forgotPasswordEmail: { limit: 3, windowMs: HOUR_MS },
  resetPasswordIp: { limit: 10, windowMs: HOUR_MS },
} as const;

/** Per normalized email: this many consecutive failures lock the email for the lock window. */
export const LOGIN_LOCKOUT = { maxFailures: 5, windowMs: 15 * MINUTE_MS } as const;

export const TOKEN_TTL_MINUTES = { reset: 60, email: 5 } as const;

/** A failed login or a reset request takes at least this long before it answers (hides timing differences). */
export const MIN_RESPONSE_MS = 400;

export const CUSTOMER_GROUP_KEY = 'consumer';

/** Largest accepted request body of an auth route, in bytes. */
export const MAX_BODY_BYTES = 4096;

export const NAME_MAX_LENGTH = 60;
export const EMAIL_MAX_LENGTH = 254;
export const CUSTOMER_NUMBER_ATTEMPTS = 3;

/** First path segments (after the locale) a sign-in may return to. */
export const RETURN_SEGMENTS = ['account', 'bundle', 'shop', 'search', 'support'] as const;
