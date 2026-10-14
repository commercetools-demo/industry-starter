// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/account/AuthCard';
import { ForgotPasswordForm } from '@/components/account/AuthForms';
import { isAppLocale } from '@/i18n/config';
import { getShellContext } from '@/lib/ct/shell';

type Props = { params: Promise<{ locale: string; store: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'account.auth' });
  return { title: t('forgotMeta'), robots: { index: false, follow: false } };
}

/**
 * Forgot password (workstream Q-04, D4). The project sends no email: the reset link comes back in the answer and is shown on the page with the
 * demo notice. The page itself never holds a token (it is only in the answer to the form, never in this URL).
 */
export default async function ForgotPasswordPage({ params }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  if (!(await getShellContext(store, locale))) notFound();
  const t = await getTranslations({ locale, namespace: 'account.auth' });
  return (
    <AuthCard title={t('forgotTitle')}>
      <ForgotPasswordForm store={store} />
    </AuthCard>
  );
}
