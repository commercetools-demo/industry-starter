'use client';

import { type FormEvent, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useRouter } from '@/i18n/routing';
import { AuthError, useAuthMutations } from '@/hooks/useAuthMutations';
import { stripLocalePrefix } from '@/lib/auth/return-target';
import { checkPassword } from '@/lib/config/password';
import { firstFailedRule, submitErrorKey } from './errors';
import { PasswordField } from './PasswordField';
import { PasswordStrength } from './PasswordStrength';
import { useAuthForm } from './useAuthForm';

const FIELDS = ['password'] as const;

/** Sets the new password for a valid token. Success goes to the login page with the "Password changed" notice (the user logs in again). */
export function ResetPasswordForm({ token }: { token: string }): ReactElement {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { resetPassword } = useAuthMutations();
  const form = useAuthForm(FIELDS);
  const { values, errors, formError, pending } = form;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    form.setFormError(null);
    const failed = checkPassword(values.password).failed[0];
    if (values.password === '' || failed) {
      const next = { password: values.password === '' ? t('validation.password') : t(`password.rule.${failed ?? 'min-length'}`) };
      form.setErrors(next);
      form.focusFirstError(next);
      return;
    }
    form.setErrors({});
    form.setPending(true);
    try {
      const result = await resetPassword({ token, password: values.password, locale });
      router.replace(stripLocalePrefix(result.redirectTo));
    } catch (error) {
      form.setPending(false);
      if (error instanceof AuthError && error.code === 'WEAK_PASSWORD') {
        const rule = firstFailedRule(error);
        const next = { password: rule ? t(`password.rule.${rule}`) : t('validation.password') };
        form.setErrors(next);
        form.focusFirstError(next);
      } else if (error instanceof AuthError && error.code === 'INVALID_TOKEN') {
        form.setFormError(t('reset.expiredTitle'));
      } else {
        form.setFormError(t(submitErrorKey(error)));
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PasswordField
          id={form.idOf('password')}
          name="password"
          label={t('field.newPassword')}
          autoComplete="new-password"
          error={errors.password}
          value={values.password}
          onChange={form.onChange('password')}
        />
        <PasswordStrength password={values.password} />
      </div>
      <p role="alert" className="m-0 min-h-5 text-sm text-danger">
        {formError}
      </p>
      <Button type="submit" block loading={pending}>
        {pending ? t('reset.pending') : t('reset.submit')}
      </Button>
    </form>
  );
}
