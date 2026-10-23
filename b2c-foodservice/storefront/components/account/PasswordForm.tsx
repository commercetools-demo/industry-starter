'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import PasswordField from '@/components/auth/PasswordField';
import PasswordStrength from '@/components/auth/PasswordStrength';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useToast } from '@/context/toast';
import { ApiError } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { useProfile } from '@/hooks/useProfile';
import type { RuleId } from '@/lib/types';

/** Change password: the policy is shown live, the server decides. A wrong current password gets its own message. */
export default function PasswordForm() {
  const t = useTranslations('account.password');
  const toast = useToast();
  const { customer } = useAccount();
  const { changePassword } = useProfile();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<{ field: 'current' | 'new' | 'form'; text: string } | null>(null);
  const [failedRules, setFailedRules] = useState<RuleId[]>([]);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    setFailedRules([]);
    if (!current) return setError({ field: 'current', text: t('required') });
    setPending(true);
    try {
      await changePassword(current, next);
      toast.show(t('changed'));
      setCurrent('');
      setNext('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'current_password_invalid') setError({ field: 'current', text: t('wrongCurrent') });
      else if (e instanceof ApiError && e.code === 'password_policy') {
        setFailedRules(Array.isArray(e.extra.failed) ? (e.extra.failed as RuleId[]) : []);
        setError({ field: 'new', text: t('policy') });
      } else if (e instanceof ApiError && (e.code === 'rate_limited' || e.status === 429)) setError({ field: 'form', text: t('rateLimited') });
      else setError({ field: 'form', text: t('failed') });
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="password-heading" className="mt-8">
      <h2 id="password-heading" className="m-0 mb-[18px] font-display text-[22px] font-bold text-ink">
        {t('title')}
      </h2>
      <Card>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <PasswordField
            id="password-current"
            label={t('current')}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            error={error?.field === 'current' ? error.text : undefined}
          />
          <PasswordField
            id="password-new"
            label={t('new')}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            describedBy="password-new-rules"
            error={error?.field === 'new' ? error.text : undefined}
          />
          <PasswordStrength id="password-new-rules" password={next} email={customer?.email} serverFailed={failedRules} />
          {error?.field === 'form' ? (
            <p role="alert" className="mb-4 mt-0 text-[13.5px] font-medium text-danger-text">
              {error.text}
            </p>
          ) : null}
          <Button type="submit" loading={pending}>
            {t('submit')}
          </Button>
        </form>
      </Card>
    </section>
  );
}
