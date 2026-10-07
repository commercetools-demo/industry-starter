// Fixtures of workstream Q: the USD prices of the plan's table and the two handset offers built from them.
import type { CartLine, DeviceOffer, DevicePrices, LineAcquisition, Money } from '@/lib/types';

export const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
export const eur = (centAmount: number): Money => ({ centAmount, currencyCode: 'EUR' });

/** Nova Pro 256 GB, USD: outright 100800, installments 8400 / 4200 / 2800, lease 3300. */
export const NOVA_PRO_256: DevicePrices = {
  outright: usd(100800),
  installments: { 12: usd(8400), 24: usd(4200), 36: usd(2800) },
  lease: { 24: usd(3300) },
};
/** Nova Pro 512 GB, USD. */
export const NOVA_PRO_512: DevicePrices = {
  outright: usd(118800),
  installments: { 12: usd(9900), 24: usd(4950), 36: usd(3300) },
  lease: { 24: usd(3900) },
};
/** Nova 5G 128 GB, USD: no lease. */
export const NOVA_5G_128: DevicePrices = {
  outright: usd(72000),
  installments: { 12: usd(6000), 24: usd(3000), 36: usd(2000) },
  lease: {},
};
/** Nova 5G 256 GB Silver, USD: no lease and the deliberate hole, no 36-month installment price. */
export const NOVA_5G_256_SILVER: DevicePrices = {
  outright: usd(82800),
  installments: { 12: usd(6900), 24: usd(3450) },
  lease: {},
};
const NOVA_5G_256: DevicePrices = { ...NOVA_5G_128, outright: usd(82800), installments: { 12: usd(6900), 24: usd(3450), 36: usd(2300) } };

export const NOVA_5G: DeviceOffer = {
  key: 'malva-offer-phone-nova-5g',
  name: 'Nova 5G',
  description: 'Malva Nova 5G',
  colors: ['black', 'silver'],
  memories: [128, 256],
  variants: [
    { sku: 'MLV-DEV-NOVA5G-BLK-128', color: 'black', memoryGb: 128, prices: NOVA_5G_128, availableQuantity: 200 },
    { sku: 'MLV-DEV-NOVA5G-BLK-256', color: 'black', memoryGb: 256, prices: NOVA_5G_256, availableQuantity: 200 },
    { sku: 'MLV-DEV-NOVA5G-SLV-128', color: 'silver', memoryGb: 128, prices: NOVA_5G_128, availableQuantity: 200 },
    { sku: 'MLV-DEV-NOVA5G-SLV-256', color: 'silver', memoryGb: 256, prices: NOVA_5G_256_SILVER, availableQuantity: 200 },
  ],
};

export const NOVA_PRO: DeviceOffer = {
  key: 'malva-offer-phone-nova-pro',
  name: 'Nova Pro',
  description: 'Malva Nova Pro',
  colors: ['black', 'silver', 'violet'],
  memories: [256, 512],
  variants: [
    { sku: 'MLV-DEV-NOVAPRO-BLK-256', color: 'black', memoryGb: 256, prices: NOVA_PRO_256, availableQuantity: 200 },
    { sku: 'MLV-DEV-NOVAPRO-BLK-512', color: 'black', memoryGb: 512, prices: NOVA_PRO_512, availableQuantity: 200 },
    { sku: 'MLV-DEV-NOVAPRO-SLV-256', color: 'silver', memoryGb: 256, prices: NOVA_PRO_256, availableQuantity: 200 },
    { sku: 'MLV-DEV-NOVAPRO-SLV-512', color: 'silver', memoryGb: 512, prices: NOVA_PRO_512, availableQuantity: 200 },
    { sku: 'MLV-DEV-NOVAPRO-VLT-256', color: 'violet', memoryGb: 256, prices: NOVA_PRO_256, availableQuantity: 200 },
    { sku: 'MLV-DEV-NOVAPRO-VLT-512', color: 'violet', memoryGb: 512, prices: NOVA_PRO_512, availableQuantity: 0 },
  ],
};

/** A device line of the bundle as the cart mapper produces it. */
export function deviceLine(id: string, acquisition: LineAcquisition, total: Money, quantity = 1, patch: Partial<CartLine> = {}): CartLine {
  return {
    id,
    source: 'line-item',
    offerKey: 'malva-offer-phone-nova-pro',
    sku: 'MLV-DEV-NOVAPRO-BLK-256',
    kind: 'device',
    name: 'Nova Pro',
    family: null,
    technology: null,
    bullets: [],
    description: '',
    quantity,
    termMonths: 0,
    chargeType: acquisition.mode === 'outright' ? 'one-time' : 'recurring',
    recurrence: null,
    unitListPrice: { centAmount: Math.round(total.centAmount / quantity), currencyCode: total.currencyCode },
    unitPrice: { centAmount: Math.round(total.centAmount / quantity), currencyCode: total.currencyCode },
    total,
    appliedDiscountKeys: [],
    parentLineId: null,
    includedAtNoCharge: false,
    requiredEquipment: false,
    schedule: null,
    label: null,
    stock: null,
    acquisition,
    ...patch,
  };
}
