import type { ProductProjection } from '@commercetools/platform-sdk';
import type { Product } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';
import { mapAttributes } from '@/lib/mappers/attribute';
import { mapRatingStats } from '@/lib/mappers/rating';
import { mapVariant, type MapContext } from '@/lib/mappers/variant';

export type { MapContext };

export function mapProduct(p: ProductProjection, ctx: MapContext): Product {
  const name = getLocalizedString(p.name, ctx.locale);
  const master = mapVariant(p.masterVariant, ctx, name);
  const product: Product = {
    id: p.id,
    slug: getLocalizedString(p.slug, ctx.locale),
    name,
    categoryIds: p.categories.map((c) => c.id),
    masterVariant: master,
    variants: p.variants.map((v) => mapVariant(v, ctx, name)),
    // product-level attributes win over master variant values
    attributes: { ...master.attributes, ...mapAttributes(p.attributes, ctx.locale) },
  };
  if (p.key) product.key = p.key;
  if (p.description) product.description = getLocalizedString(p.description, ctx.locale);
  const typeKey = p.productType.obj?.key;
  if (typeKey) product.productTypeKey = typeKey;
  const rating = mapRatingStats(p.reviewRatingStatistics);
  if (rating) product.rating = rating;
  return product;
}
