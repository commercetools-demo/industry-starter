import { CURRENCY, LOCALE, PREFIX } from '../lib';
import { TAX_RX_MEDICINE } from './tax';

/** The pre-existing sample zone for the US; reused, never created or deleted by the seed. */
export const ZONE_USA = 'usa';
export const ZONE_SAME_DAY = `${PREFIX}same-day-states`;

/** States that get same-day delivery. The 14:00 America/New_York cut-off is enforced by the BFF, not commercetools. */
export const SAME_DAY_STATES = ['NY', 'TX', 'IL'];

export const SAME_DAY_ZONE = {
  key: ZONE_SAME_DAY,
  name: 'Same-day delivery states',
  description: 'US states where same-day delivery is offered',
  locations: SAME_DAY_STATES.map((state) => ({ country: 'US', state })),
};

export const SHIPPING_STANDARD = `${PREFIX}standard`;
export const SHIPPING_SAME_DAY = `${PREFIX}same-day`;

/** Rates are in cents: 500 is $5.00. Medicine and shipping share the 0% US category. */
const method = (key: string, name: string, description: string, zone: string, cents: number, isDefault: boolean) => ({
  key,
  name,
  localizedName: { [LOCALE]: name },
  localizedDescription: { [LOCALE]: description },
  taxCategory: { typeId: 'tax-category', key: TAX_RX_MEDICINE },
  active: true,
  isDefault,
  zoneRates: [{ zone: { typeId: 'zone', key: zone }, shippingRates: [{ price: { currencyCode: CURRENCY, centAmount: cents } }] }],
});

export const SHIPPING_METHODS = [
  method(SHIPPING_STANDARD, 'Standard delivery', '1–2 business days', ZONE_USA, 0, true),
  method(SHIPPING_SAME_DAY, 'Same-day delivery', 'By 8 pm', ZONE_SAME_DAY, 500, false),
];
