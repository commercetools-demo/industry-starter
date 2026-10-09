'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { Link, useRouter } from '@/i18n/routing';
import { sendJson } from '@/lib/fetcher';
import { ROUTES } from '@/lib/site';
import { safeNextPath } from '@/lib/validation';
import { DemoLogin } from './DemoLogin';
import { useAuthActions } from './useAuthActions';

/** Email and password. No password-reset link exists by decision (Q-023). `next` is validated to a same-site path. */
export function SignInForm({ next, onDone, autoFocus }: { next?: string | null; onDone?: () => void; autoFocus?: boolean }) {
  const t = useTranslations('auth.signIn');
  const router = useRouter();
  const { refreshAll } = useAuthActions();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!email || !password) { setError(t('enterBoth')); return; }
    setBusy(true); setError('');
    try {
      await sendJson('/api/auth/login', 'POST', { email, password });
      await refreshAll();
      onDone?.();
      router.push(safeNextPath(next, ROUTES.account));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('genericError'));
      setBusy(false);
    }
  }

  return (
    <>
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 16 }}>
      <Field label={t('email')} name="email" type="email" autoComplete="email" required {...(autoFocus ? { 'data-autofocus': true } : {})} />
      <Field label={t('password')} name="password" type="password" autoComplete="current-password" required error={error || undefined} />
      <LiveRegion assertive>{error}</LiveRegion>
      <Button type="submit" disabled={busy}>{busy ? t('submitting') : t('submit')}</Button>
      <p style={{ fontSize: 14 }}>{t('noAccount')} <Link href={ROUTES.register} onClick={onDone}>{t('register')}</Link></p>
      <p style={{ fontSize: 14 }}>{t('justQuote')} <Link href={ROUTES.quote} onClick={onDone}>{t('requestQuote')}</Link></p>
    </form>
    <DemoLogin next={next} onDone={onDone} />
    </>
  );
}
