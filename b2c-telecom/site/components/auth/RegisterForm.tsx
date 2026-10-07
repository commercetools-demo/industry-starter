'use client';

import { type FormEvent, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Link, useRouter } from '@/i18n/routing';
import { AuthError, useAuthMutations } from '@/hooks/useAuthMutations';
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email';
import { stripLocalePrefix, withReturnTo } from '@/lib/auth/return-target';
import { NAME_MAX_LENGTH } from '@/lib/config/auth';
import { checkPassword } from '@/lib/config/password';
import { AUTH_LINK } from './AuthCard';
import { firstFailedRule, submitErrorKey } from './errors';
import { PasswordField } from './PasswordField';
import { PasswordStrength } from './PasswordStrength';
import { useAuthForm } from './useAuthForm';

const FIELDS = ['firstName', 'lastName', 'email', 'password'] as const;
type FieldName = (typeof FIELDS)[number];

const validName = (value: string): boolean => value.trim().length >= 1 && value.trim().length <= NAME_MAX_LENGTH;

export function RegisterForm({ returnTo }: { returnTo?: string | undefined }): ReactElement {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { register } = useAuthMutations();
  const form = useAuthForm(FIELDS);
  const { values, errors, formError, pending } = form;

  function validate(): Partial<Record<FieldName, string>> {
    const next: Partial<Record<FieldName, string>> = {};
    if (!validName(values.firstName)) next.firstName = t('validation.firstName');
    if (!validName(values.lastName)) next.lastName = t('validation.lastName');
    const email = normalizeEmail(values.email);
    if (!isPlausibleEmail(email)) next.email = t('validation.email');
    const policy = checkPassword(values.password, { email });
    const failed = policy.failed[0];
    if (values.password === '') next.password = t('validation.password');
    else if (failed) next.password = t(`password.rule.${failed}`);
    return next;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    form.setFormError(null);
    const invalid = validate();
    form.setErrors(invalid);
    if (Object.keys(invalid).length > 0) {
      form.focusFirstError(invalid);
      return;
    }
    form.setPending(true);
    try {
      const result = await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: normalizeEmail(values.email),
        password: values.password,
        returnTo,
        locale,
      });
      router.replace(stripLocalePrefix(result.redirectTo));
      router.refresh();
    } catch (error) {
      form.setPending(false);
      const next: Partial<Record<FieldName, string>> = {};
      if (error instanceof AuthError && error.code === 'ACCOUNT_EXISTS') next.email = t('register.exists');
      else if (error instanceof AuthError && error.code === 'WEAK_PASSWORD') {
        const rule = firstFailedRule(error);
        next.password = rule ? t(`password.rule.${rule}`) : t('validation.password');
      } else if (error instanceof AuthError && error.code === 'INVALID_INPUT' && Array.isArray(error.details?.fields)) {
        for (const name of error.details.fields as unknown[]) if (name === 'firstName' || name === 'lastName' || name === 'email') next[name] = t(`validation.${name}`);
      }
      if (Object.keys(next).length > 0) {
        form.setErrors(next);
        form.focusFirstError(next);
      } else {
        form.setFormError(t(submitErrorKey(error)));
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Field label={t('field.firstName')} htmlFor={form.idOf('firstName')} error={errors.firstName} errorLive>
        <Input id={form.idOf('firstName')} name="firstName" autoComplete="given-name" maxLength={NAME_MAX_LENGTH + 20} value={values.firstName} onChange={form.onChange('firstName')} />
      </Field>
      <Field label={t('field.lastName')} htmlFor={form.idOf('lastName')} error={errors.lastName} errorLive>
        <Input id={form.idOf('lastName')} name="lastName" autoComplete="family-name" maxLength={NAME_MAX_LENGTH + 20} value={values.lastName} onChange={form.onChange('lastName')} />
      </Field>
      <Field label={t('field.email')} htmlFor={form.idOf('email')} error={errors.email} errorLive>
        <Input id={form.idOf('email')} name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={form.onChange('email')} />
      </Field>
      <div className="flex flex-col gap-4">
        <PasswordField
          id={form.idOf('password')}
          name="password"
          label={t('field.password')}
          autoComplete="new-password"
          error={errors.password}
          value={values.password}
          onChange={form.onChange('password')}
        />
        <PasswordStrength password={values.password} email={normalizeEmail(values.email)} />
      </div>
      <p role="alert" className="m-0 min-h-5 text-sm text-danger">
        {formError}
      </p>
      <Button type="submit" block loading={pending}>
        {pending ? t('register.pending') : t('register.submit')}
      </Button>
      <Link href={withReturnTo('/login', returnTo)} className={AUTH_LINK}>
        {t('register.haveAccount')}
      </Link>
    </form>
  );
}
