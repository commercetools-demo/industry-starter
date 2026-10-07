'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Link } from '@/i18n/routing';
import { useAuthMutations } from '@/hooks/useAuthMutations';
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email';
import { stripLocalePrefix, withReturnTo } from '@/lib/auth/return-target';
import { AUTH_LINK } from './AuthCard';
import { submitErrorKey } from './errors';
import { useAuthForm } from './useAuthForm';

const FIELDS = ['email'] as const;

/**
 * Asks for a reset link. The confirmation is the same for every address; the demo banner and link appear only when the server
 * returns `demoLink` (D-033: no email is sent, DEMO_SHOW_RESET_LINK=true). Also used inline on the "link no longer usable" state.
 */
export function ForgotPasswordForm({ returnTo, showBackLink = true }: { returnTo?: string | undefined; showBackLink?: boolean }): ReactElement {
  const t = useTranslations('auth');
  const locale = useLocale();
  const { forgotPassword } = useAuthMutations();
  const form = useAuthForm(FIELDS);
  const { values, errors, formError, pending } = form;
  const [done, setDone] = useState<{ demoLink?: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    form.setFormError(null);
    const email = normalizeEmail(values.email);
    if (!isPlausibleEmail(email)) {
      const next = { email: t('validation.email') };
      form.setErrors(next);
      form.focusFirstError(next);
      return;
    }
    form.setErrors({});
    form.setPending(true);
    try {
      const result = await forgotPassword({ email, locale });
      setDone(result.demoLink ? { demoLink: result.demoLink } : {});
    } catch (error) {
      form.setFormError(t(submitErrorKey(error)));
    } finally {
      form.setPending(false);
    }
  }

  const backLink = showBackLink ? (
    <Link href={withReturnTo('/login', returnTo)} className={AUTH_LINK}>
      {t('forgot.backToLogin')}
    </Link>
  ) : null;

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="m-0 text-md text-text">
          {t('forgot.confirm')}
        </p>
        {done.demoLink ? (
          <div role="status" className="flex flex-col gap-3 rounded-lg bg-surface-brand px-5 py-4 text-sm text-text-on-brand">
            <p className="m-0 font-display font-semibold">{t('forgot.demoBanner')}</p>
            <Link href={stripLocalePrefix(done.demoLink)} className="font-display font-semibold text-text-on-brand underline underline-offset-4">
              {t('forgot.demoLink')}
            </Link>
          </div>
        ) : null}
        <p className="m-0 text-sm text-text-muted">{t('forgot.unverifiedHint')}</p>
        {backLink}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Field label={t('field.email')} htmlFor={form.idOf('email')} error={errors.email} errorLive>
        <Input id={form.idOf('email')} name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={form.onChange('email')} />
      </Field>
      <p role="alert" className="m-0 min-h-5 text-sm text-danger">
        {formError}
      </p>
      <Button type="submit" block loading={pending}>
        {pending ? t('forgot.pending') : t('forgot.submit')}
      </Button>
      {backLink}
    </form>
  );
}
