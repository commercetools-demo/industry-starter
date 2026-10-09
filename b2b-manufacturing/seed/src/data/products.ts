import type { ProductDraft, ProductUpdateAction } from '@commercetools/platform-sdk';
import { KEYS } from './catalog';
import { CURRENCIES, ls } from './locales';
import { SERVICES_DE } from './services.de';
import { SERVICES, serviceKey, serviceSku, type ServiceDef } from './services';

/** A service variant carries one 0 price per launch currency (USD, EUR): a line item needs a price matching the cart currency, the real price comes from the Quote (D12). */
export const zeroPrices = () => CURRENCIES.map((currencyCode) => ({ value: { currencyCode, centAmount: 0 } }));

/** A previously picked image set (clean URLs only). */
export interface PickedImage {
  url: string;
  dimensions: { w: number; h: number };
}

export function buildProductDraft(def: ServiceDef, images: PickedImage[] = []): ProductDraft {
  const de = SERVICES_DE[def.slug];
  if (!de) throw new Error(`no German copy for ${def.slug}`);
  const order = SERVICES.findIndex((s) => s.slug === def.slug) + 1;
  const categoryKey = def.category === 'plumbing' ? KEYS.categoryPlumbing : KEYS.categoryWaste;
  return {
    key: serviceKey(def.slug),
    productType: { typeId: 'product-type', key: KEYS.serviceType },
    name: ls(def.name, de.name),
    slug: ls(def.slug),
    description: ls(def.summary, de.summary),
    metaTitle: ls(`${def.name} | Malva`, `${de.name} | Malva`),
    metaDescription: ls(def.summary, de.summary),
    categories: [{ typeId: 'category', key: categoryKey }],
    taxCategory: { typeId: 'tax-category', key: KEYS.taxCategory },
    masterVariant: {
      key: serviceSku(def.slug),
      sku: serviceSku(def.slug),
      prices: zeroPrices(),
      images,
      attributes: [
        { name: 'summary', value: ls(def.summary, de.summary) },
        { name: 'sectors', value: def.sectors },
        { name: 'frequencies', value: def.frequencies },
        { name: 'included', value: def.included.map((t, i) => ls(t, de.included[i])) },
        { name: 'steps', value: def.steps.map((t, i) => ls(t, de.steps[i])) },
        { name: 'records', value: def.records.map((t, i) => ls(t, de.records[i])) },
        { name: 'faq', value: def.faq.map((f, i) => [{ name: 'question', value: ls(f.question, de.faq[i]?.question) }, { name: 'answer', value: ls(f.answer, de.faq[i]?.answer) }]) },
        { name: 'needs-waste-details', value: def.needsWasteDetails },
        { name: 'display-order', value: order },
      ],
    },
    publish: true,
  };
}

/**
 * Reference attributes need product ids, so `related` is set in a second pass once every product exists.
 * Returns the update actions for one product (empty when it has no relations).
 */
export function buildRelatedActions(def: ServiceDef, idsBySlug: Record<string, string>): ProductUpdateAction[] {
  const refs = def.related.filter((slug) => slug !== def.slug).map((slug) => idsBySlug[slug]).filter((id): id is string => Boolean(id)).map((id) => ({ typeId: 'product' as const, id }));
  if (refs.length === 0) return [];
  return [{ action: 'setAttribute', variantId: 1, name: 'related', value: refs, staged: false }];
}
