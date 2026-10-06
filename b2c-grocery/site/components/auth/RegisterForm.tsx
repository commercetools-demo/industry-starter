'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useAuthMutations } from '@/hooks/useAccount';
import { Link, useRouter } from '@/i18n/routing';
import { safeRedirectPath, withoutLocale } from '@/lib/safe-redirect';
import { apiErrorCode, emailError, formValue, newPasswordError, requiredError, type FieldError } from './validation';

type Errors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password', FieldError>>;

/** Register, then land on the account page (or the `redirect` target). No email is sent; the customer is verified server-side. */
export function RegisterForm({ redirect }: { redirect?: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { register } = useAuthMutations();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<'exists' | 'rateLimited' | 'generic' | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      firstName: formValue(data, 'firstName'),
      lastName: formValue(data, 'lastName'),
      email: formValue(data, 'email'),
      password: formValue(data, 'password'),
    };
    const next: Errors = {};
    const problems: [keyof Errors, FieldError | null][] = [
      ['firstName', requiredError(values.firstName)],
      ['lastName', requiredError(values.lastName)],
      ['email', emailError(values.email)],
      ['password', newPasswordError(values.password)],
    ];
    for (const [field, problem] of problems) if (problem) next[field] = problem;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      await register({ ...values, firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim() });
      router.replace(withoutLocale(safeRedirectPath(redirect, locale), locale));
    } catch (e) {
      const code = apiErrorCode(e);
      setFormError(code === 'ACCOUNT_EXISTS' ? 'exists' : code === 'RATE_LIMITED' ? 'rateLimited' : 'generic');
      setPending(false);
    }
  }

  const err = (field: keyof Errors) => (errors[field] ? t(`errors.${errors[field]}`) : undefined);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-(--space-2)">
      <Input name="firstName" autoComplete="given-name" label={t('firstName')} error={err('firstName')} />
      <Input name="lastName" autoComplete="family-name" label={t('lastName')} error={err('lastName')} />
      <Input name="email" type="email" autoComplete="email" label={t('email')} error={err('email')} />
      <Input name="password" type="password" autoComplete="new-password" label={t('passwordNew')} placeholder={t('passwordHint')} error={err('password')} />
      {formError ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700">
          {formError === 'exists' ? (
            <>
              {t('exists')} <Link href="/account/sign-in">{t('signInInstead')}</Link>
            </>
          ) : formError === 'rateLimited' ? (
            t('errors.rateLimited')
          ) : (
            t('errors.generic')
          )}
        </p>
      ) : null}
      <Button type="submit" block disabled={pending}>
        {pending ? t('registerPending') : t('registerSubmit')}
      </Button>
    </form>
  );
}
