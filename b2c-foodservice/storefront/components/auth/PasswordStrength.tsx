'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { validatePassword } from '@/lib/auth/password-policy';
import { cn } from '@/lib/cn';
import type { RuleId } from '@/lib/types';

const SHOWN: readonly RuleId[] = ['min_length', 'letter', 'digit', 'not_email'];

interface PasswordStrengthProps {
  id: string;
  password: string;
  email?: string;
  /** Rule ids the server refused; shown as unmet even if the client check disagrees. */
  serverFailed?: readonly RuleId[];
}

/** Each rule as icon plus text (never colour alone). The live region announces only the count met. */
export default function PasswordStrength({ id, password, email, serverFailed = [] }: PasswordStrengthProps) {
  const t = useTranslations('auth.password');
  const { failed } = validatePassword(password, email);
  const unmet = new Set<RuleId>([...failed, ...serverFailed]);
  const rules: RuleId[] = unmet.has('max_length') ? [...SHOWN, 'max_length'] : [...SHOWN];
  const isMet = (rule: RuleId) => password !== '' && !unmet.has(rule);
  const met = rules.filter(isMet).length;
  return (
    <div id={id} className="-mt-1 mb-4">
      <ul aria-label={t('rulesLabel')} className="m-0 list-none p-0">
        {rules.map((rule) => (
          <li
            key={rule}
            data-met={isMet(rule)}
            className={cn('flex items-center gap-2 py-0.5 text-[12.5px]', isMet(rule) ? 'text-teal-text' : 'text-ink-3')}
          >
            <Icon name={isMet(rule) ? 'check' : 'x'} size={14} />
            <span>{t(`rules.${rule}`)}</span>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="mb-0 mt-1.5 text-[12.5px] text-ink-3">
        {t('rulesMet', { met, total: rules.length })}
      </p>
    </div>
  );
}
