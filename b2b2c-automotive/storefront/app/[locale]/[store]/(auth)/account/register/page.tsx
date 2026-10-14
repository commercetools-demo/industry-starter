// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/account/AuthCard';
import { RegisterForm } from '@/components/account/AuthForms';
import { isAppLocale } from '@/i18n/config';
import { safeNext } from '@/lib/auth/safe-next';
import { getShellContext } from '@/lib/ct/shell';

type Props = {
  params: Promise<{ locale: string; store: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'account.auth' });
  return { title: t('registerMeta'), robots: { index: false, follow: false } };
}

/** Register (workstream Q-03): the account belongs to the store of the address; the shopper is signed in at once and the cart and garage merge. */
export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const ctx = await getShellContext(store, locale);
  if (!ctx) notFound();
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === 'string' ? raw : null, '/account');
  const t = await getTranslations({ locale, namespace: 'account.auth' });
  return (
    <AuthCard title={t('registerTitle')}>
      <RegisterForm store={store} storeName={ctx.settings.name} next={next} />
    </AuthCard>
  );
}
