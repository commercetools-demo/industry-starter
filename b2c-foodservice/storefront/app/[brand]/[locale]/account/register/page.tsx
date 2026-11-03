import { brandOf } from '@/lib/brands';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import RegisterForm from '@/components/auth/RegisterForm';
import { redirect } from '@/i18n/routing';
import { hasSignedInCustomer } from '@/lib/auth/current-customer';
import { readGuestEmail } from '@/lib/auth/guest-email';
import { destinationFrom } from '@/lib/auth/redirect';

// Reads the session and the guest-email cookies, so every request is rendered fresh.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ brand?: string; locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.register' });
  return { title: t('title'), robots: { index: false, follow: true } };
}

type Search = { redirect?: string | string[]; next?: string | string[] };

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand?: string; locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { brand, locale } = await params;
  setRequestLocale(locale);
  const search = await searchParams;
  const destination = destinationFrom(search);

  // redirect() throws, so it stays outside any try/catch.
  if (await hasSignedInCustomer()) redirect({ href: destination, locale, brand: brandOf(brand).slug });

  const initialEmail = await readGuestEmail();
  const signInHref =
    destination === '/account' ? '/account/sign-in' : `/account/sign-in?redirect=${encodeURIComponent(destination)}`;
  return <RegisterForm redirectTo={destination} initialEmail={initialEmail} signInHref={signInHref} />;
}
