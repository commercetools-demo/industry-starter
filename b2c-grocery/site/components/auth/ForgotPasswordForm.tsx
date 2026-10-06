'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Link } from '@/i18n/routing';
import { ApiError, sendJson } from '@/lib/fetcher';
import { emailError, formValue, type FieldError } from './validation';

/** The same confirmation for every email (known or not). In development a link to the stub page is added. */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [error, setError] = useState<FieldError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = formValue(new FormData(event.currentTarget), 'email');
    const problem = emailError(email);
    setError(problem);
    setFormError(null);
    if (problem) return;
    setPending(true);
    try {
      await sendJson('/api/auth/forgot-password', 'POST', { email: email.trim() });
      setSent(true);
    } catch (e) {
      setFormError(e instanceof ApiError && e.message === 'RATE_LIMITED' ? t('errors.rateLimited') : t('errors.generic'));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-(--space-2) text-[14px]">
        <p className="m-0">{t('forgotSent')}</p>
        {process.env.NODE_ENV === 'development' ? <Link href="/account/dev/reset-link">{t('devLink')}</Link> : null}
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-(--space-2)">
      <Input name="email" type="email" autoComplete="email" label={t('email')} error={error ? t(`errors.${error}`) : undefined} />
      {formError ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700">
          {formError}
        </p>
      ) : null}
      <Button type="submit" block disabled={pending}>
        {pending ? t('forgotPending') : t('forgotSubmit')}
      </Button>
    </form>
  );
}
