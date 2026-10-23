import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import SignInForm, { type SignInNotice } from '@/components/auth/SignInForm';
import { redirect } from '@/i18n/routing';
import { hasSignedInCustomer } from '@/lib/auth/current-customer';
import { destinationFrom } from '@/lib/auth/redirect';

// Reads the session cookie, so every request is rendered fresh (no shared caching of a signed-in page).
export const dynamic = 'force-dynamic';

type Params = { locale: string };
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.signIn' });
  return { title: t('title'), robots: { index: false, follow: true } };
}

type Search = { redirect?: string | string[]; next?: string | string[]; notice?: string | string[] };

const NOTICES: readonly SignInNotice[] = ['registered', 'signedOut'];

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await searchParams;
  const destination = destinationFrom(search);

  // A signed-in visitor is sent on. redirect() throws, so it stays outside any try/catch.
  if (await hasSignedInCustomer()) redirect({ href: destination, locale });

  const rawNotice = Array.isArray(search.notice) ? search.notice[0] : search.notice;
  const notice = NOTICES.find((n) => n === rawNotice) ?? null;
  const hasDestination = destination !== '/account' || search.redirect !== undefined || search.next !== undefined;
  const registerHref = hasDestination
    ? `/account/register?redirect=${encodeURIComponent(destination)}`
    : '/account/register';

  return <SignInForm redirectTo={destination} notice={notice} registerHref={registerHref} />;
}
