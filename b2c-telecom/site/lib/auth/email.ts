import { EMAIL_MAX_LENGTH } from '@/lib/config/auth';

/** Trim and lower-case: commercetools compares emails case-insensitively, the lockout key must be stable too. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isPlausibleEmail(raw: string): boolean {
  return raw.length <= EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw);
}
