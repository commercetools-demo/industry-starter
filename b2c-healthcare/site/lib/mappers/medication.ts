import type { Price, ProductProjection } from '@commercetools/platform-sdk';
import type { Medication, Money } from '@/lib/types';
import { attrBoolean, attrEnumKey, attrNumber, attrText, findAttribute } from '@/lib/mappers/attributes';
import { getLocalizedString } from '@/lib/utils';

export interface MedicationMapOptions {
  locale: string;
  currency: string;
}

/** Pack price: the channel-less price in the visitor's currency (the selected `price` wins when present). */
function packPrice(projection: ProductProjection, currency: string): Money | null {
  const variant = projection.masterVariant;
  const candidates: Price[] = [...(variant.price ? [variant.price] : []), ...(variant.prices ?? [])];
  const price = candidates.find((p) => p.value.currencyCode === currency && !p.channel);
  if (!price) return null;
  return {
    centAmount: price.value.centAmount,
    currencyCode: price.value.currencyCode,
    fractionDigits: price.value.fractionDigits,
  };
}

export function mapMedication(projection: ProductProjection, options: MedicationMapOptions): Medication {
  const { locale, currency } = options;
  const variant = projection.masterVariant;
  const attributes = variant.attributes;
  const controlClass = attrEnumKey(findAttribute(attributes, 'controlClass'));
  const price = packPrice(projection, currency);
  return {
    id: projection.id,
    key: projection.key ?? projection.id,
    slug: getLocalizedString(projection.slug, locale),
    name: getLocalizedString(projection.name, locale),
    description: getLocalizedString(projection.description, locale),
    sku: variant.sku ?? null,
    strength: attrText(findAttribute(attributes, 'strength'), locale),
    dosageForm: attrText(findAttribute(attributes, 'dosageForm'), locale),
    rxOnly: attrBoolean(findAttribute(attributes, 'rxOnly')),
    dispenseUnit: attrText(findAttribute(attributes, 'dispenseUnit'), locale),
    minRemainingShelfLifeDays: attrNumber(findAttribute(attributes, 'minRemainingShelfLifeDays')),
    maxQtyPerOrder: attrNumber(findAttribute(attributes, 'maxQtyPerOrder')),
    hsaEligible: attrBoolean(findAttribute(attributes, 'hsaEligible')),
    controlClass: controlClass.length > 0 && controlClass !== 'none' ? controlClass : null,
    price,
    sellableInRegion: price !== null,
    imageUrl: variant.images?.[0]?.url ?? null,
    categoryIds: projection.categories.map((c) => c.id),
  };
}
