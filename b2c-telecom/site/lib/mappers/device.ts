import 'server-only';
// Offer (kind device) -> DeviceOffer: the handset as one offer with color x memory variants and, per variant, the outright price and
// the monthly amount of each installment term and the lease. No I/O; `policyKeyById` comes from `getDevicePolicyMap` (lib/ct/devices).
import { modeOfPolicyKey } from '@/lib/devices/acquisition';
import type { DeviceOffer, DevicePrices, DeviceVariant, Offer, OfferVariant } from '@/lib/types';

export type PolicyKeyById = Readonly<Record<string, string>>;

/** The prices of one variant: the outright price and every financed price whose policy is a device policy. Other policies are ignored. */
export function devicePricesOf(variant: OfferVariant, policyKeyById: PolicyKeyById): DevicePrices {
  const prices: DevicePrices = { installments: {}, lease: {}, ...(variant.oneTimePrice ? { outright: variant.oneTimePrice } : {}) };
  for (const option of variant.financedOptions ?? []) {
    const parsed = modeOfPolicyKey(policyKeyById[option.policyId] ?? '');
    if (!parsed) continue;
    if (parsed.mode === 'installments') prices.installments[parsed.termMonths as 12 | 24 | 36] = option.amount;
    else prices.lease[24] = option.amount;
  }
  return prices;
}

/** `null` when the offer is not a device. Variants without a color or a numeric memory are dropped (the data is incomplete). */
export function mapDeviceOffer(offer: Offer, policyKeyById: PolicyKeyById): DeviceOffer | null {
  if (offer.kind !== 'device') return null;
  const variants: DeviceVariant[] = offer.variants.flatMap((variant) => {
    const color = variant.attributes.color;
    const memoryGb = Number(variant.attributes['memory-gb']);
    if (typeof color !== 'string' || !Number.isFinite(memoryGb)) return [];
    return [{ sku: variant.sku, color, memoryGb, prices: devicePricesOf(variant, policyKeyById), ...(variant.availableQuantity !== undefined ? { availableQuantity: variant.availableQuantity } : {}) }];
  });
  const colors = [...new Set(variants.map((variant) => variant.color))];
  const memories = [...new Set(variants.map((variant) => variant.memoryGb))].sort((a, b) => a - b);
  return { key: offer.key, name: offer.name, description: offer.description, ...(offer.image ? { image: offer.image } : {}), colors, memories, variants };
}
