'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { AuthCard, ErrorNote, Field, fieldClass, linkClass, primaryButtonClass } from '@/components/portal/AuthCard';
import { Link } from '@/i18n/routing';
import { useHardNavigate } from '@/hooks/useHardNavigate';
import { authApi } from '@/hooks/useAuthApi';
import { safeNextPath } from '@/lib/portal/flags';

/**
 * Email and password sign-in. Empty fields never leave the browser; wrong credentials give one message whether or not
 * the email exists. `demo` is the demo account picker, rendered by the server only when demo login is enabled.
 */
export function SignInForm({ next, resetEnabled, demo }: { next?: string; resetEnabled: boolean; demo?: ReactNode }) {
  const t = useTranslations('auth');
  const go = useHardNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError(t('fillAll'));
      return;
    }
    setError('');
    setBusy(true);
    const result = await authApi.signIn(email.trim(), password);
    if (result.ok && result.data?.status === 'pending') go('/pending-approval');
    else if (result.ok) {
      go(safeNextPath(next) ?? '/');
      return;
    } else setError(result.status === 401 ? t('invalid') : result.status === 400 ? t('fillAll') : t('generic'));
    setBusy(false);
  }

  return (
    <AuthCard
      title={t('signIn.title')}
      subtitle={t('signIn.subtitle')}
      links={
        <>
          <Link href="/register" className={linkClass}>
            {t('links.createAccount')}
          </Link>
          {resetEnabled ? (
            <Link href="/reset" className={linkClass}>
              {t('links.forgot')}
            </Link>
          ) : null}
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-400">
        <Field id="email" label={t('email')}>
          <input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </Field>
        <Field id="password" label={t('password')}>
          <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
        </Field>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? t('signIn.submitting') : t('signIn.submit')}
        </button>
      </form>
      {demo}
    </AuthCard>
  );
}
