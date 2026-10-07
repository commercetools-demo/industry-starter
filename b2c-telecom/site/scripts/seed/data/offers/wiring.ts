// The offer table (D-016): which product each offer wraps, where it is listed, what it includes. Relations
// (conflicts, exceptions) are derived from this table by relations.ts.
import type { OfferFamily } from '../shared/enums';

export interface OfferWiring {
  key: string;
  /** Descriptive product the offer wraps (first anchor). */
  anchor: string;
  kind: 'base-package' | 'addon' | 'equipment' | 'device';
  family: OfferFamily;
  /** Category key -> order hint (decimal string). */
  categories: Record<string, string>;
  /** Offer keys included in the price of this offer. */
  included: string[];
}

const CABLE = 'malva-cat-cable-internet';
const WIRELESS = 'malva-cat-home-wireless';
const PHONE = 'malva-cat-phone-plans';
const STREAMING = 'malva-cat-streaming';
const PROTECTION = 'malva-cat-protection';
const ADDONS = 'malva-cat-add-ons';
const EQUIPMENT = 'malva-cat-equipment';
const DEVICES = 'malva-cat-devices';

const MODEM = 'malva-offer-modem-docsis31';
const GATEWAY = 'malva-offer-5g-gateway';

export const OFFER_WIRING: OfferWiring[] = [
  { key: 'malva-offer-cable-100', anchor: 'malva-cable-100', kind: 'base-package', family: 'cable', categories: { [CABLE]: '0.1' }, included: [MODEM] },
  { key: 'malva-offer-cable-500', anchor: 'malva-cable-500', kind: 'base-package', family: 'cable', categories: { [CABLE]: '0.2' }, included: [MODEM] },
  { key: 'malva-offer-cable-gig', anchor: 'malva-cable-gig', kind: 'base-package', family: 'cable', categories: { [CABLE]: '0.3' }, included: [MODEM, 'malva-offer-appletv'] },
  { key: 'malva-offer-cable-existing-customer', anchor: 'malva-cable-500', kind: 'base-package', family: 'cable', categories: { [CABLE]: '0.4' }, included: [MODEM] },
  { key: 'malva-offer-wireless-lite', anchor: 'malva-wireless-lite', kind: 'base-package', family: 'fixed-wireless', categories: { [WIRELESS]: '0.1' }, included: [GATEWAY] },
  { key: 'malva-offer-wireless-5g', anchor: 'malva-wireless-5g', kind: 'base-package', family: 'fixed-wireless', categories: { [WIRELESS]: '0.2' }, included: [GATEWAY] },
  { key: 'malva-offer-wireless-5g-plus', anchor: 'malva-wireless-5g-plus', kind: 'base-package', family: 'fixed-wireless', categories: { [WIRELESS]: '0.3' }, included: [GATEWAY] },
  { key: 'malva-offer-phone-essential', anchor: 'malva-phone-essential', kind: 'base-package', family: 'phone', categories: { [PHONE]: '0.1' }, included: [] },
  { key: 'malva-offer-phone-plus', anchor: 'malva-phone-plus', kind: 'base-package', family: 'phone', categories: { [PHONE]: '0.2' }, included: [] },
  { key: 'malva-offer-phone-unlimited', anchor: 'malva-phone-unlimited', kind: 'base-package', family: 'phone', categories: { [PHONE]: '0.3' }, included: ['malva-offer-spotify'] },
  {
    key: 'malva-offer-phone-unlimited-max',
    anchor: 'malva-phone-unlimited-max',
    kind: 'base-package',
    family: 'phone',
    categories: { [PHONE]: '0.4' },
    included: ['malva-offer-spotify', 'malva-offer-cloud-200'],
  },
  { key: 'malva-offer-phone-online-only', anchor: 'malva-phone-unlimited', kind: 'base-package', family: 'phone', categories: { [PHONE]: '0.5' }, included: ['malva-offer-spotify'] },
  { key: 'malva-offer-spotify', anchor: 'malva-spotify', kind: 'addon', family: 'addon', categories: { [STREAMING]: '0.1', [ADDONS]: '0.1' }, included: [] },
  { key: 'malva-offer-appletv', anchor: 'malva-appletv', kind: 'addon', family: 'addon', categories: { [STREAMING]: '0.2', [ADDONS]: '0.2' }, included: [] },
  { key: 'malva-offer-applemusic', anchor: 'malva-applemusic', kind: 'addon', family: 'addon', categories: { [STREAMING]: '0.3', [ADDONS]: '0.3' }, included: [] },
  { key: 'malva-offer-netflix', anchor: 'malva-netflix', kind: 'addon', family: 'addon', categories: { [STREAMING]: '0.4', [ADDONS]: '0.4' }, included: [] },
  { key: 'malva-offer-disneyplus', anchor: 'malva-disneyplus', kind: 'addon', family: 'addon', categories: { [STREAMING]: '0.5', [ADDONS]: '0.5' }, included: [] },
  { key: 'malva-offer-cloud-200', anchor: 'malva-cloud-200', kind: 'addon', family: 'addon', categories: { [PROTECTION]: '0.3', [ADDONS]: '0.6' }, included: [] },
  { key: 'malva-offer-device-protect', anchor: 'malva-device-protect', kind: 'addon', family: 'addon', categories: { [PROTECTION]: '0.2', [ADDONS]: '0.7' }, included: [] },
  { key: 'malva-offer-secure', anchor: 'malva-secure', kind: 'addon', family: 'addon', categories: { [PROTECTION]: '0.1', [ADDONS]: '0.8' }, included: [] },
  { key: 'malva-offer-router-ac1200', anchor: 'malva-router-ac1200', kind: 'equipment', family: 'equipment', categories: { [EQUIPMENT]: '0.1' }, included: [] },
  { key: 'malva-offer-router-ax3000', anchor: 'malva-router-ax3000', kind: 'equipment', family: 'equipment', categories: { [EQUIPMENT]: '0.2' }, included: [] },
  { key: 'malva-offer-mesh-be9300', anchor: 'malva-mesh-be9300', kind: 'equipment', family: 'equipment', categories: { [EQUIPMENT]: '0.3' }, included: [] },
  { key: 'malva-offer-modem-docsis31', anchor: 'malva-modem-docsis31', kind: 'equipment', family: 'equipment', categories: { [EQUIPMENT]: '0.4' }, included: [] },
  { key: 'malva-offer-5g-gateway', anchor: 'malva-5g-gateway', kind: 'equipment', family: 'equipment', categories: { [EQUIPMENT]: '0.5' }, included: [] },
  { key: 'malva-offer-phone-nova-5g', anchor: 'malva-phone-nova-5g', kind: 'device', family: 'device', categories: { [DEVICES]: '0.1' }, included: [] },
  { key: 'malva-offer-phone-nova-pro', anchor: 'malva-phone-nova-pro', kind: 'device', family: 'device', categories: { [DEVICES]: '0.2' }, included: [] },
];

export function wiringOf(key: string): OfferWiring {
  const wiring = OFFER_WIRING.find((w) => w.key === key);
  if (!wiring) throw new Error(`No offer wiring for "${key}"`);
  return wiring;
}
