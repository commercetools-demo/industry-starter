/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AuthCard, ErrorNote, Field, fieldClass, linkClass, primaryButtonClass } from '@/components/portal/AuthCard';
import { acceptInviteApi } from '@/hooks/accountApi';
import { Link } from '@/i18n/routing';
import { checkPassword } from '@/lib/account/password-check';

/**
 * Accept an invitation (workstream U-09, decision 16): the invitee sets a password with the one-time token the Admin handed over.
 * Invalid and expired tokens show the same message. Nothing is signed in here; the next step is the sign-in page.
 */
export function AcceptInviteForm({ token }: { token: string }) {
  const t = useTranslations('acceptInvite');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const state = checkPassword(password, confirm);

  const links = (
    <Link href="/sign-in" className={linkClass}>
      {t('toSignIn')}
    </Link>
  );

  if (done) {
    return (
      <AuthCard title={t('title')} links={links}>
        <p role="status" className="rounded-300 bg-bg-success-subdued px-300 py-250 text-body-2 font-semibold">
          {t('success')}
        </p>
      </AuthCard>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state !== 'ok') return;
    setError('');
    setBusy(true);
    const result = await acceptInviteApi(token, password);
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.status === 400 || result.status === 404 ? t('invalid') : t('generic'));
  }

  return (
    <AuthCard title={t('title')} subtitle={t('subtitle')} links={links}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-400">
        <Field id="invite-password" label={t('password')}>
          <input id="invite-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
        </Field>
        <Field id="invite-confirm" label={t('confirm')}>
          <input id="invite-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass} />
        </Field>
        <p role="status" aria-live="polite" className={`text-caption-1 font-semibold ${state === 'ok' ? 'text-text-success' : 'text-text-subdued'}`}>
          {t(`state.${state}`)}
        </p>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <button type="submit" disabled={busy || state !== 'ok'} className={primaryButtonClass}>
          {busy ? t('saving') : t('submit')}
        </button>
      </form>
    </AuthCard>
  );
}
