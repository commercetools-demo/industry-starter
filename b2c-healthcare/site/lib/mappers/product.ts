import type { ProductProjection } from '@commercetools/platform-sdk';
import type { ProductBasics } from '@/lib/types';
import { mapLocalizedString } from '@/lib/mappers';

/** Minimal product shape shared by page and metadata; richer types live in doctor.ts / medication.ts. */
export function mapProductBasics(projection: ProductProjection): ProductBasics {
  const variant = projection.masterVariant;
  return {
    id: projection.id,
    key: projection.key ?? projection.id,
    productTypeId: projection.productType.id,
    name: mapLocalizedString(projection.name),
    slug: mapLocalizedString(projection.slug),
    description: mapLocalizedString(projection.description),
    sku: variant.sku ?? null,
    imageUrls: (variant.images ?? []).map((image) => image.url),
    categoryIds: projection.categories.map((c) => c.id),
  };
}
