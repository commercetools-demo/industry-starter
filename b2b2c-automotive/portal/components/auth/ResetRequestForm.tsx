/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { AuthCard, ErrorNote, Field, fieldClass, linkClass, primaryButtonClass } from '@/components/portal/AuthCard';
import { Link, useRouter } from '@/i18n/routing';
import { authApi } from '@/hooks/useAuthApi';

const LOCALE_PREFIX = /^\/[a-z]{2}-[A-Z]{2}(?=\/)/;
const CONTINUE_DELAY_MS = 800;

/**
 * Password reset without enumeration (R-08, demo only behind DEMO_ONSCREEN_RESET; nothing is mailed). The same message and
 * the same continuation appear for every email; the reset step is what fails for an account that does not exist.
 * `enabled` is false when the server flag is off: no form is rendered then.
 */
export function ResetRequestForm({ enabled }: { enabled: boolean }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [continued, setContinued] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const back = (
    <Link href="/sign-in" className={linkClass}>
      {t('links.backToSignIn')}
    </Link>
  );

  if (!enabled) {
    return (
      <AuthCard title={t('reset.title')} links={back}>
        <p role="status" className="text-body-2 font-medium text-text-subdued">
          {t('reset.disabled')}
        </p>
      </AuthCard>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return setError(t('fillAll'));
    setError('');
    setBusy(true);
    const result = await authApi.requestReset(email.trim());
    if (result.ok && result.data) {
      setContinued(true);
      const path = result.data.resetPath.replace(LOCALE_PREFIX, '');
      timer.current = setTimeout(() => router.push(path), CONTINUE_DELAY_MS);
      return;
    }
    setBusy(false);
    setError(result.status === 404 ? t('reset.disabled') : t('generic'));
  }

  return (
    <AuthCard title={t('reset.title')} subtitle={t('reset.subtitle')} links={back}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-400">
        <Field id="email" label={t('email')}>
          <input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </Field>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {continued ? (
          <p role="status" className="rounded-300 bg-bg-info-subdued px-300 py-250 text-body-2 font-semibold">
            {t('reset.requested')}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? t('reset.submitting') : t('reset.submit')}
        </button>
      </form>
    </AuthCard>
  );
}
