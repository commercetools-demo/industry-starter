import { setRequestLocale } from 'next-intl/server';
import MyReviews from '@/components/reviews/MyReviews';
import { requireCustomerPage } from '@/lib/auth/require-customer';
import { accountMetadata } from '@/lib/auth/account-metadata';

// Reads the session cookie: rendered fresh on every request.
export const dynamic = 'force-dynamic';
export const generateMetadata = accountMetadata('reviews');

/**
 * Account, Reviews tab (workstream M). Workstream L's shell layout (`(shell)/layout.tsx`) wraps it with the account
 * navigation; until L lands it renders on its own. Guests are sent to sign in and come back here. No `<main>`: the locale
 * layout owns it.
 */
export default async function AccountReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/reviews');
  // The account frame (workstream L's `(shell)/layout.tsx`) provides the wrap, header and tabs.
  return <MyReviews />;
}
