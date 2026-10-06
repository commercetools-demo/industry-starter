'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useAuthMutations } from '@/hooks/useAccount';
import { Link, useRouter } from '@/i18n/routing';
import { apiErrorCode, formValue, newPasswordError, type FieldError } from './validation';

/** Sets the new password with the emailed (dev: stub) token; success signs the shopper in and lands on the account page. */
export function ResetPasswordForm({ token }: { token?: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { resetPassword } = useAuthMutations();
  const [error, setError] = useState<FieldError | null>(null);
  const [formError, setFormError] = useState<'invalidToken' | 'rateLimited' | 'generic' | null>(token ? null : 'invalidToken');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const password = formValue(new FormData(event.currentTarget), 'password');
    const problem = newPasswordError(password);
    setError(problem);
    setFormError(null);
    if (problem) return;
    setPending(true);
    try {
      await resetPassword(token, password);
      router.replace('/account');
    } catch (e) {
      const code = apiErrorCode(e);
      setFormError(code === 'INVALID_TOKEN' ? 'invalidToken' : code === 'RATE_LIMITED' ? 'rateLimited' : 'generic');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-(--space-2)">
      <Input name="password" type="password" autoComplete="new-password" label={t('passwordNew')} placeholder={t('passwordHint')} error={error ? t(`errors.${error}`) : undefined} />
      {formError ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700">
          {formError === 'invalidToken' ? (
            <>
              {t('invalidToken')} <Link href="/account/forgot-password">{t('requestNewLink')}</Link>
            </>
          ) : formError === 'rateLimited' ? (
            t('errors.rateLimited')
          ) : (
            t('errors.generic')
          )}
        </p>
      ) : null}
      <Button type="submit" block disabled={pending || !token}>
        {pending ? t('resetPending') : t('resetSubmit')}
      </Button>
    </form>
  );
}
