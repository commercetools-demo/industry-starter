// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DemoLoginSlot } from '@/components/auth/DemoLoginSlot';
import { SignInForm } from '@/components/auth/SignInForm';
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
  const t = await getTranslations({ locale, namespace: 'auth.signIn' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * Sign in (workstream N; Q adds register, forgot password and the account area around it). Store scoped: the account belongs to the
 * reseller of the address. `?next=` is the path inside the store to return to (`/cart`; no locale, no store key); anything that is not a path of this site is ignored.
 * Until the account area exists (workstream Q) the default destination is the store home; Q changes `DEFAULT_NEXT` to `/account`.
 */
const DEFAULT_NEXT = '/';

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const ctx = await getShellContext(store, locale);
  if (!ctx) notFound();
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === 'string' ? raw : null, DEFAULT_NEXT);
  const t = await getTranslations({ locale, namespace: 'auth.signIn' });

  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 min-[64rem]:p-5">
      <div className="mx-auto grid w-full max-w-prose gap-5 rounded-md border border-border bg-surface p-5">
        <h1 className="m-0 font-display text-2xl font-semibold text-text">{t('title')}</h1>
        <SignInForm store={store} storeName={ctx.settings.name} next={next} />
        <DemoLoginSlot store={store} next={next} />
      </div>
    </div>
  );
}
