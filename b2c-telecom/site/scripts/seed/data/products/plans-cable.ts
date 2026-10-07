import type { ProductDraft } from '../../types';
import { ls } from '../catalog-types';
import { descriptiveProduct, highlightSet, type Copy } from './helpers';

export interface InternetPlanSpec {
  key: string;
  sku: string;
  name: Copy;
  description: Copy;
  technology: 'cable' | 'fixed-wireless';
  downstream: number;
  upstream: number;
  typical: { download: number; upload: number; latencyMs: number };
  data: number;
  lockMonths: number;
  activationFee: number;
  earlyTerminationFee: Copy;
  networkGeneration?: '4g' | '5g';
  badge?: 'most-popular';
  labelId: string;
  term: '12-months' | '24-months';
  requiredEquipmentKinds: string[];
  includedAddons?: string[];
  bundleDiscountText: Copy;
  highlights: Copy[];
}

const CABLE_ETF: Copy = { en: '$10 x months remaining', de: '10 € x verbleibende Monate' };
const BUNDLE_PHONE: Copy = {
  en: 'Bundle with a phone plan for $5 off monthly.',
  de: 'In Kombination mit einem Handytarif 5 € monatlich sparen.',
};

export function internetPlanProduct(spec: InternetPlanSpec): ProductDraft {
  return descriptiveProduct({
    key: spec.key,
    productType: 'malva-internet-plan',
    name: spec.name,
    description: spec.description,
    variants: [
      {
        sku: spec.sku,
        values: {
          technology: spec.technology,
          'downstream-mbps': spec.downstream,
          'upstream-mbps': spec.upstream,
          'contract-term': spec.term,
          'charge-type': 'monthly',
          'network-generation': spec.networkGeneration,
          'typical-download-mbps': spec.typical.download,
          'typical-upload-mbps': spec.typical.upload,
          'typical-latency-ms': spec.typical.latencyMs,
          'data-gb': spec.data,
          'price-lock-months': spec.lockMonths,
          'activation-fee': spec.activationFee,
          'early-termination-fee': ls(spec.earlyTerminationFee.en, spec.earlyTerminationFee.de),
          badge: spec.badge,
          'label-plan-id': spec.labelId,
          'bundle-discount-text': ls(spec.bundleDiscountText.en, spec.bundleDiscountText.de),
          'included-addons': spec.includedAddons,
          'required-equipment-kinds': spec.requiredEquipmentKinds,
          highlights: highlightSet(spec.highlights),
        },
      },
    ],
  });
}

const cable = (
  spec: Pick<InternetPlanSpec, 'key' | 'sku' | 'name' | 'description' | 'downstream' | 'upstream' | 'typical' | 'labelId' | 'highlights'> &
    Partial<Pick<InternetPlanSpec, 'badge' | 'includedAddons'>>,
): InternetPlanSpec => ({
  technology: 'cable',
  data: -1,
  lockMonths: 24,
  activationFee: 25,
  earlyTerminationFee: CABLE_ETF,
  term: '24-months',
  requiredEquipmentKinds: ['modem'],
  bundleDiscountText: BUNDLE_PHONE,
  ...spec,
});

export const CABLE_PLANS: InternetPlanSpec[] = [
  cable({
    key: 'malva-cable-100',
    sku: 'MLV-CBL-100-BASE',
    name: { en: 'Cable 100', de: 'Cable 100' },
    description: {
      en: 'Cable internet with 100 Mbps download and unlimited data, modem included.',
      de: 'Kabel-Internet mit 100 Mbit/s Download und unbegrenztem Datenvolumen, Modem inklusive.',
    },
    downstream: 100,
    upstream: 10,
    typical: { download: 104, upload: 11, latencyMs: 16 },
    labelId: 'MLV-CA-100',
    highlights: [
      { en: '100 Mbps download', de: '100 Mbit/s Download' },
      { en: 'Unlimited data', de: 'Unbegrenztes Datenvolumen' },
      { en: 'Modem included', de: 'Modem inklusive' },
    ],
  }),
  cable({
    key: 'malva-cable-500',
    sku: 'MLV-CBL-500-BASE',
    name: { en: 'Cable 500', de: 'Cable 500' },
    description: {
      en: 'Cable internet with 500 Mbps download, a Wi-Fi 6 gateway and free professional installation.',
      de: 'Kabel-Internet mit 500 Mbit/s Download, WLAN-6-Gateway und kostenloser Profi-Installation.',
    },
    downstream: 500,
    upstream: 50,
    typical: { download: 525, upload: 48, latencyMs: 13 },
    labelId: 'MLV-CA-101',
    badge: 'most-popular',
    highlights: [
      { en: '500 Mbps download', de: '500 Mbit/s Download' },
      { en: 'Unlimited data', de: 'Unbegrenztes Datenvolumen' },
      { en: 'Wi-Fi 6 gateway', de: 'WLAN-6-Gateway' },
      { en: 'Free professional install', de: 'Kostenlose Profi-Installation' },
    ],
  }),
  cable({
    key: 'malva-cable-gig',
    sku: 'MLV-CBL-GIG-BASE',
    name: { en: 'Cable Gig', de: 'Cable Gig' },
    description: {
      en: 'Gigabit cable internet with whole-home mesh Wi-Fi and free professional installation.',
      de: 'Gigabit-Kabel-Internet mit Mesh-WLAN für das ganze Zuhause und kostenloser Profi-Installation.',
    },
    downstream: 1000,
    upstream: 60,
    typical: { download: 940, upload: 60, latencyMs: 11 },
    labelId: 'MLV-CA-102',
    includedAddons: ['malva-appletv'],
    highlights: [
      { en: '1 Gbps download', de: '1 Gbit/s Download' },
      { en: 'Unlimited data', de: 'Unbegrenztes Datenvolumen' },
      { en: 'Whole-home mesh Wi-Fi', de: 'Mesh-WLAN für das ganze Zuhause' },
      { en: 'Free professional install', de: 'Kostenlose Profi-Installation' },
    ],
  }),
];

export const cablePlanProducts: ProductDraft[] = CABLE_PLANS.map(internetPlanProduct);
