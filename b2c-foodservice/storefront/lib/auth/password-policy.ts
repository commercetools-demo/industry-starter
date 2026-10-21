import type { RuleId } from '@/lib/types';

/** Rules in display order. Shared by the register form (live feedback) and the register route (authority). */
export const PASSWORD_RULES: readonly RuleId[] = ['min_length', 'letter', 'digit', 'not_email', 'max_length'];

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export interface PasswordCheck { ok: boolean; failed: RuleId[] }

function matchesEmail(password: string, email: string | undefined): boolean {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  const local = value.split('@')[0] ?? '';
  const lower = password.toLowerCase();
  return lower === value || (local.length > 0 && lower === local);
}

/** Pure: no server-only import. An empty email skips the `not_email` rule. */
export function validatePassword(password: string, email?: string): PasswordCheck {
  const failed: RuleId[] = [];
  if (password.length < PASSWORD_MIN) failed.push('min_length');
  if (!/\p{L}/u.test(password)) failed.push('letter');
  if (!/\p{N}/u.test(password)) failed.push('digit');
  if (matchesEmail(password, email)) failed.push('not_email');
  if (password.length > PASSWORD_MAX) failed.push('max_length');
  return { ok: failed.length === 0, failed };
}
