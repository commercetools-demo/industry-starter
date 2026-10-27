import { getTranslations } from 'next-intl/server';
import Breadcrumbs, { type Crumb } from '@/components/listing/Breadcrumbs';
import RatingSummary from '@/components/pdp/RatingSummary';
import ReviewsSlot from '@/components/pdp/ReviewsSlot';
import { requestProduct } from '@/lib/pdp/request-product';

/** Product page parts that need the product on the server. Off a product page they render nothing. */

export async function ProductBreadcrumbsBlock() {
  const data = requestProduct();
  if (!data) return null;
  const t = await getTranslations('pdp');
  const { product } = data;
  const crumbs: Crumb[] = [
    { label: t('breadcrumb.home'), href: '/' },
    ...product.breadcrumb.map((c) => ({ label: c.name, href: `/category/${encodeURIComponent(c.slug)}` })),
    { label: product.name },
  ];
  return <Breadcrumbs items={crumbs} />;
}

export function RatingSummaryBlock() {
  const data = requestProduct();
  return data ? <RatingSummary rating={data.product.rating} /> : null;
}

export function ReviewsBlock() {
  const data = requestProduct();
  if (!data) return null;
  const { product } = data;
  return <ReviewsSlot productId={product.id} productSlug={product.slug} sku={product.defaultSku} productName={product.name} stats={product.rating} />;
}
