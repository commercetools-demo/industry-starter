import 'server-only';
import type { Cart as CtCart, ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import { nudgeTarget } from '@/lib/cart/summary';
import { getAttributeLabels } from '@/lib/ct/attribute-labels';
import { getStoresForCountry } from '@/lib/ct/channels';
import { apiRoot } from '@/lib/ct/client';
import { getInventoryDetail } from '@/lib/ct/inventory';
import { getRecurrencePolicies } from '@/lib/ct/product-detail';
import { getFreeShippingThreshold } from '@/lib/ct/shipping';
import { mapAttributes } from '@/lib/mappers/attribute';
import type { AttributeLabels } from '@/lib/mappers/attribute-labels';
import { EMPTY_ENRICHMENT, fulfilmentOf, type CartEnrichment, type EnrichedProduct, type EnrichedVariant } from '@/lib/mappers/cart';
import { mapMoney } from '@/lib/mappers/money';
import { ATTRIBUTE_BLOCKLIST, shapeOf } from '@/lib/product/variant-config';
import { getCompatibleCapsules } from '@/lib/related';
import type { AttributeValue, VariantAttrValue } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

export interface EnrichContext {
  locale: string;
  country: string;
  currency: string;
  /** The shopper's chosen collection store (session), for the Collect chip state of ship lines. */
  sessionStoreKey?: string;
}

const isEnum = (v: AttributeValue): v is { key: string; label: string } => typeof v === 'object' && v !== null && !Array.isArray(v);

function flatten(attrs: Record<string, AttributeValue>, labels: AttributeLabels): { attrs: Record<string, VariantAttrValue>; labels: Record<string, string> } {
  const out: Record<string, VariantAttrValue> = {};
  const outLabels: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (ATTRIBUTE_BLOCKLIST.includes(name)) continue;
    if (isEnum(value)) {
      out[name] = value.key;
      outLabels[name] = labels[name]?.[value.key] ?? value.label;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[name] = value;
    }
  }
  return { attrs: out, labels: outLabels };
}

const keyOf = (v: AttributeValue | undefined): string | undefined => (v && isEnum(v) ? v.key : typeof v === 'string' ? v : undefined);

function mapProduct(p: ProductProjection, ctx: EnrichContext, labels: AttributeLabels): EnrichedProduct {
  const productAttrs = mapAttributes(p.attributes, ctx.locale);
  const variants: Record<string, EnrichedVariant> = {};
  for (const v of [p.masterVariant, ...p.variants] as ProductVariant[]) {
    if (!v.sku) continue;
    const merged = flatten({ ...productAttrs, ...mapAttributes(v.attributes, ctx.locale) }, labels);
    const price = v.price;
    variants[v.sku] = {
      ...merged,
      ...(price ? { currentPrice: mapMoney(price.discounted?.value ?? price.value) } : {}),
    };
  }
  const master = mapAttributes(p.masterVariant.attributes, ctx.locale);
  const system = keyOf(productAttrs.system ?? master.system);
  return { shape: shapeOf(p.productType.obj?.key), ...(system ? { systemKey: system } : {}), variants };
}

async function readProducts(ids: string[], ctx: EnrichContext, labels: AttributeLabels): Promise<Record<string, EnrichedProduct>> {
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `id in (${ids.map((id) => `"${id}"`).join(', ')})`,
        staged: false,
        priceCurrency: ctx.currency,
        priceCountry: ctx.country,
        localeProjection: [ctx.locale],
        expand: ['productType'],
        limit: Math.min(ids.length, 500),
      },
    })
    .execute();
  const out: Record<string, EnrichedProduct> = {};
  for (const p of body.results) out[p.id] = mapProduct(p, ctx, labels);
  return out;
}

/**
 * The reads a cart view needs beyond the cart (workstream I, 3.3): ONE projection read for the distinct products (attributes,
 * product type, the price the shopper would get now), ONE inventory read for the SKUs, the market's stores, the free-shipping
 * threshold and the recurrence policies, all in parallel. An empty cart makes no call. Each part fails alone: a failed
 * inventory read means no stock flags (never a failed cart), a failed projection read means no variant summaries.
 */
export async function getCartEnrichment(cart: CtCart, ctx: EnrichContext): Promise<CartEnrichment> {
  if (cart.lineItems.length === 0) return EMPTY_ENRICHMENT;
  const productIds = [...new Set(cart.lineItems.map((l) => l.productId))];
  const skus = [...new Set(cart.lineItems.map((l) => l.variant?.sku).filter((s): s is string => Boolean(s)))];
  const hasSubscribe = cart.lineItems.some((l) => fulfilmentOf(l) === 'subscribe');

  const [labels, inventory, stores, threshold, policies] = await Promise.all([
    getAttributeLabels(ctx.locale).catch((): AttributeLabels => ({})),
    getInventoryDetail(skus).catch(() => null),
    getStoresForCountry(ctx.country, ctx.locale).catch(() => []),
    getFreeShippingThreshold(ctx.country, ctx.currency).catch(() => null),
    hasSubscribe ? getRecurrencePolicies(ctx.locale).catch(() => []) : Promise.resolve([]),
  ]);
  const products = await readProducts(productIds, ctx, labels).catch((): Record<string, EnrichedProduct> => ({}));

  const target = nudgeTarget(
    cart.lineItems.map((l) => ({
      shape: products[l.productId]?.shape,
      systemKey: products[l.productId]?.systemKey,
      name: getLocalizedString(l.name, ctx.locale),
    })),
  );
  let nudge: CartEnrichment['nudge'] = null;
  if (target) {
    const storeChannelId = stores.find((s) => s.key === ctx.sessionStoreKey)?.id;
    const capsules = await getCompatibleCapsules(
      { shape: 'machine', systemKey: target.systemKey },
      { locale: ctx.locale, country: ctx.country, currency: ctx.currency, ...(storeChannelId ? { storeChannelId } : {}) },
    ).catch(() => []);
    const first = capsules.find((c) => c.price !== null);
    if (first?.price) nudge = { sku: first.sku, name: first.name, price: first.price.from, machineName: target.machineName };
  }

  return {
    products, inventory, stores, ...(ctx.sessionStoreKey ? { sessionStoreKey: ctx.sessionStoreKey } : {}), threshold,
    policies: Object.fromEntries(policies.map((p) => [p.id, p.schedule])),
    nudge,
  };
}
