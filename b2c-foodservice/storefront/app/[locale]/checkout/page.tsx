import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import CheckoutPage from '@/components/checkout/CheckoutPage';
import { isInstore } from '@/lib/app-mode';

/** The checkout is per person and changes with every write: rendered per request, never cached, never indexed. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * `/[locale]/checkout`: Review (ours) then Pay (the complete hosted Checkout). `?resume=1&part=<n>` is where a redirect payment of
 * one part of a mixed purchase returns to continue with the next payment.
 */
export default async function CheckoutRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ resume?: string; part?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { resume, part } = await searchParams;
  const n = Number(part);
  const resumePart = resume === '1' && Number.isInteger(n) && n >= 0 && n < 8 ? n : undefined;
  return <CheckoutPage {...(resumePart === undefined ? {} : { resumePart })} {...(isInstore() ? { instore: true } : {})} />;
}
