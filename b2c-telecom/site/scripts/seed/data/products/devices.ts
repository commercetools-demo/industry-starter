import type { ProductDraft } from '../../types';
import { descriptiveProduct, highlightSet, type Copy } from './helpers';

export type DeviceColor = 'black' | 'silver' | 'violet';
export const COLOR_TOKEN: Record<DeviceColor, string> = { black: 'BLK', silver: 'SLV', violet: 'VLT' };

export interface DeviceSpec {
  key: string;
  /** SKU model token, e.g. NOVA5G. */
  model: string;
  name: Copy;
  description: Copy;
  colors: DeviceColor[];
  memories: string[];
  highlights: Copy[];
}

export const DEVICES: DeviceSpec[] = [
  {
    key: 'malva-phone-nova-5g',
    model: 'NOVA5G',
    name: { en: 'Nova 5G', de: 'Nova 5G' },
    description: {
      en: 'Malva Nova 5G: a 6.1-inch 5G phone with a 128 GB or 256 GB option.',
      de: 'Malva Nova 5G: ein 6,1-Zoll-5G-Handy mit 128 GB oder 256 GB Speicher.',
    },
    colors: ['black', 'silver'],
    memories: ['128', '256'],
    highlights: [
      { en: '6.1-inch display', de: '6,1-Zoll-Display' },
      { en: '5G ready', de: '5G-fähig' },
    ],
  },
  {
    key: 'malva-phone-nova-pro',
    model: 'NOVAPRO',
    name: { en: 'Nova Pro', de: 'Nova Pro' },
    description: {
      en: 'Malva Nova Pro: a 6.7-inch flagship 5G phone with a 256 GB or 512 GB option.',
      de: 'Malva Nova Pro: ein 6,7-Zoll-5G-Flaggschiff mit 256 GB oder 512 GB Speicher.',
    },
    colors: ['black', 'silver', 'violet'],
    memories: ['256', '512'],
    highlights: [
      { en: '6.7-inch display', de: '6,7-Zoll-Display' },
      { en: 'Pro camera system', de: 'Pro-Kamerasystem' },
    ],
  },
];

/** Variant order: color-major, memory-minor; the first (black, smallest memory) is the master. */
export function deviceVariants(spec: DeviceSpec): { color: DeviceColor; memory: string }[] {
  return spec.colors.flatMap((color) => spec.memories.map((memory) => ({ color, memory })));
}

export function deviceSku(spec: DeviceSpec, color: DeviceColor, memory: string, base = false): string {
  const sku = `MLV-DEV-${spec.model}-${COLOR_TOKEN[color]}-${memory}`;
  return base ? `${sku}-BASE` : sku;
}

export const deviceProducts: ProductDraft[] = DEVICES.map((spec) =>
  descriptiveProduct({
    key: spec.key,
    productType: 'malva-device',
    name: spec.name,
    description: spec.description,
    variants: deviceVariants(spec).map(({ color, memory }) => ({
      sku: deviceSku(spec, color, memory, true),
      values: {
        brand: 'Malva',
        color,
        'memory-gb': memory,
        os: 'android',
        'network-generation': '5g',
        'compatible-plan-families': ['phone'],
        highlights: highlightSet(spec.highlights),
      },
    })),
  }),
);
