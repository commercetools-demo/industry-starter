// The two handset offers as the catalog read produces them (kind device, variants with outright and financed prices), built from the
// DeviceOffer fixtures so both stay in step. Policy ids are the fixed test ids of POLICY_IDS.
import type { DeviceOffer, DeviceVariant, Offer, OfferVariant } from '@/lib/types';
import { NOVA_5G, NOVA_PRO } from './devices';

export const POLICY_IDS = {
  'malva-device-installment-12': 'pol-12',
  'malva-device-installment-24': 'pol-24',
  'malva-device-installment-36': 'pol-36',
  'malva-device-lease-24': 'pol-lease',
} as const;
export const POLICY_KEY_BY_ID: Record<string, string> = Object.fromEntries(Object.entries(POLICY_IDS).map(([key, id]) => [id, key]));

function variantOf(variant: DeviceVariant, index: number): OfferVariant {
  const options = [
    ...([12, 24, 36] as const).flatMap((term) => (variant.prices.installments[term] ? [{ policyId: POLICY_IDS[`malva-device-installment-${term}`], amount: variant.prices.installments[term] }] : [])),
    ...(variant.prices.lease[24] ? [{ policyId: POLICY_IDS['malva-device-lease-24'], amount: variant.prices.lease[24] }] : []),
  ];
  return {
    id: index + 1,
    sku: variant.sku,
    isMaster: index === 0,
    term: 'month-to-month',
    termMonths: 0,
    ...(variant.prices.outright ? { oneTimePrice: variant.prices.outright } : {}),
    financedPrices: options.map((option) => option.amount).sort((a, b) => a.centAmount - b.centAmount),
    financedOptions: options,
    ...(variant.availableQuantity !== undefined ? { availableQuantity: variant.availableQuantity } : {}),
    images: [],
    attributes: { color: variant.color, 'memory-gb': String(variant.memoryGb) },
  };
}

export function offerOf(device: DeviceOffer): Offer {
  const variants = device.variants.map(variantOf);
  return {
    id: `id-${device.key}`,
    key: device.key,
    kind: 'device',
    name: device.name,
    slug: device.key.replace('malva-offer-', ''),
    description: device.description,
    categoryKeys: ['malva-cat-devices'],
    primaryCategoryKey: 'malva-cat-devices',
    anchors: [device.key.replace('malva-offer-', 'malva-')],
    facts: { kind: 'device', compatiblePlanFamilies: ['phone'] },
    includedOffers: [],
    compatibleAddons: [],
    compatibleEquipment: [],
    conflictsWith: [],
    audience: [],
    existingCustomer: 'any',
    channels: [],
    variants,
    headline: { ...(variants[0]?.oneTimePrice ? { oneTime: variants[0].oneTimePrice } : {}), term: 'month-to-month', termMonths: 0 },
  };
}

export const NOVA_5G_OFFER: Offer = offerOf(NOVA_5G);
export const NOVA_PRO_OFFER: Offer = offerOf(NOVA_PRO);
