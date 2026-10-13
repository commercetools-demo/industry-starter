// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MarketingConsentCheckbox } from '@/components/auth/MarketingConsentCheckbox';
import { buttonClass } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { errorCodeOf, errorRuleOf } from '@/hooks/account-fetch';
import { useAuthActions } from '@/hooks/useAuthActions';
import { Link, useRouter } from '@/i18n/routing';

type Problem = { text: string } | null;

/** The error line of an auth form: announced, and it takes the focus so a keyboard user hears it. */
function ErrorLine({ problem }: { problem: Problem }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (problem) ref.current?.focus();
  }, [problem]);
  if (!problem) return null;
  return (
    <p ref={ref} tabIndex={-1} role="alert" className="m-0 rounded-sm bg-danger-50 p-3 font-ui text-sm text-danger-600">
      {problem.text}
    </p>
  );
}

const SubmitButton = ({ pending, idle, busy, disabled }: { pending: boolean; idle: string; busy: string; disabled?: boolean }) => (
  <button type="submit" disabled={pending || disabled} className={buttonClass('primary', 'w-full')}>
    {pending ? busy : idle}
  </button>
);

/** Names the policy rule that failed (`too-short`, `too-common`), or the generic line. */
function usePasswordProblem() {
  const rules = useTranslations('account.passwordRules');
  const t = useTranslations('account.auth');
  return (failure: unknown, fallback: 'errorGeneric' | 'resetInvalid'): Problem => {
    const code = errorCodeOf(failure);
    if (code === 'weak-password') {
      const rule = errorRuleOf(failure);
      if (rule === 'too-short' || rule === 'too-common') return { text: rules(rule) };
    }
    if (code === 'rate-limited') return { text: t('errorRate') };
    if (code === 'invalid-token') return { text: t('resetInvalid') };
    return { text: t(fallback) };
  };
}

// ---- Register ---------------------------------------------------------------------------------------------------------------------

export function RegisterForm({ store, storeName, next }: { store: string; storeName: string; next: string }) {
  const t = useTranslations('account.auth');
  const toProblem = usePasswordProblem();
  const router = useRouter();
  const { register } = useAuthActions();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [pending, setPending] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setProblem(null);
    try {
      await register({ email: form.email.trim(), password: form.password, ...(form.firstName.trim() ? { firstName: form.firstName.trim() } : {}), ...(form.lastName.trim() ? { lastName: form.lastName.trim() } : {}), marketingConsent: consent });
      setForm((f) => ({ ...f, password: '' }));
      router.replace(`/${store}${next === '/' ? '' : next}`);
      router.refresh();
    } catch (failure) {
      setProblem(toProblem(failure, 'errorGeneric'));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-describedby="register-intro">
      <p id="register-intro" className="m-0 font-ui text-sm text-text-muted">
        {t('registerIntro', { store: storeName })}
      </p>
      <div className="grid gap-4 min-[43.75rem]:grid-cols-2">
        <Field label={t('firstName')} name="given-name" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
        <Field label={t('lastName')} name="family-name" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
      </div>
      <Field label={t('email')} type="email" name="email" autoComplete="email" inputMode="email" required value={form.email} onChange={set('email')} />
      <Field label={t('password')} hint={t('passwordHint')} type="password" name="new-password" autoComplete="new-password" required value={form.password} onChange={set('password')} />
      <div className="grid gap-2">
        <MarketingConsentCheckbox checked={consent} onChange={setConsent} />
        <p className="m-0 font-ui text-xs text-text-subtle">{t('consentNote')}</p>
      </div>
      <ErrorLine problem={problem} />
      <SubmitButton pending={pending} idle={t('submit')} busy={t('submitting')} disabled={form.email.trim() === '' || form.password === ''} />
      <Link href={`/${store}/account/sign-in${next === '/' ? '' : `?next=${encodeURIComponent(next)}`}`} className="font-utility text-sm text-text-link underline-offset-2 hover:underline">
        {t('haveAccount')}
      </Link>
    </form>
  );
}

