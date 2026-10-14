/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AuthCard, ErrorNote, Field, fieldClass, linkClass, primaryButtonClass } from '@/components/portal/AuthCard';
import { Link } from '@/i18n/routing';
import { authApi } from '@/hooks/useAuthApi';

const PASSWORD_MIN = 12;

type Check = 'enter' | 'short' | 'mismatch' | 'good';
export function passwordCheck(password: string, confirm: string): Check {
  if (!password) return 'enter';
  if (password.length < PASSWORD_MIN) return 'short';
  if (password !== confirm) return 'mismatch';
  return 'good';
}

/** Second step of the on-screen reset: two password fields with the live check of the account page ("Looks good"). */
export function ResetPasswordForm({ token, enabled }: { token: string; enabled: boolean }) {
  const t = useTranslations('auth');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const check = passwordCheck(password, confirm);

  const links = (
    <Link href="/sign-in" className={linkClass}>
      {t('links.backToSignIn')}
    </Link>
  );

  if (!enabled) {
    return (
      <AuthCard title={t('reset.newTitle')} links={links}>
        <p role="status" className="text-body-2 font-medium text-text-subdued">
          {t('reset.disabled')}
        </p>
      </AuthCard>
    );
  }
  if (done) {
    return (
      <AuthCard title={t('reset.newTitle')} links={links}>
        <p role="status" className="rounded-300 bg-bg-success-subdued px-300 py-250 text-body-2 font-semibold">
          {t('reset.success')}
        </p>
      </AuthCard>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (check !== 'good') return;
    setError('');
    setBusy(true);
    const result = await authApi.reset(token, password);
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.status === 400 || result.status === 404 ? t('reset.invalidToken') : t('generic'));
  }

  return (
    <AuthCard title={t('reset.newTitle')} subtitle={t('reset.newSubtitle')} links={links}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-400">
        <Field id="new-password" label={t('reset.newPassword')}>
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
        </Field>
        <Field id="confirm-password" label={t('reset.confirmPassword')}>
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass} />
        </Field>
        <p role="status" aria-live="polite" className={`text-caption-1 font-semibold ${check === 'good' ? 'text-text-success' : 'text-text-subdued'}`}>
          {t(`reset.${check}`)}
        </p>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <button type="submit" disabled={busy || check !== 'good'} className={primaryButtonClass}>
          {busy ? t('reset.saving') : t('reset.save')}
        </button>
      </form>
    </AuthCard>
  );
}
