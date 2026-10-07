import type { ProductDraft } from '../../types';
import { ls } from '../catalog-types';
import { descriptiveProduct, highlightSet, type Copy } from './helpers';

export interface PhonePlanSpec {
  key: string;
  sku: string;
  name: Copy;
  description: Copy;
  data: number;
  hotspot: number;
  typical: { download: number; upload: number; latencyMs: number };
  labelId: string;
  badge?: 'most-popular';
  includedAddons?: string[];
  highlights: Copy[];
}

const PHONE_ETF: Copy = { en: 'None', de: 'Keine' };
const PHONE_BUNDLE: Copy = {
  en: 'Add a second line for $10 off. Bundle with cable or wireless for $5 off monthly.',
  de: 'Zweite Leitung für 10 € weniger. In Kombination mit Kabel oder Funk 5 € monatlich sparen.',
};

// One offer, one line: cart quantity 1 to 5 is the number of lines (D-014).
export function phonePlanProduct(spec: PhonePlanSpec): ProductDraft {
  return descriptiveProduct({
    key: spec.key,
    productType: 'malva-phone-plan',
    name: spec.name,
    description: spec.description,
    variants: [
      {
        sku: spec.sku,
        values: {
          'contract-term': 'month-to-month',
          'charge-type': 'monthly',
          'network-generation': '5g',
          'typical-download-mbps': spec.typical.download,
          'typical-upload-mbps': spec.typical.upload,
          'typical-latency-ms': spec.typical.latencyMs,
          'data-gb': spec.data,
          'lines-included': 1,
          'hotspot-gb': spec.hotspot,
          'price-lock-months': 0,
          'activation-fee': 0,
          'early-termination-fee': ls(PHONE_ETF.en, PHONE_ETF.de),
          badge: spec.badge,
          'label-plan-id': spec.labelId,
          'bundle-discount-text': ls(PHONE_BUNDLE.en, PHONE_BUNDLE.de),
          'included-addons': spec.includedAddons,
          highlights: highlightSet(spec.highlights),
        },
      },
    ],
  });
}

export const PHONE_PLANS: PhonePlanSpec[] = [
  {
    key: 'malva-phone-essential',
    sku: 'MLV-PHN-ESS-BASE',
    name: { en: 'Essential 5GB', de: 'Essential 5GB' },
    description: {
      en: 'A phone plan with 5 GB of high-speed data, unlimited talk and text and Wi-Fi calling.',
      de: 'Ein Handytarif mit 5 GB High-Speed-Daten, unbegrenzt telefonieren und SMS und WLAN-Telefonie.',
    },
    data: 5,
    hotspot: 0,
    typical: { download: 80, upload: 12, latencyMs: 38 },
    labelId: 'MLV-PH-100',
    highlights: [
      { en: '5GB high-speed data', de: '5 GB High-Speed-Daten' },
      { en: 'Unlimited talk & text', de: 'Unbegrenzt telefonieren & SMS' },
      { en: 'Wi-Fi calling', de: 'WLAN-Telefonie' },
    ],
  },
  {
    key: 'malva-phone-plus',
    sku: 'MLV-PHN-PLUS-BASE',
    name: { en: 'Plus 20GB', de: 'Plus 20GB' },
    description: {
      en: 'A phone plan with 20 GB of high-speed data, a 10 GB hotspot and roaming in Canada and Mexico.',
      de: 'Ein Handytarif mit 20 GB High-Speed-Daten, 10 GB Hotspot und Roaming in Kanada und Mexiko.',
    },
    data: 20,
    hotspot: 10,
    typical: { download: 120, upload: 18, latencyMs: 34 },
    labelId: 'MLV-PH-101',
    highlights: [
      { en: '20GB high-speed data', de: '20 GB High-Speed-Daten' },
      { en: 'Unlimited talk & text', de: 'Unbegrenzt telefonieren & SMS' },
      { en: 'Hotspot 10GB', de: 'Hotspot 10 GB' },
      { en: 'Roaming in Canada & Mexico', de: 'Roaming in Kanada & Mexiko' },
    ],
  },
  {
    key: 'malva-phone-unlimited',
    sku: 'MLV-PHN-UNL-BASE',
    name: { en: 'Unlimited', de: 'Unlimited' },
    description: {
      en: 'A phone plan with unlimited 5G data, a 30 GB hotspot, roaming in over 40 countries and one add-on included.',
      de: 'Ein Handytarif mit unbegrenzten 5G-Daten, 30 GB Hotspot, Roaming in über 40 Ländern und einem Zusatzangebot inklusive.',
    },
    data: -1,
    hotspot: 30,
    typical: { download: 220, upload: 35, latencyMs: 28 },
    labelId: 'MLV-PH-102',
    badge: 'most-popular',
    includedAddons: ['malva-spotify'],
    highlights: [
      { en: 'Unlimited 5G data', de: 'Unbegrenzte 5G-Daten' },
      { en: 'Hotspot 30GB', de: 'Hotspot 30 GB' },
      { en: 'Roaming in 40+ countries', de: 'Roaming in über 40 Ländern' },
      { en: '1 add-on included', de: '1 Zusatzangebot inklusive' },
    ],
  },
  {
    key: 'malva-phone-unlimited-max',
    sku: 'MLV-PHN-UNLMAX-BASE',
    name: { en: 'Unlimited Max', de: 'Unlimited Max' },
    description: {
      en: 'Our top phone plan with unlimited premium 5G data, an unlimited hotspot, international calling and two add-ons included.',
      de: 'Unser Top-Handytarif mit unbegrenzten Premium-5G-Daten, unbegrenztem Hotspot, Telefonaten ins Ausland und zwei Zusatzangeboten inklusive.',
    },
    data: -1,
    hotspot: -1,
    typical: { download: 380, upload: 50, latencyMs: 24 },
    labelId: 'MLV-PH-103',
    includedAddons: ['malva-spotify', 'malva-cloud-200'],
    highlights: [
      { en: 'Unlimited premium 5G data', de: 'Unbegrenzte Premium-5G-Daten' },
      { en: 'Unlimited hotspot', de: 'Unbegrenzter Hotspot' },
      { en: 'International calling', de: 'Telefonate ins Ausland' },
      { en: '2 add-ons included', de: '2 Zusatzangebote inklusive' },
    ],
  },
];

export const phonePlanProducts: ProductDraft[] = PHONE_PLANS.map(phonePlanProduct);
