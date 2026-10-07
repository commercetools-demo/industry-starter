'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { CheckIcon } from '@/components/ui/Icon';
import { checkPassword, type PasswordRuleId } from '@/lib/config/password';

/** The five requirements always listed; `max-length` is listed only when it fails. */
const LISTED: readonly PasswordRuleId[] = ['min-length', 'lowercase', 'uppercase', 'digit', 'not-email'];

/**
 * The password rules as a list with a live summary ("3 of 5 requirements met"). Uses the one policy of `lib/config/password.ts`, the
 * same module the server routes use. An empty password counts as nothing met.
 */
export function PasswordStrength({ password, email, id }: { password: string; email?: string; id?: string }): ReactElement {
  const t = useTranslations('auth.password');
  const check = checkPassword(password, email ? { email } : undefined);
  const met = (rule: PasswordRuleId): boolean => password.length > 0 && check.passed.includes(rule);
  const rules = check.failed.includes('max-length') ? [...LISTED, 'max-length' as const] : LISTED;
  const total = LISTED.length;
  const count = LISTED.filter(met).length;
  return (
    <div id={id} className="flex flex-col gap-3">
      <p aria-live="polite" className="m-0 text-sm text-text-muted">
        {t('summary', { met: count, total })}
      </p>
      <ul aria-label={t('requirements')} className="m-0 flex list-none flex-col gap-2 p-0">
        {rules.map((rule) => {
          const ok = met(rule);
          return (
            <li key={rule} data-met={ok} className={`flex items-center gap-3 text-sm ${ok ? 'text-text' : 'text-text-muted'}`}>
              {ok ? <CheckIcon className="text-action" /> : <span aria-hidden="true" className="inline-block size-1 rounded-pill bg-neutral-400" />}
              <span>{t(`rule.${rule}`)}</span>
              <span className="sr-only">{ok ? t('met') : t('notMet')}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
