import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireCustomerPage } from '@/lib/auth/require-customer';

export const dynamic = 'force-dynamic';

/** /account goes to the Orders tab (a guest goes to sign-in first). */
export default async function AccountIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/orders');
  redirect({ href: '/account/orders', locale });
}
