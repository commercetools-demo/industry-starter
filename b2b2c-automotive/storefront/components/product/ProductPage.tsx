// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The product page (workstream M, design view `pdp`): breadcrumb, gallery, identity and buy box, description, specifications and
// compatible vehicles in one panel, "Often bought together", reviews and the JSON-LD. Server component: it composes the leaves.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/product/detail/Breadcrumb';
import { CompatibleVehicles } from '@/components/product/detail/CompatibleVehicles';
import { Description } from '@/components/product/detail/Description';
import { Gallery } from '@/components/product/detail/Gallery';
import { Identity } from '@/components/product/detail/Identity';
import { PdpBuyBox } from '@/components/product/detail/PdpBuyBox';
import { ProductReviews } from '@/components/product/detail/ProductReviews';
import { RelatedItems } from '@/components/product/detail/RelatedItems';
import { Specifications } from '@/components/product/detail/Specifications';
import type { AppLocale } from '@/i18n/config';
import { buildProductJsonLd, serializeJsonLd } from '@/lib/product/json-ld';
import { getProductPage } from '@/lib/product/load';
import { requestOrigin } from '@/lib/product/origin';

export interface ProductPageProps {
  locale: AppLocale;
  store: string;
  slug: string;
  sku?: string;
}

export async function ProductPage({ locale, store, slug, sku }: ProductPageProps) {
  setRequestLocale(locale);
  const view = await getProductPage({ storeKey: store, locale, slug, sku });
  if (view.kind !== 'ok') notFound();
  const { product } = view;
  const origin = await requestOrigin();
  const url = `${origin ?? ''}/${locale}/${store}/p/${product.slug}`;

  return (
    <div className="mx-auto grid max-w-content gap-6 p-4 min-[64rem]:p-5">
      <Breadcrumb store={store} trail={product.categoryTrail} name={product.name} />
      <div className="grid items-start gap-6 min-[42.5rem]:grid-cols-2 min-[64rem]:gap-7">
        <Gallery images={product.images} />
        <div className="grid content-start gap-4">
          <Identity name={product.name} brand={product.brand} qualityLabel={product.qualityLabel} partNumber={product.partNumber} rating={product.rating} />
          <PdpBuyBox
            product={product}
            branch={view.branch}
            canChangeStore={view.canChangeStore}
            shipDays={view.shipDays}
            store={store}
            returnDays={view.returnDays}
            sellerName={view.sellerName}
            subscriptionsEnabled={view.subscriptionsEnabled}
            alternativesHref={view.alternativesHref}
          />
        </div>
      </div>
      <Description description={product.description} />
      <section className="grid gap-6 rounded-md border border-border bg-surface p-5 min-[42.5rem]:grid-cols-2">
        <Specifications specs={product.specs} />
        <CompatibleVehicles fitmentKeys={product.fitmentKeys} universalFit={product.universalFit} />
      </section>
      <RelatedItems products={view.related} store={store} />
      <ProductReviews productId={product.id} store={store} storeName={view.sellerName} rating={product.rating} reviews={view.reviews} form={view.reviewForm} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildProductJsonLd(product, url)) }} />
    </div>
  );
}
