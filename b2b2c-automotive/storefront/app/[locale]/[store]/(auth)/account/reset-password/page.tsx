// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/account/AuthCard';
import { ResetPasswordForm } from '@/components/account/AuthForms';
import { isAppLocale } from '@/i18n/config';
import { getShellContext } from '@/lib/ct/shell';

type Props = {
  params: Promise<{ locale: string; store: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The link holds a reset token: never indexed and never sent on as a referrer. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'account.auth' });
  return { title: t('resetMeta'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export const dynamic = 'force-dynamic';

/** Reset password (workstream Q-04): the token of the link and a new password; success goes to sign-in (the link never signs anyone in). */
export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  if (!(await getShellContext(store, locale))) notFound();
  const raw = (await searchParams).token;
  const token = typeof raw === 'string' && raw.length > 0 && raw.length <= 512 ? raw : null;
  const t = await getTranslations({ locale, namespace: 'account.auth' });
  return (
    <AuthCard title={t('resetTitle')}>
      <ResetPasswordForm store={store} token={token} />
    </AuthCard>
  );
}
