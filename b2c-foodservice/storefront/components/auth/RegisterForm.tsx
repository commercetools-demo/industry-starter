'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import AuthNotice from '@/components/auth/AuthNotice';
import PasswordField from '@/components/auth/PasswordField';
import PasswordStrength from '@/components/auth/PasswordStrength';
import { useAuthSuccess } from '@/components/auth/use-auth-success';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { AuthApiError, useAuthActions } from '@/hooks/useAuthActions';
import { Link } from '@/i18n/routing';
import { isEmailShape } from '@/lib/auth/email-shape';
import { validatePassword } from '@/lib/auth/password-policy';
import type { RuleId } from '@/lib/types';

interface RegisterFormProps {
  redirectTo: string;
  /** From the HTTP-only guest cookie, read on the server; '' when none. */
  initialEmail?: string;
  /** Carried to the sign-in link. */
  signInHref?: string;
}

type Errors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password', string>>;
type PageError = { kind: 'failed' } | { kind: 'tooMany'; seconds: number } | { kind: 'unavailable' };

export default function RegisterForm({ redirectTo, initialEmail = '', signInHref = '/account/sign-in' }: RegisterFormProps) {
  const t = useTranslations('auth');
  const { register } = useAuthActions();
  const finish = useAuthSuccess(redirectTo);
  const [values, setValues] = useState({ firstName: '', lastName: '', email: initialEmail, password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [serverFailed, setServerFailed] = useState<RuleId[]>([]);
  const [pageError, setPageError] = useState<PageError | null>(null);
  const [pending, setPending] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const focusField = (name: 'firstName' | 'lastName' | 'email' | 'password') =>
    ({ firstName: firstNameRef, lastName: lastNameRef, email: emailRef, password: passwordRef })[name].current?.focus();
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    if (name === 'password') setServerFailed([]);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const next: Errors = {};
    const email = values.email.trim();
    if (!values.firstName.trim()) next.firstName = t('errors.required');
    if (!values.lastName.trim()) next.lastName = t('errors.required');
    if (!email) next.email = t('errors.required');
    else if (!isEmailShape(email)) next.email = t('errors.emailShape');
    if (!values.password) next.password = t('errors.required');
    else if (!validatePassword(values.password, email).ok) next.password = t('password.rulesLabel');
    setErrors(next);
    const firstInvalid = (['firstName', 'lastName', 'email', 'password'] as const).find((k) => next[k]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    setPageError(null);
    setPending(true);
    try {
      finish(
        await register({ email, password: values.password, firstName: values.firstName.trim(), lastName: values.lastName.trim() }),
        'register',
      );
    } catch (e) {
      if (e instanceof AuthApiError && e.code === 'password_policy') {
        setServerFailed(e.extra.failed ?? []);
        setErrors({ password: t('password.rulesLabel') });
        focusField('password');
      } else if (e instanceof AuthApiError && e.code === 'registration_failed') {
        setPageError({ kind: 'failed' });
      } else if (e instanceof AuthApiError && e.code === 'too_many_attempts') {
        setPageError({ kind: 'tooMany', seconds: e.extra.retryAfterSeconds ?? 60 });
      } else {
        setPageError({ kind: 'unavailable' });
      }
    } finally {
      setPending(false);
    }
  };

  // The message holds {terms} and {privacy}; the links are slotted in at their markers.
  const [T, P] = ['\u0001', '\u0002'];
  const consent = t('register.consent', { terms: T, privacy: P })
    .split(new RegExp(`(${T}|${P})`))
    .map((part, i) =>
      part === T ? (
        <Link key={i} href="/terms" className="underline">{t('register.terms')}</Link>
      ) : part === P ? (
        <Link key={i} href="/privacy" className="underline">{t('register.privacy')}</Link>
      ) : (
        part
      ),
    );

  return (
    <AuthCard eyebrow={t('register.eyebrow')} title={t('register.title')} intro={t('register.intro')}>
      {pageError ? (
        <AuthNotice kind="error">
          {pageError.kind === 'failed' ? t('register.failed') : null}
          {pageError.kind === 'tooMany' ? t('signIn.tooMany', { seconds: pageError.seconds }) : null}
          {pageError.kind === 'unavailable' ? (
            <>
              {t('errors.unavailable')}{' '}
              <button type="button" onClick={() => void submit()} className="font-semibold underline">
                {t('errors.retry')}
              </button>
            </>
          ) : null}
        </AuthNotice>
      ) : null}
      <form noValidate onSubmit={submit}>
        <div className="grid gap-x-3 mobile:grid-cols-2">
          <Field label={t('register.firstName')} htmlFor="register-first" error={errors.firstName}>
            <Input
              ref={firstNameRef}
              id="register-first"
              name="firstName"
              autoComplete="given-name"
              value={values.firstName}
              invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? 'register-first-error' : undefined}
              onChange={set('firstName')}
            />
          </Field>
          <Field label={t('register.lastName')} htmlFor="register-last" error={errors.lastName}>
            <Input
              ref={lastNameRef}
              id="register-last"
              name="lastName"
              autoComplete="family-name"
              value={values.lastName}
              invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? 'register-last-error' : undefined}
              onChange={set('lastName')}
            />
          </Field>
        </div>
        <Field label={t('signIn.email')} htmlFor="register-email" error={errors.email}>
          <Input
            ref={emailRef}
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            onChange={set('email')}
          />
        </Field>
        <PasswordField
          ref={passwordRef}
          id="register-password"
          name="password"
          label={t('signIn.password')}
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          describedBy="register-password-rules"
          onChange={set('password')}
        />
        <PasswordStrength id="register-password-rules" password={values.password} email={values.email} serverFailed={serverFailed} />
        <Button type="submit" variant="ink" size="lg" block loading={pending}>
          {pending ? t('register.pending') : t('register.submit')}
        </Button>
      </form>
      <p className="mb-0 mt-4 text-center text-[12.5px] text-ink-3">{consent}</p>
      <p className="mb-0 mt-4 text-center text-[13px] text-ink-2">
        <Link href={signInHref} className="underline-offset-2 hover:underline">
          {t('register.haveAccount')}
        </Link>
      </p>
    </AuthCard>
  );
}
