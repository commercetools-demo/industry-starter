'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Inputs';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from '@/i18n/routing';
import { validateRegistration, validateSignIn, type FieldProblem } from '@/lib/auth-validation';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy';
import type { AuthReason } from '@/lib/sign-in-reason';

export type SignInMode = 'in' | 'up';
type Field = 'name' | 'email' | 'password';
type Problems = Partial<Record<Field, FieldProblem>>;

export interface SignInCardProps {
  /** Locale-less, already sanitized destination after signing in (default `/account`). */
  next?: string;
  reason?: AuthReason | null;
  initialMode?: SignInMode;
}

const FIELD_ORDER: readonly Field[] = ['name', 'email', 'password'];
const FIELD_ID_PREFIX = 'sign-in-';

/**
 * Sign in / create account card (design-account-area: centered 440 px, title, reason line, fields, toggle).
 * One inline error for refused credentials (never says which field), per-field errors for validation,
 * focus moves to the first problem, the submit button is `busy` while the request runs. The same
 * validation functions run here and on the server.
 */
export function SignInCard({ next = '/account', reason = null, initialMode = 'in' }: SignInCardProps) {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const router = useRouter();
  const toast = useToast();
  const { signIn, register } = useAuth();

  const [mode, setMode] = useState<SignInMode>(initialMode);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [problems, setProblems] = useState<Problems>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ field: Field | 'form'; n: number } | null>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  // Focus after the error markup is rendered.
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.field === 'form') formErrorRef.current?.focus();
    else document.getElementById(`${FIELD_ID_PREFIX}${focusRequest.field}`)?.focus();
  }, [focusRequest]);

  const requestFocus = (field: Field | 'form') => setFocusRequest((previous) => ({ field, n: (previous?.n ?? 0) + 1 }));

  const problemText = (field: Field): string | undefined => {
    const problem = problems[field];
    if (!problem) return undefined;
    if (field === 'password' && problem === 'tooShort') return t('problems.passwordTooShort', { min: PASSWORD_MIN_LENGTH });
    if (field === 'password' && problem === 'tooLong') return t('problems.passwordTooLong', { max: PASSWORD_MAX_LENGTH });
    return t(`problems.${field}${problem === 'invalid' ? 'Invalid' : 'Required'}`);
  };

  const showProblems = (found: Problems) => {
    setProblems(found);
    setFormError('');
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) requestFocus(first);
  };

  const switchMode = (nextMode: SignInMode) => {
    setMode(nextMode);
    setProblems({});
    setFormError('');
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found: Problems = mode === 'up' ? validateRegistration(values) : validateSignIn(values);
    if (Object.keys(found).length > 0) return showProblems(found);
    setProblems({});
    setFormError('');
    setBusy(true);
    const result = mode === 'up' ? await register(values.name, values.email, values.password) : await signIn(values.email, values.password);
    setBusy(false);
    if (result.ok) {
      toast.show({ message: mode === 'up' ? t('created') : t('signedIn') });
      router.replace(next);
      router.refresh();
      return;
    }
    if (result.status === 400 && result.fields) return showProblems(result.fields as Problems);
    if (result.status === 401) {
      // One message for every refused credential; the password is cleared, the email kept.
      setValues((v) => ({ ...v, password: '' }));
      setFormError(t('failed'));
      return requestFocus('password');
    }
    setFormError(
      result.status === 409 ? t('refused') : result.status === 429 ? t('tooManyAttempts') : result.status === 0 ? errors('network') : errors('generic'),
    );
    requestFocus('form');
  }

  const set = (field: Field) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: event.target.value }));
  const isUp = mode === 'up';

  return (
    <div className="mx-auto max-w-content px-5 nav:px-8">
      <Card className="mx-auto my-14 grid max-w-110 gap-4">
        <form onSubmit={onSubmit} noValidate className="grid gap-4" data-sign-in-card data-mode={mode} aria-busy={busy || undefined}>
          <div>
            <h1 className="font-display text-2xl font-semibold text-text-heading">{isUp ? t('registerTitle') : t('signInTitle')}</h1>
            {reason ? <p className="mt-1.5 text-sm text-neutral-600">{t(`reason.${reason}`)}</p> : null}
          </div>
          {formError ? (
            <p ref={formErrorRef} tabIndex={-1} role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700">
              {formError}
            </p>
          ) : null}
          {isUp ? (
            <Input
              id={`${FIELD_ID_PREFIX}name`}
              label={t('fields.name')}
              name="name"
              autoComplete="name"
              value={values.name}
              onChange={set('name')}
              error={problemText('name')}
              required
            />
          ) : null}
          <Input
            id={`${FIELD_ID_PREFIX}email`}
            label={t('fields.email')}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={set('email')}
            error={problemText('email')}
            required
          />
          <Input
            id={`${FIELD_ID_PREFIX}password`}
            label={t('fields.password')}
            name="password"
            type="password"
            autoComplete={isUp ? 'new-password' : 'current-password'}
            value={values.password}
            onChange={set('password')}
            hint={isUp ? t('passwordHint', { min: PASSWORD_MIN_LENGTH }) : undefined}
            error={problemText('password')}
            required
          />
          <Button type="submit" full busy={busy}>
            {isUp ? t('submitRegister') : t('submitSignIn')}
          </Button>
          <p className="text-center text-sm text-navy-900">
            {isUp ? t('toSignInPrompt') : t('toRegisterPrompt')}{' '}
            <button
              type="button"
              onClick={() => switchMode(isUp ? 'in' : 'up')}
              className="cursor-pointer font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              {isUp ? t('toSignIn') : t('toRegister')}
            </button>
          </p>
        </form>
      </Card>
    </div>
  );
}
