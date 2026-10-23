import type { ProductVariant } from '@commercetools/platform-sdk';
import type { Variant } from '@/lib/types';
import { mapAttributes } from '@/lib/mappers/attribute';
import { mapImages } from '@/lib/mappers/image';
import { pickPrice } from '@/lib/mappers/price';

export type MapContext = { locale: string; country: string; currency: string };

export function mapVariant(v: ProductVariant, ctx: MapContext, alt = ''): Variant {
  const out: Variant = {
    id: v.id,
    sku: v.sku ?? '',
    images: mapImages(v.images, alt),
    attributes: mapAttributes(v.attributes, ctx.locale),
  };
  const price = pickPrice(v, ctx);
  if (price) out.price = price;
  if (v.availability && v.availability.isOnStock !== undefined) {
    out.availability = { isOnStock: v.availability.isOnStock };
    if (v.availability.availableQuantity !== undefined) {
      out.availability.availableQuantity = v.availability.availableQuantity;
    }
  }
  return out;
}
