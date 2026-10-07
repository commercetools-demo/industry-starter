import type { ProductDraft } from '../../types';
import { internetPlanProduct, type InternetPlanSpec } from './plans-cable';
import type { Copy } from './helpers';

const WIRELESS_ETF: Copy = { en: '$0', de: '0 €' };
const BUNDLE_PHONE: Copy = {
  en: 'Bundle with a phone plan for $5 off monthly.',
  de: 'In Kombination mit einem Handytarif 5 € monatlich sparen.',
};

const wireless = (
  spec: Pick<InternetPlanSpec, 'key' | 'sku' | 'name' | 'description' | 'downstream' | 'upstream' | 'typical' | 'data' | 'labelId' | 'networkGeneration' | 'highlights'> &
    Partial<Pick<InternetPlanSpec, 'badge'>>,
): InternetPlanSpec => ({
  technology: 'fixed-wireless',
  lockMonths: 12,
  activationFee: 0,
  earlyTerminationFee: WIRELESS_ETF,
  term: '12-months',
  requiredEquipmentKinds: ['gateway'],
  bundleDiscountText: BUNDLE_PHONE,
  ...spec,
});

export const WIRELESS_PLANS: InternetPlanSpec[] = [
  wireless({
    key: 'malva-wireless-lite',
    sku: 'MLV-AIR-LITE-BASE',
    name: { en: 'Air Lite', de: 'Air Lite' },
    description: {
      en: 'Home internet over LTE with up to 50 Mbps, 300 GB of data a month and a free router.',
      de: 'Heim-Internet über LTE mit bis zu 50 Mbit/s, 300 GB Datenvolumen pro Monat und kostenlosem Router.',
    },
    downstream: 50,
    upstream: 10,
    typical: { download: 42, upload: 8, latencyMs: 45 },
    data: 300,
    labelId: 'MLV-WI-100',
    networkGeneration: '4g',
    highlights: [
      { en: 'Up to 50 Mbps', de: 'Bis zu 50 Mbit/s' },
      { en: '300GB monthly data', de: '300 GB Datenvolumen pro Monat' },
      { en: 'Free router', de: 'Router kostenlos' },
    ],
  }),
  wireless({
    key: 'malva-wireless-5g',
    sku: 'MLV-AIR-5G-BASE',
    name: { en: 'Air 5G', de: 'Air 5G' },
    description: {
      en: 'Home internet over our 5G network with up to 200 Mbps, unlimited data and self-installation in minutes.',
      de: 'Heim-Internet über unser 5G-Netz mit bis zu 200 Mbit/s, unbegrenztem Datenvolumen und Selbstinstallation in Minuten.',
    },
    downstream: 200,
    upstream: 30,
    typical: { download: 190, upload: 25, latencyMs: 30 },
    data: -1,
    labelId: 'MLV-WI-101',
    networkGeneration: '5g',
    badge: 'most-popular',
    highlights: [
      { en: 'Up to 200 Mbps', de: 'Bis zu 200 Mbit/s' },
      { en: 'Unlimited data', de: 'Unbegrenztes Datenvolumen' },
      { en: 'Wi-Fi 6 router', de: 'WLAN-6-Router' },
      { en: 'Self-install in minutes', de: 'Selbstinstallation in Minuten' },
    ],
  }),
  wireless({
    key: 'malva-wireless-5g-plus',
    sku: 'MLV-AIR-5GPLUS-BASE',
    name: { en: 'Air 5G Plus', de: 'Air 5G Plus' },
    description: {
      en: 'Our fastest home 5G with up to 500 Mbps, unlimited data and priority network access.',
      de: 'Unser schnellstes Heim-5G mit bis zu 500 Mbit/s, unbegrenztem Datenvolumen und bevorzugtem Netzzugang.',
    },
    downstream: 500,
    upstream: 70,
    typical: { download: 470, upload: 60, latencyMs: 22 },
    data: -1,
    labelId: 'MLV-WI-102',
    networkGeneration: '5g',
    highlights: [
      { en: 'Up to 500 Mbps', de: 'Bis zu 500 Mbit/s' },
      { en: 'Unlimited data', de: 'Unbegrenztes Datenvolumen' },
      { en: 'Wi-Fi 6E router + extender', de: 'WLAN-6E-Router + Repeater' },
      { en: 'Priority network access', de: 'Bevorzugter Netzzugang' },
    ],
  }),
];

export const wirelessPlanProducts: ProductDraft[] = WIRELESS_PLANS.map(internetPlanProduct);
