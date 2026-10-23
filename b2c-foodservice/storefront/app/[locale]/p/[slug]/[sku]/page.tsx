import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import ProductDetail from '@/components/pdp/ProductDetail';
import RelatedStrip from '@/components/pdp/RelatedStrip';
import { permanentRedirect } from '@/i18n/routing';
import { pageMetadata } from '@/lib/content/seo';
import { loadProductPage } from '@/lib/pdp/load';
import { parseChoose, parseSelection } from '@/lib/product/selection';

type Props = {
  params: Promise<{ locale: string; slug: string; sku: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Selection, quantity and prices depend on the request: the route is always rendered per request. */
export const dynamic = 'force-dynamic';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const productPath = (slug: string, sku: string) => `/p/${encodeURIComponent(slug)}/${encodeURIComponent(sku)}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, sku: rawSku } = await params;
  const sku = safeDecode(rawSku);
  const data = await loadProductPage(sku, locale); // the same cached load the page uses
  if (!data) return {};
  const { product } = data;
  const image = product.variants.find((v) => v.sku === sku)?.images[0] ?? product.variants[0]?.images[0];
  return pageMetadata({
    locale,
    path: productPath(product.slug, sku),
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? product.description ?? product.name,
    ...(image ? { openGraph: { type: 'website' as const, images: [{ url: image.url }] } } : {}),
  });
}

/**
 * `/[locale]/p/[slug]/[sku]`: the SKU identifies the product (lookup is always by SKU) and is the landing variant; the
 * slug is cosmetic, and a slug that is not the product's own is redirected permanently to the canonical URL, keeping the
 * query. The selection (`?capsulesPerPack=50&grind=filter`) and `?choose=<attr>` come from the query string.
 */
export default async function ProductPage({ params, searchParams }: Props) {
  const { locale, slug: rawSlug, sku: rawSku } = await params;
  setRequestLocale(locale);
  const sku = safeDecode(rawSku);
  const data = await loadProductPage(sku, locale);
  if (!data) notFound();

  const query = await searchParams;
  if (safeDecode(rawSlug) !== data.product.slug) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) sp.append(k, one);
    const qs = sp.toString();
    permanentRedirect({ href: `${productPath(data.product.slug, sku)}${qs ? `?${qs}` : ''}`, locale });
  }

  const landing = data.product.variants.find((v) => v.sku === sku);
  const choose = parseChoose(query, data.product.selectors);
  return (
    <ProductDetail
      data={data}
      related={
        <Suspense fallback={null}>
          <RelatedStrip product={data.product} locale={locale} />
        </Suspense>
      }
      initialSelection={parseSelection(query, data.product.selectors, landing)}
      {...(choose ? { choose } : {})}
    />
  );
}
