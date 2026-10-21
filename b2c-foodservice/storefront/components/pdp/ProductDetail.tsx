import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from '@/components/listing/Breadcrumbs';
import BuyBox from '@/components/pdp/BuyBox';
import Gallery from '@/components/pdp/Gallery';
import RatingSummary from '@/components/pdp/RatingSummary';
import ReviewsSlot from '@/components/pdp/ReviewsSlot';
import { PdpProvider } from '@/components/pdp/pdp-state';
import type { Selection } from '@/lib/product/resolve-variant';
import type { ProductPageData } from '@/lib/types';

/**
 * Page composition (workstream H, 3.5). The DOM order is the mobile order: breadcrumb, gallery, buy box, rating summary,
 * reviews slot, related products. From 900 px the gallery and the buy box sit side by side (1.05fr and 0.95fr, 48 px gap).
 * Does not render a `<main>`: the locale layout owns it. `related` is a server-rendered strip passed in by the route.
 */
export default function ProductDetail({
  data,
  initialSelection,
  choose,
  related,
}: {
  data: ProductPageData;
  initialSelection: Selection;
  choose?: string;
  related?: ReactNode;
}) {
  const t = useTranslations('pdp');
  const { product } = data;
  const crumbs: Crumb[] = [
    { label: t('breadcrumb.home'), href: '/' },
    ...product.breadcrumb.map((c) => ({ label: c.name, href: `/category/${encodeURIComponent(c.slug)}` })),
    { label: product.name },
  ];
  return (
    <div className="wrap pb-16 pt-3.5" data-testid="product-detail">
      <Breadcrumbs items={crumbs} />
      <PdpProvider data={data} initialSelection={initialSelection} {...(choose ? { choose } : {})}>
        <div className="mt-3.5 grid gap-x-12 gap-y-8 stack:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Gallery />
          <BuyBox />
        </div>
      </PdpProvider>
      <RatingSummary rating={product.rating} />
      <ReviewsSlot productId={product.id} productSlug={product.slug} sku={product.defaultSku} productName={product.name} stats={product.rating} />
      {related}
    </div>
  );
}
