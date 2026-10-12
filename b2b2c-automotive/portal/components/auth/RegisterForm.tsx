'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AuthCard, ErrorNote, Field, fieldClass, linkClass, primaryButtonClass } from '@/components/portal/AuthCard';
import { Link } from '@/i18n/routing';
import { authApi } from '@/hooks/useAuthApi';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 12;

/**
 * Company registration (R-07). The account is created pending: no session starts, the user sees
 * "Account created. Awaiting Malva approval of your business." and signs in later to reach the status page.
 */
export function RegisterForm() {
  const t = useTranslations('auth');
  const [values, setValues] = useState({ companyName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const company = values.companyName.trim();
    if (!company || !values.name.trim() || !values.email.trim() || !values.password) return setError(t('fillAll'));
    if (company.length < 2 || company.length > 80) return setError(t('register.companyInvalid'));
    if (!EMAIL.test(values.email.trim())) return setError(t('register.emailInvalid'));
    if (values.password.length < PASSWORD_MIN) return setError(t('register.passwordShort'));
    setError('');
    setBusy(true);
    const result = await authApi.register({ ...values, companyName: company, name: values.name.trim(), email: values.email.trim() });
    setBusy(false);
    if (result.ok) setCreated(true);
    else setError(result.status === 400 ? t('register.failed') : t('generic'));
  }

  const back = (
    <Link href="/sign-in" className={linkClass}>
      {t('links.backToSignIn')}
    </Link>
  );

  if (created) {
    return (
      <AuthCard title={t('register.title')} links={back}>
        <p role="status" className="rounded-300 bg-bg-success-subdued px-300 py-250 text-body-2 font-semibold">
          {t('register.created')}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('register.title')} subtitle={t('register.subtitle')} links={back}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-400">
        <Field id="company" label={t('register.company')}>
          <input id="company" name="company" autoComplete="organization" value={values.companyName} onChange={set('companyName')} className={fieldClass} />
        </Field>
        <Field id="name" label={t('register.name')}>
          <input id="name" name="name" autoComplete="name" value={values.name} onChange={set('name')} className={fieldClass} />
        </Field>
        <Field id="email" label={t('register.email')}>
          <input id="email" name="email" type="email" autoComplete="email" value={values.email} onChange={set('email')} className={fieldClass} />
        </Field>
        <Field id="password" label={t('password')} hint={t('register.passwordRule')}>
          <input id="password" name="password" type="password" autoComplete="new-password" value={values.password} onChange={set('password')} className={fieldClass} />
        </Field>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? t('register.submitting') : t('register.submit')}
        </button>
      </form>
    </AuthCard>
  );
}
