'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { RequireSignIn } from '@/components/layout/RequireSignIn';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Inputs';
import { useToast } from '@/components/ui/Toast';
import { useProfile, type ProfileResult } from '@/hooks/use-profile';
import { checkName } from '@/lib/auth-validation';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, checkPassword } from '@/lib/password-policy';

export interface ProfileFormsProps {
  firstName: string;
  lastName: string;
  email: string;
}

/** Focus the element with this id once its error markup exists. */
function useFocusRequest() {
  const [request, setRequest] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (request) document.getElementById(request.id)?.focus();
  }, [request]);
  return (id: string) => setRequest((previous) => ({ id, n: (previous?.n ?? 0) + 1 }));
}

const ErrorLine = ({ id, children }: { id: string; children: string }) => (
  <p id={id} tabIndex={-1} role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700">
    {children}
  </p>
);

function NameForm({ firstName, lastName, onExpired }: { firstName: string; lastName: string; onExpired: () => void }) {
  const t = useTranslations('account.profile');
  const errors = useTranslations('errors');
  const toast = useToast();
  const { updateName } = useProfile();
  const focus = useFocusRequest();
  const [values, setValues] = useState({ firstName, lastName });
  const [problems, setProblems] = useState<Partial<Record<'firstName' | 'lastName', string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const text = (field: 'firstName' | 'lastName') => (problems[field] ? t(`name.problems.${field}${problems[field] === 'invalid' ? 'Invalid' : 'Required'}`) : undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found: Partial<Record<'firstName' | 'lastName', string>> = {};
    const first = checkName(values.firstName);
    const last = checkName(values.lastName);
    if (first) found.firstName = first;
    if (last) found.lastName = last;
    setProblems(found);
    setFormError('');
    if (first) return focus('profile-firstName');
    if (last) return focus('profile-lastName');
    setBusy(true);
    const result: ProfileResult = await updateName(values.firstName.trim(), values.lastName.trim());
    setBusy(false);
    if (result.ok) return toast.show({ message: t('name.saved') });
    if (result.status === 401) return onExpired();
    if (result.status === 400 && result.fields) {
      setProblems(result.fields);
      return focus(result.fields.firstName ? 'profile-firstName' : 'profile-lastName');
    }
    setFormError(result.status === 0 ? errors('network') : t('saveFailed'));
    focus('profile-name-error');
  }

  return (
    <Card as="section" aria-labelledby="profile-name-title">
      <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-busy={busy || undefined} data-profile-name>
        <h2 id="profile-name-title" className="font-display text-xl font-semibold text-navy-900">
          {t('name.title')}
        </h2>
        {formError ? <ErrorLine id="profile-name-error">{formError}</ErrorLine> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="profile-firstName" label={t('name.firstName')} name="firstName" autoComplete="given-name" value={values.firstName} onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))} error={text('firstName')} required />
          <Input id="profile-lastName" label={t('name.lastName')} name="lastName" autoComplete="family-name" value={values.lastName} onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))} error={text('lastName')} required />
        </div>
        <div>
          <Button type="submit" busy={busy}>
            {t('name.save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

type PasswordField = 'current' | 'new' | 'confirm';

function PasswordForm({ onExpired }: { onExpired: () => void }) {
  const t = useTranslations('account.profile');
  const errors = useTranslations('errors');
  const toast = useToast();
  const { changePassword } = useProfile();
  const focus = useFocusRequest();
  const [values, setValues] = useState({ current: '', new: '', confirm: '' });
  const [problems, setProblems] = useState<Partial<Record<PasswordField, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const text = (field: PasswordField): string | undefined => {
    const problem = problems[field];
    if (!problem) return undefined;
    if (field === 'current') return t('password.problems.currentRequired');
    if (field === 'confirm') return t('password.problems.confirmMismatch');
    if (problem === 'tooShort') return t('password.problems.newTooShort', { min: PASSWORD_MIN_LENGTH });
    if (problem === 'tooLong') return t('password.problems.newTooLong', { max: PASSWORD_MAX_LENGTH });
    return t('password.problems.newRequired');
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found: Partial<Record<PasswordField, string>> = {};
    if (!values.current) found.current = 'required';
    const newProblem = checkPassword(values.new);
    if (newProblem) found.new = newProblem;
    else if (values.confirm !== values.new) found.confirm = 'mismatch';
    setProblems(found);
    setFormError('');
    const firstField = (['current', 'new', 'confirm'] as const).find((f) => found[f]);
    if (firstField) return focus(`profile-password-${firstField}`);
    setBusy(true);
    const result = await changePassword(values.current, values.new);
    setBusy(false);
    if (result.ok) {
      setValues({ current: '', new: '', confirm: '' });
      return toast.show({ message: t('password.saved') });
    }
    if (result.status === 401) return onExpired();
    if (result.status === 400 && result.fields?.newPassword) {
      setProblems({ new: result.fields.newPassword });
      return focus('profile-password-new');
    }
    if (result.status === 400 && result.fields?.currentPassword) {
      setProblems({ current: 'required' });
      return focus('profile-password-current');
    }
    if (result.status === 400) {
      // The current password is wrong: say so, clear it, keep the new one for another try.
      setValues((v) => ({ ...v, current: '' }));
      setFormError(t('password.wrongCurrent'));
      return focus('profile-password-current');
    }
    setFormError(result.status === 429 ? t('password.tooManyAttempts') : result.status === 0 ? errors('network') : t('saveFailed'));
    focus('profile-password-error');
  }

  const set = (field: PasswordField) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: event.target.value }));

  return (
    <Card as="section" aria-labelledby="profile-password-title">
      <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-busy={busy || undefined} data-profile-password>
        <h2 id="profile-password-title" className="font-display text-xl font-semibold text-navy-900">
          {t('password.title')}
        </h2>
        {formError ? <ErrorLine id="profile-password-error">{formError}</ErrorLine> : null}
        <Input id="profile-password-current" label={t('password.current')} name="currentPassword" type="password" autoComplete="current-password" value={values.current} onChange={set('current')} error={text('current')} required />
        <Input id="profile-password-new" label={t('password.new')} name="newPassword" type="password" autoComplete="new-password" value={values.new} onChange={set('new')} hint={t('password.hint', { min: PASSWORD_MIN_LENGTH })} error={text('new')} required />
        <Input id="profile-password-confirm" label={t('password.confirm')} name="confirmPassword" type="password" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} error={text('confirm')} required />
        <div>
          <Button type="submit" busy={busy}>
            {t('password.save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** `/account/profile` content: the email (read-only), the name form and the password form. */
export function ProfileForms({ firstName, lastName, email }: ProfileFormsProps) {
  const t = useTranslations('account.profile');
  const [expired, setExpired] = useState(false);
  // The session ended while the page was open: the sign-in prompt replaces the forms.
  if (expired) return <RequireSignIn reason="account" />;
  return (
    <div className="grid max-w-160 gap-6">
      <p className="text-sm text-neutral-700">
        <span className="font-medium text-navy-700">{t('email')}:</span> {email}
      </p>
      <NameForm firstName={firstName} lastName={lastName} onExpired={() => setExpired(true)} />
      <PasswordForm onExpired={() => setExpired(true)} />
    </div>
  );
}
