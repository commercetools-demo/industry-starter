'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Link, useRouter } from '@/i18n/routing';
import { AuthError, useAuthMutations } from '@/hooks/useAuthMutations';
import { stripLocalePrefix, withReturnTo } from '@/lib/auth/return-target';
import type { DemoLoginCustomer } from '@/lib/config/demo-login';
import { AUTH_LINK } from './AuthCard';
import { submitErrorKey } from './errors';
import { PasswordField } from './PasswordField';
import { useAuthForm } from './useAuthForm';

const FIELDS = ['email', 'password'] as const;
const ERROR_ID = 'login-error';

/**
 * Email + password. Every failure shows the same sentence in one alert region (never says which part was wrong). The fields start
 * empty: nothing is prefilled. `returnTo` is a server-validated hint; the server validates it again and answers `redirectTo`.
 */
export function LoginForm({
  returnTo,
  resetDone = false,
  demoCustomers = [],
}: {
  returnTo?: string | undefined;
  resetDone?: boolean;
  /** Demo sign-in: sample customers for the dropdown below the form. Empty = no dropdown. */
  demoCustomers?: readonly DemoLoginCustomer[];
}): ReactElement {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { login, demoLogin } = useAuthMutations();
  const [demoEmail, setDemoEmail] = useState(demoCustomers[0]?.email ?? '');
  const form = useAuthForm(FIELDS);
  const { values, formError, pending } = form;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    form.setFormError(null);
    const email = values.email.trim();
    const password = values.password;
    if (email === '' || password === '') {
      form.setFormError(t('login.error'));
      document.getElementById(form.idOf(email === '' ? 'email' : 'password'))?.focus();
      return;
    }
    form.setPending(true);
    try {
      const result = await login({ email, password, returnTo, locale });
      router.replace(stripLocalePrefix(result.redirectTo));
      router.refresh();
    } catch (error) {
      form.setFormError(error instanceof AuthError && error.code === 'INVALID_CREDENTIALS' ? t('login.error') : t(submitErrorKey(error)));
      form.setPending(false);
    }
  }

  async function onDemoLogin(): Promise<void> {
    if (pending || demoEmail === '') return;
    form.setFormError(null);
    form.setPending(true);
    try {
      const result = await demoLogin({ email: demoEmail, returnTo, locale });
      router.replace(stripLocalePrefix(result.redirectTo));
      router.refresh();
    } catch (error) {
      form.setFormError(t(submitErrorKey(error)));
      form.setPending(false);
    }
  }

  const invalid = formError ? { 'aria-invalid': true as const, 'aria-describedby': ERROR_ID } : {};

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {resetDone ? (
        <p role="status" className="m-0 rounded-lg bg-surface-brand-subtle px-5 py-3 text-sm text-text">
          {t('login.resetDone')}
        </p>
      ) : null}
      <Field label={t('field.email')} htmlFor={form.idOf('email')}>
        <Input {...invalid} id={form.idOf('email')} name="email" type="email" inputMode="email" autoComplete="username" value={values.email} onChange={form.onChange('email')} />
      </Field>
      <div className="flex flex-col gap-3">
        <PasswordField {...invalid} id={form.idOf('password')} name="password" label={t('field.password')} autoComplete="current-password" value={values.password} onChange={form.onChange('password')} />
        <p id={ERROR_ID} role="alert" aria-live="assertive" className="m-0 min-h-5 text-sm text-danger">
          {formError}
        </p>
      </div>
      <Button type="submit" block loading={pending}>
        {pending ? t('login.pending') : t('login.submit')}
      </Button>
      <div className="flex flex-col gap-3">
        <Link href={withReturnTo('/forgot-password', returnTo)} className={AUTH_LINK}>
          {t('login.forgot')}
        </Link>
        <Link href={withReturnTo('/register', returnTo)} className={AUTH_LINK}>
          {t('login.create')}
        </Link>
      </div>
      </form>
      {demoCustomers.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4 border-t border-neutral-400 pt-8">
          <Field label={t('login.demo.label')}>
            <Select name="demo-customer" value={demoEmail} onChange={(event) => setDemoEmail(event.target.value)}>
              {demoCustomers.map((customer) => (
                <option key={customer.email} value={customer.email}>
                  {customer.name} ({customer.group})
                </option>
              ))}
            </Select>
          </Field>
          <Button type="button" variant="secondary" block loading={pending} onClick={() => void onDemoLogin()}>
            {t('login.demo.submit')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
