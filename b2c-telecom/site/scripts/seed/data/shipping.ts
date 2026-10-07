import type { ShippingMethodDraft } from '../types';

// Zero fixed rates (not free-above, not a shipping discount). Both methods are isDefault:false so the sample default
// `standard-shipping` stays untouched; the BFF selects by the `malva-` key prefix. `zone` is a country code that the
// reconciler maps to the adopted zone (ctx.zoneKeys).
const zeroRates = [
  { zone: 'US', shippingRates: [{ price: { currencyCode: 'USD', centAmount: 0 } }] },
  { zone: 'DE', shippingRates: [{ price: { currencyCode: 'EUR', centAmount: 0 } }] },
];

export const shippingMethods: ShippingMethodDraft[] = [
  {
    key: 'malva-shipping-standard',
    name: 'Malva standard delivery',
    localizedName: { 'en-US': 'Standard delivery', 'de-DE': 'Standardversand' },
    localizedDescription: {
      'en-US': 'SIM cards, routers and activation kits ship at no charge.',
      'de-DE': 'SIM-Karten, Router und Aktivierungssets werden kostenlos geliefert.',
    },
    taxCategory: { typeId: 'tax-category', key: 'malva-telecom-services' },
    active: true,
    isDefault: false,
    predicate: 'lineItemExists(attributes.`offer-kind` in ("base-package","equipment","device","bundle")) = true',
    zoneRates: zeroRates,
  },
  {
    key: 'malva-delivery-digital',
    name: 'Malva digital delivery',
    localizedName: { 'en-US': 'Digital delivery', 'de-DE': 'Digitale Bereitstellung' },
    localizedDescription: {
      'en-US': 'Nothing to ship. Activated on your bill.',
      'de-DE': 'Nichts zu versenden. Wird auf Ihrer Rechnung aktiviert.',
    },
    taxCategory: { typeId: 'tax-category', key: 'malva-telecom-services' },
    active: true,
    isDefault: false,
    predicate: 'forAllLineItems(attributes.`offer-kind` = "addon") = true',
    zoneRates: zeroRates,
  },
];
