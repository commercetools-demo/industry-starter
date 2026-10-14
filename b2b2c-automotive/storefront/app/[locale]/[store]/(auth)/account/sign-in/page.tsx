// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DemoLoginSlot } from '@/components/auth/DemoLoginSlot';
import { SignInForm } from '@/components/auth/SignInForm';
import { Link } from '@/i18n/routing';
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
 * Sign in (workstream N; Q adds register, forgot password and the account area behind it). Store scoped: the account belongs to the
 * reseller of the address. `?next=` is the path inside the store to return to (`/cart`; no locale, no store key); anything that is not a path of
 * this site is ignored. Without it the shopper lands on the account overview.
 */
const DEFAULT_NEXT = '/account';

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const ctx = await getShellContext(store, locale);
  if (!ctx) notFound();
  const query = await searchParams;
  const raw = query.next;
  const next = safeNext(typeof raw === 'string' ? raw : null, DEFAULT_NEXT);
  const [t, ta] = await Promise.all([getTranslations({ locale, namespace: 'auth.signIn' }), getTranslations({ locale, namespace: 'account.auth' })]);
  const nextQuery = next === DEFAULT_NEXT ? '' : `?next=${encodeURIComponent(next)}`;
  const link = 'inline-flex min-h-7 items-center font-utility text-sm text-text-link underline-offset-2 hover:underline';

  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 min-[64rem]:p-5">
      <div className="mx-auto grid w-full max-w-prose gap-5 rounded-md border border-border bg-surface p-5">
        <h1 className="m-0 font-display text-2xl font-semibold text-text">{t('title')}</h1>
        {query.reset === '1' ? (
          <p role="status" className="m-0 rounded-sm bg-success-50 p-3 font-ui text-sm text-success-600">
            {ta('signInNoticeReset')}
          </p>
        ) : null}
        <SignInForm store={store} storeName={ctx.settings.name} next={next} />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href={`/${store}/account/forgot-password`} className={link}>
            {ta('signInForgot')}
          </Link>
          <Link href={`/${store}/account/register${nextQuery}`} className={link}>
            {ta('signInRegister')}
          </Link>
        </div>
        <DemoLoginSlot store={store} next={next} />
      </div>
    </div>
  );
}
