'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { Link, useRouter } from '@/i18n/routing';
import { SendError, sendJson } from '@/lib/fetcher';
import { ROUTES } from '@/lib/site';
import { SECTORS, type FieldErrors } from '@/lib/validation';
import { useAuthActions } from './useAuthActions';

export function RegisterForm() {
  const t = useTranslations('auth.register');
  const router = useRouter();
  const { refreshAll } = useAuthActions();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true); setErrors({}); setMessage('');
    try {
      await sendJson('/api/auth/register', 'POST', { ...body, startedAt: startedAt.current });
      await refreshAll();
      router.push(ROUTES.account);
    } catch (e) {
      if (e instanceof SendError) { setErrors((e.data.fieldErrors as FieldErrors | undefined) ?? {}); setMessage(e.message); }
      else setMessage(t('genericError'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 16 }}>
      <LiveRegion assertive>{message}</LiveRegion>
      {message ? <p className="alert" role="presentation">{message}</p> : null}
      {/* Honeypot: invisible to people and to assistive technology; a filled value marks a script. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <Field label={t('company')} name="companyName" autoComplete="organization" required error={errors.companyName} />
      <Field label={t('sector')} name="sector" as="select" required error={errors.sector} defaultValue="">
        <option value="" disabled>{t('sectorPlaceholder')}</option>
        {SECTORS.map((s) => <option key={s} value={s}>{t(`sectors.${s}`)}</option>)}
      </Field>
      <div className="grid g2" style={{ gap: 16 }}>
        <Field label={t('firstName')} name="firstName" autoComplete="given-name" required error={errors.firstName} />
        <Field label={t('lastName')} name="lastName" autoComplete="family-name" required error={errors.lastName} />
        <Field label={t('jobTitle')} name="jobTitle" autoComplete="organization-title" error={errors.jobTitle} />
        <Field label={t('phone')} name="phone" type="tel" autoComplete="tel" error={errors.phone} />
      </div>
      <Field label={t('email')} name="email" type="email" autoComplete="email" required error={errors.email} />
      <Field label={t('password')} name="password" type="password" autoComplete="new-password" required hint={t('passwordHint')} error={errors.password} />
      <Button type="submit" disabled={busy}>{busy ? t('submitting') : t('submit')}</Button>
      <p style={{ fontSize: 14 }}><Link href={ROUTES.privacy}>{t('privacy')}</Link></p>
      <p style={{ fontSize: 14 }}>{t('haveAccount')} <Link href={ROUTES.signIn}>{t('signIn')}</Link></p>
    </form>
  );
}
