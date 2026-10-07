export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 60_000 },
  register: { limit: 5, windowMs: 60_000 },
  forgotPassword: { limit: 5, windowMs: 60_000 },
  resetPassword: { limit: 5, windowMs: 60_000 },
} as const;
