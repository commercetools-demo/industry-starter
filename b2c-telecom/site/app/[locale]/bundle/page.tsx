import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BundleView } from '@/components/bundle/BundleView';
import type { EmptyBundleLink } from '@/components/bundle/EmptyBundle';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { isLocale, marketFromLocale } from '@/lib/config/markets';
import { readBundle } from '@/lib/ct/bundle';
import { getSession } from '@/lib/ct/session';
import { loadNavItems } from '../_shell/loadNavItems';

// "My bundle": the only server-rendered page that reads the cart (the layout does not, so the site stays cacheable where it can).
// The cart is passed to the client as the SWR fallback so the page never flashes the empty state.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'bundle' });
  return { title: t('title'), robots: { index: false } };
}

const CATEGORY_OF: Record<EmptyBundleLink['key'], string> = {
  phone: 'malva-cat-phone-plans',
  wireless: 'malva-cat-home-wireless',
  cable: 'malva-cat-cable-internet',
};

export default async function BundlePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('bundle');
  const session = await getSession();

  let initialCart = null;
  try {
    initialCart = (await readBundle(session, marketFromLocale(locale))).cart;
  } catch (error) {
    // A cart outage must not take the page down: the client asks again and shows the error toast if it still fails.
    console.error('[bundle] cart unavailable', error);
  }

  const items = await loadNavItems(locale);
  const links: EmptyBundleLink[] = (Object.keys(CATEGORY_OF) as EmptyBundleLink['key'][]).flatMap((key) => {
    const item = items.find((candidate) => candidate.key === CATEGORY_OF[key]);
    return item ? [{ key, href: item.path }] : [];
  });

  return (
    <>
      <section className="bg-brand-100 py-10 md:py-12">
        <div className="mx-auto w-full max-w-(--container-width) px-5 md:px-10">
          <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title') }]} />
          <h1 className="mb-2 mt-3 font-display text-5xl font-bold tracking-ui">{t('title')}</h1>
        </div>
      </section>
      <section aria-label={t('title')} className="mx-auto w-full max-w-(--container-width) px-5 pb-16 pt-8 md:px-10">
        <BundleView initialCart={initialCart} signedIn={Boolean(session.customerId)} links={links} />
      </section>
    </>
  );
}
