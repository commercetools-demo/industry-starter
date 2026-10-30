import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import InstoreCategory from '@/components/instore/InstoreCategory';
import { redirect } from '@/i18n/routing';
import { isInstore } from '@/lib/app-mode';
import { instoreCategoryName, loadInstoreCategory } from '@/lib/instore/category';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Stock and prices are read per request. */
export const dynamic = 'force-dynamic';

const decode = (v: string) => {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isInstore()) return {};
  const name = await instoreCategoryName(locale, decode(slug));
  return { title: name ?? (await getTranslations({ locale, namespace: 'instore' }))('meta.title'), robots: { index: false, follow: false } };
}

/**
 * `/[locale]/c/<slug>`: the In-store companion's category page (workstream R, D-049). In the website mode this route does not
 * exist (404): the website's category page is `/category/<slug>`.
 */
export default async function InstoreCategoryRoute({ params, searchParams }: Props) {
  if (!isInstore()) notFound();
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = (await searchParams).page;
  const view = await loadInstoreCategory(locale, decode(slug), Array.isArray(page) ? page[0] : page);
  if (view.redirectToPage) {
    redirect({ href: `/c/${encodeURIComponent(view.category.slug)}${view.redirectToPage > 1 ? `?page=${view.redirectToPage}` : ''}`, locale });
  }
  return <InstoreCategory view={view} rootKey={view.rootKey} />;
}
