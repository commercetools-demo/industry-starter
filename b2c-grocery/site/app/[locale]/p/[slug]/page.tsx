import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/layout/Container';
import { PriceBlock } from '@/components/product/PriceBlock';
import { Tag } from '@/components/ui/Tag';
import { getProductBySlug } from '@/lib/ct/search';
import { marketFor } from '@/lib/market';
import { pickVariant } from '@/lib/config/variant-config';

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

/** Server-rendered product page. The product comes from the React-cached lookup shared with `generateMetadata`. */
export default async function ProductPage({ params, searchParams }: PageProps) {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const market = await marketFor(locale);
  const product = await getProductBySlug(decodeSlug(slug), market);
  if (!product) notFound();

  const sku = Array.isArray(sp.sku) ? sp.sku[0] : sp.sku;
  const variant = pickVariant(product, sku);

  return (
    <Container className="pt-[35px] pb-(--space-8)">
      <h1>{product.name}</h1>
      {variant ? <Tag>{variant.sku}</Tag> : null}
      <PriceBlock price={variant?.price} />
    </Container>
  );
}
