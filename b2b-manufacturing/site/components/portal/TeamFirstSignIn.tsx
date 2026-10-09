'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useRouter } from '@/i18n/routing';
import { SendError, sendJson } from '@/lib/fetcher';
import { ROUTES } from '@/lib/site';

/** First sign-in of an invited colleague: replaces the administrator's one-time password with their own (workstream S). */
export function TeamFirstSignIn() {
  const t = useTranslations('portal.team.firstSignIn');
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await sendJson('/api/account/password', 'POST', Object.fromEntries(new FormData(event.currentTarget).entries()));
      router.replace(ROUTES.account);
      router.refresh();
    } catch (e) {
      setError(e instanceof SendError ? e.message : t('failed'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <Field label={t('current')} name="currentPassword" type="password" required autoComplete="current-password" />
      <Field label={t('new')} name="newPassword" type="password" required autoComplete="new-password" />
      {error ? <p className="em" role="alert">{error}</p> : null}
      <div><Button type="submit" disabled={busy}>{t('save')}</Button></div>
    </form>
  );
}
