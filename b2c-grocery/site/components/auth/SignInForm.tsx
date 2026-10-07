'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useAuthMutations } from '@/hooks/useAccount';
import { useRouter } from '@/i18n/routing';
import { safeRedirectPath, withoutLocale } from '@/lib/safe-redirect';
import { apiErrorCode, emailError, formValue, requiredError, type FieldError } from './validation';

type Errors = { email?: FieldError; password?: FieldError };

/** Sign in. A wrong password and an unknown email show the same message (`auth.invalid`). */
export function SignInForm({ redirect }: { redirect?: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { login } = useAuthMutations();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = formValue(data, 'email');
    const password = formValue(data, 'password');
    const next: Errors = {};
    const emailProblem = emailError(email);
    const passwordProblem = requiredError(password);
    if (emailProblem) next.email = emailProblem;
    if (passwordProblem) next.password = passwordProblem;
    setErrors(next);
    setFormError(null);
    if (emailProblem || passwordProblem) return;

    setPending(true);
    try {
      await login(email.trim(), password);
      router.replace(withoutLocale(safeRedirectPath(redirect, locale), locale));
    } catch (e) {
      const code = apiErrorCode(e);
      setFormError(code === 'INVALID_CREDENTIALS' ? t('invalid') : code === 'RATE_LIMITED' ? t('errors.rateLimited') : t('errors.generic'));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-(--space-2)">
      <Input name="email" type="email" autoComplete="email" label={t('email')} error={errors.email && t(`errors.${errors.email}`)} />
      <Input name="password" type="password" autoComplete="current-password" label={t('password')} error={errors.password && t(`errors.${errors.password}`)} />
      {formError ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700">
          {formError}
        </p>
      ) : null}
      <Button type="submit" block disabled={pending}>
        {pending ? t('signInPending') : t('signInSubmit')}
      </Button>
    </form>
  );
}
