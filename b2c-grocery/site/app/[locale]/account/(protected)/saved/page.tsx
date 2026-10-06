import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SavedView } from '@/components/account/SavedView';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.saved' });
  return { title: t('metaTitle') };
}

/** Guarded by the `(protected)` layout. Server page, client island: the list lives in SWR (`/api/account/wishlist/*`). */
export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SavedView />;
}
