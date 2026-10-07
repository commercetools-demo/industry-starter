import { AuthError } from '@/hooks/useAuthMutations';
import { PASSWORD_RULES, type PasswordRuleId } from '@/lib/config/password';

export type SubmitErrorKey = 'rateLimited' | 'validation.unavailable' | 'validation.generic';

/** The message key (namespace `auth`) for a failure that is not about one field. */
export function submitErrorKey(error: unknown): SubmitErrorKey {
  if (error instanceof AuthError) {
    if (error.code === 'RATE_LIMITED') return 'rateLimited';
    if (error.code === 'NETWORK' || error.status >= 500) return 'validation.unavailable';
  }
  return 'validation.generic';
}

/** The first failed rule the server names in `details.failed`, when it is one we know. */
export function firstFailedRule(error: AuthError): PasswordRuleId | undefined {
  const failed = error.details?.failed;
  if (!Array.isArray(failed)) return undefined;
  return failed.find((rule): rule is PasswordRuleId => (PASSWORD_RULES as readonly unknown[]).includes(rule));
}
