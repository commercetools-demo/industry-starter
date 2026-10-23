'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import AuthNotice from '@/components/auth/AuthNotice';
import DemoSignIn from '@/components/auth/DemoSignIn';
import PasswordField from '@/components/auth/PasswordField';
import { useAuthSuccess } from '@/components/auth/use-auth-success';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { AuthApiError, useAuthActions } from '@/hooks/useAuthActions';
import { Link } from '@/i18n/routing';
import { isEmailShape } from '@/lib/auth/email-shape';

export type SignInNotice = 'registered' | 'signedOut';

interface SignInFormProps {
  /** A safe, locale-free path (already passed through `safeRedirect` on the server). */
  redirectTo: string;
  notice: SignInNotice | null;
  /** Carried to the register link. */
  registerHref?: string;
}

type PageError = { kind: 'invalid' } | { kind: 'tooMany'; seconds: number } | { kind: 'unavailable' };

function toPageError(e: unknown): PageError {
  if (e instanceof AuthApiError) {
    if (e.code === 'invalid_credentials') return { kind: 'invalid' };
    if (e.code === 'too_many_attempts') return { kind: 'tooMany', seconds: e.extra.retryAfterSeconds ?? 60 };
  }
  return { kind: 'unavailable' };
}

/** Sign-in card plus the demo sign-in box below it (D-040). One page-level error box serves both. */
export default function SignInForm({ redirectTo, notice, registerHref = '/account/register' }: SignInFormProps) {
  const t = useTranslations('auth');
  const { signIn } = useAuthActions();
  const finish = useAuthSuccess(redirectTo);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [pageError, setPageError] = useState<PageError | null>(null);
  const [pending, setPending] = useState(false);
  const [blockedFor, setBlockedFor] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Count the retry-after window down; the submit button stays disabled until it ends.
  useEffect(() => {
    if (blockedFor <= 0) return;
    const timer = setTimeout(() => setBlockedFor((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [blockedFor]);

  const fail = (e: unknown) => {
    const error = toPageError(e);
    setPageError(error);
    if (error.kind === 'invalid') {
      setPassword('');
      passwordRef.current?.focus();
    }
    if (error.kind === 'tooMany') setBlockedFor(error.seconds);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const errors: { email?: string; password?: string } = {};
    const trimmed = email.trim();
    if (!trimmed) errors.email = t('errors.required');
    else if (!isEmailShape(trimmed)) errors.email = t('errors.emailShape');
    if (!password) errors.password = t('errors.required');
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      (errors.email ? emailRef.current : passwordRef.current)?.focus();
      return;
    }
    setPageError(null);
    setPending(true);
    try {
      finish(await signIn(trimmed, password));
    } catch (e) {
      fail(e);
    } finally {
      setPending(false);
    }
  };

  const blocked = blockedFor > 0;
  const demo = (
    <DemoSignIn
      onSignedIn={(result) => finish(result)}
      onError={fail}
    />
  );

  return (
    <AuthCard eyebrow={t('signIn.eyebrow')} title={t('signIn.title')} intro={t('signIn.intro')} below={demo}>
      {notice ? <AuthNotice kind="success">{t(`notice.${notice}`)}</AuthNotice> : null}
      {pageError ? (
        <AuthNotice kind="error">
          {pageError.kind === 'invalid' ? t('signIn.invalidCredentials') : null}
          {pageError.kind === 'tooMany' ? t('signIn.tooMany', { seconds: blocked ? blockedFor : pageError.seconds }) : null}
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
        <Field label={t('signIn.email')} htmlFor="signin-email" error={fieldErrors.email}>
          <Input
            ref={emailRef}
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'signin-email-error' : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <PasswordField
          ref={passwordRef}
          id="signin-password"
          name="password"
          label={t('signIn.password')}
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="ink" size="lg" block loading={pending} disabled={blocked}>
          {pending ? t('signIn.pending') : t('signIn.submit')}
        </Button>
      </form>
      <p className="mb-0 mt-5 text-center text-[13px] text-ink-2">
        <Link href={registerHref} className="underline-offset-2 hover:underline">
          {t('signIn.create')}
        </Link>
      </p>
    </AuthCard>
  );
}
