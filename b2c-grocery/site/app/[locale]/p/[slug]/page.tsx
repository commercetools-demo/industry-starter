import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/routing';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/layout/Container';
import { Breadcrumbs } from '@/components/product/Breadcrumbs';
import { BuyBox } from '@/components/product/BuyBox';
import { ProductGallery } from '@/components/product/ProductGallery';
import { RelatedProducts, RELATED_MAX } from '@/components/product/RelatedProducts';
import { Reviews } from '@/components/product/Reviews';
import { getCategoryTree } from '@/lib/ct/categories';
import { getProductBySlug, searchProducts } from '@/lib/ct/search';
import { buildSelectors, pickVariant } from '@/lib/config/variant-config';
import { findCategoryById } from '@/lib/listing-view';
import { marketFor } from '@/lib/market';
import type { Category, Product } from '@/lib/types';

type PageProps = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ sku?: string | string[] }> };

const DESCRIPTION_LENGTH = 160;

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const [market, t] = await Promise.all([marketFor(locale), getTranslations({ locale, namespace: 'common' })]);
  const product = await getProductBySlug(decodeSlug(slug), market);
  if (!product) return {};
  const image = pickVariant(product)?.images[0];
  const title = `${product.name} · ${t('brand')}`;
  const description = product.description.slice(0, DESCRIPTION_LENGTH);
  return {
    title,
    ...(description ? { description } : {}),
    openGraph: { title, ...(description ? { description } : {}), ...(image ? { images: [image] } : {}) },
  };
}

/**
 * Server-rendered product page. The product comes from the React-cached lookup shared with `generateMetadata`; the
 * category tree and the related products then load in parallel. Related products are decoration: a failing search
 * leaves the section out instead of failing the page.
 */
export default async function ProductPage({ params, searchParams }: PageProps) {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const market = await marketFor(locale);
  const product = await getProductBySlug(decodeSlug(slug), market);
  if (!product) notFound();
  // A slug from another locale (e.g. after a locale switch) resolves, then redirects to this locale's canonical slug.
  if (product.slug !== decodeSlug(slug)) {
    const sku = Array.isArray(sp.sku) ? sp.sku[0] : sp.sku;
    redirect({ href: `/p/${encodeURIComponent(product.slug)}${sku ? `?sku=${encodeURIComponent(sku)}` : ''}`, locale });
  }

  const categoryId = product.categoryIds[0];
  const [tree, related] = await Promise.all([
    getCategoryTree(locale).catch((): Category[] => []),
    categoryId
      ? searchProducts({ ...market, categoryId, pageSize: RELATED_MAX + 1 }).then(
          (result) => result.products,
          (): Product[] => [],
        )
      : Promise.resolve<Product[]>([]),
  ]);

  const sku = Array.isArray(sp.sku) ? sp.sku[0] : sp.sku;
  const variant = pickVariant(product, sku);
  if (!variant) notFound();
  const category = categoryId ? findCategoryById(tree, categoryId) : undefined;
  const images = variant.images.length > 0 ? variant.images : (product.variants[0]?.images ?? []);

  return (
    <Container className="pt-[35px] pb-(--space-8)">
      <Breadcrumbs category={category?.name} categoryHref={category ? `/shop?category=${encodeURIComponent(category.slug)}` : undefined} current={product.name} />
      <div className="mt-(--space-5) grid items-start gap-(--space-6) desktop:grid-cols-[1.15fr_1fr] desktop:gap-[49px]">
        <ProductGallery images={images} name={product.name} />
        <BuyBox
          product={product}
          variant={variant}
          selectors={buildSelectors(product, variant.sku)}
          categoryName={category?.name}
          className="desktop:sticky desktop:top-[110px]"
        />
      </div>
      <Reviews product={product} />
      <RelatedProducts products={related} currentId={product.id} />
    </Container>
  );
}
