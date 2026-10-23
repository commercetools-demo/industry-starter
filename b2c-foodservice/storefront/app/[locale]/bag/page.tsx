import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import InstoreBag from '@/components/instore/InstoreBag';
import { isInstore } from '@/lib/app-mode';
import { loadCart } from '@/lib/cart/load';

/** The bag is per person and changes on every write: rendered per request, never cached, never indexed. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'instore.bag' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * `/[locale]/bag`: the In-store companion's bag (workstream R, D-049). The server reads it once (`loadCart`, the same read as the
 * website's cart page) and passes it as `initialCart`, so the page paints with its lines. In the website mode this route does not
 * exist (404): the website's bag is `/cart`.
 */
export default async function BagRoute({ params }: { params: Promise<{ locale: string }> }) {
  if (!isInstore()) notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const initialCart = await loadCart(locale);
  return <InstoreBag {...(initialCart === undefined ? {} : { initialCart })} />;
}
