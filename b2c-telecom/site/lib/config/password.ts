// The only definition of the password policy. Imported by the strength indicator, the register/reset forms and the server routes.

export const PASSWORD_POLICY = { minLength: 10, maxLength: 128 } as const;

/** The local part of the email address is compared only when it has at least this many characters. */
export const NOT_EMAIL_MIN_LOCAL_PART = 4;

export type PasswordRuleId = 'min-length' | 'max-length' | 'lowercase' | 'uppercase' | 'digit' | 'not-email';

/** Stable order: the order the rules are listed and reported. */
export const PASSWORD_RULES: readonly PasswordRuleId[] = ['min-length', 'max-length', 'lowercase', 'uppercase', 'digit', 'not-email'];

export interface PasswordCheck {
  ok: boolean;
  failed: PasswordRuleId[];
  passed: PasswordRuleId[];
}

function localPart(email: string | undefined): string {
  const at = email === undefined ? -1 : email.indexOf('@');
  return email !== undefined && at > 0 ? email.slice(0, at).trim().toLowerCase() : '';
}

/** Never trims the password. `ctx.email` enables the "not-email" rule. */
export function checkPassword(password: string, ctx?: { email?: string }): PasswordCheck {
  const local = localPart(ctx?.email);
  const results: Record<PasswordRuleId, boolean> = {
    'min-length': password.length >= PASSWORD_POLICY.minLength,
    'max-length': password.length <= PASSWORD_POLICY.maxLength,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    'not-email': !(local.length >= NOT_EMAIL_MIN_LOCAL_PART && password.toLowerCase().includes(local)),
  };
  const failed = PASSWORD_RULES.filter((rule) => !results[rule]);
  const passed = PASSWORD_RULES.filter((rule) => results[rule]);
  return { ok: failed.length === 0, failed, passed };
}