// ---- Forgot password (on screen, no email) ------------------------------------------------------------------------------------------

/** The reset link comes back in the answer and is shown as a button, with the demo notice. With the reset turned off the page says so. */
export function ForgotPasswordForm({ store }: { store: string }) {
  const t = useTranslations('account.auth');
  const { requestReset } = useAuthActions();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ resetPath?: string } | null>(null);
  const [problem, setProblem] = useState<Problem>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setProblem(null);
    try {
      setResult(await requestReset(email.trim()));
    } catch (failure) {
      setProblem({ text: errorCodeOf(failure) === 'rate-limited' ? t('errorRate') : t('errorGeneric') });
    }
    setPending(false);
  }

  const signIn = (
    <Link href={`/${store}/account/sign-in`} className="font-utility text-sm text-text-link underline-offset-2 hover:underline">
      {t('backToSignIn')}
    </Link>
  );

  if (result && !result.resetPath) {
    return (
      <div className="grid gap-4">
        <p role="status" className="m-0 font-display text-md font-semibold text-text">
          {t('forgotUnavailable')}
        </p>
        <p className="m-0 font-ui text-sm text-text-body">{t('forgotUnavailableBody')}</p>
        {signIn}
      </div>
    );
  }
  if (result?.resetPath) {
    // The link carries the locale and the store; the router adds the locale itself.
    const href = result.resetPath.replace(/^\/[^/]+/, '');
    return (
      <div className="grid gap-4">
        <p role="status" className="m-0 rounded-sm bg-info-50 p-3 font-ui text-sm text-info-600">
          {t('demoNotice')}
        </p>
        <Link href={href} className={buttonClass('primary', 'w-full')}>
          {t('forgotOpenLink')}
        </Link>
        {signIn}
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <p className="m-0 font-ui text-sm text-text-muted">{t('forgotIntro')}</p>
      <Field label={t('email')} type="email" name="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <ErrorLine problem={problem} />
      <SubmitButton pending={pending} idle={t('forgotSubmit')} busy={t('forgotSubmitting')} disabled={email.trim() === ''} />
      {signIn}
    </form>
  );
}

// ---- Reset password ---------------------------------------------------------------------------------------------------------------

/** Sets the new password with the token of the link, then goes to sign-in (the link never creates a session). */
export function ResetPasswordForm({ store, token }: { store: string; token: string | null }) {
  const t = useTranslations('account.auth');
  const toProblem = usePasswordProblem();
  const router = useRouter();
  const { resetPassword } = useAuthActions();
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !token) return;
    setPending(true);
    setProblem(null);
    try {
      await resetPassword(token, password);
      setPassword('');
      router.replace(`/${store}/account/sign-in?reset=1`);
    } catch (failure) {
      setInvalid(errorCodeOf(failure) === 'invalid-token');
      setProblem(toProblem(failure, 'resetInvalid'));
      setPending(false);
    }
  }

  const again = (
    <Link href={`/${store}/account/forgot-password`} className="font-utility text-sm text-text-link underline-offset-2 hover:underline">
      {t('resetAskAgain')}
    </Link>
  );
  if (!token) {
    return (
      <div className="grid gap-4">
        <p role="alert" className="m-0 rounded-sm bg-danger-50 p-3 font-ui text-sm text-danger-600">
          {t('resetNoToken')}
        </p>
        {again}
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <p className="m-0 font-ui text-sm text-text-muted">{t('resetIntro')}</p>
      <Field label={t('resetNewPassword')} hint={t('passwordHint')} type="password" name="new-password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <ErrorLine problem={problem} />
      <SubmitButton pending={pending} idle={t('resetSubmit')} busy={t('resetSubmitting')} disabled={password === ''} />
      {invalid ? again : null}
    </form>
  );
}
