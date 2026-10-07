import type { ProductDraft } from '../../types';
import { INCOMPATIBLE_EQUIPMENT } from '../relations';
import { descriptiveProduct, highlightSet, type Copy } from './helpers';

export interface EquipmentSpec {
  key: string;
  sku: string;
  name: Copy;
  description: Copy;
  kind: 'router' | 'modem' | 'gateway';
  maxDownstream: number;
  technologies: ('cable' | 'fixed-wireless')[];
  wifi: 'none' | 'wifi-5' | 'wifi-6' | 'wifi-7';
  /** Offer keys this equipment cannot be combined with (the deliberate exception). */
  incompatibleWith?: string[];
  highlights: Copy[];
}

export const EQUIPMENT: EquipmentSpec[] = [
  {
    key: 'malva-router-ac1200',
    sku: 'MLV-EQP-AC1200-BASE',
    name: { en: 'Malva WiFi 5 Router AC1200', de: 'Malva WLAN-5-Router AC1200' },
    description: { en: 'Entry-level Wi-Fi 5 router for plans up to 300 Mbps.', de: 'Wi-Fi-5-Einstiegsrouter für Tarife bis 300 Mbit/s.' },
    kind: 'router',
    maxDownstream: 300,
    technologies: ['cable', 'fixed-wireless'],
    wifi: 'wifi-5',
    highlights: [
      { en: 'Wi-Fi 5, dual band', de: 'WLAN 5, Dualband' },
      { en: 'Up to 300 Mbps', de: 'Bis zu 300 Mbit/s' },
    ],
  },
  {
    key: 'malva-router-ax3000',
    sku: 'MLV-EQP-AX3000-BASE',
    name: { en: 'Malva WiFi 6 Router AX3000', de: 'Malva WLAN-6-Router AX3000' },
    description: { en: 'Wi-Fi 6 router for plans up to 1 Gbps.', de: 'WLAN-6-Router für Tarife bis 1 Gbit/s.' },
    kind: 'router',
    maxDownstream: 1000,
    technologies: ['cable', 'fixed-wireless'],
    wifi: 'wifi-6',
    incompatibleWith: INCOMPATIBLE_EQUIPMENT['malva-router-ax3000'],
    highlights: [
      { en: 'Wi-Fi 6, tri band', de: 'WLAN 6, Triband' },
      { en: 'Up to 1 Gbps', de: 'Bis zu 1 Gbit/s' },
    ],
  },
  {
    key: 'malva-mesh-be9300',
    sku: 'MLV-EQP-BE9300-BASE',
    name: { en: 'Malva WiFi 7 Mesh BE9300', de: 'Malva WLAN-7-Mesh BE9300' },
    description: { en: 'Whole-home Wi-Fi 7 mesh system for multi-gigabit plans.', de: 'WLAN-7-Mesh-System für das ganze Zuhause und Multi-Gigabit-Tarife.' },
    kind: 'router',
    maxDownstream: 2500,
    technologies: ['cable', 'fixed-wireless'],
    wifi: 'wifi-7',
    highlights: [
      { en: 'Wi-Fi 7 mesh', de: 'WLAN-7-Mesh' },
      { en: 'Up to 2.5 Gbps', de: 'Bis zu 2,5 Gbit/s' },
    ],
  },
  {
    key: 'malva-modem-docsis31',
    sku: 'MLV-EQP-DOCSIS31-BASE',
    name: { en: 'Malva DOCSIS 3.1 Modem', de: 'Malva DOCSIS-3.1-Modem' },
    description: { en: 'DOCSIS 3.1 cable modem for gigabit cable plans.', de: 'DOCSIS-3.1-Kabelmodem für Gigabit-Kabeltarife.' },
    kind: 'modem',
    maxDownstream: 2000,
    technologies: ['cable'],
    wifi: 'none',
    highlights: [
      { en: 'DOCSIS 3.1', de: 'DOCSIS 3.1' },
      { en: 'Up to 2 Gbps', de: 'Bis zu 2 Gbit/s' },
    ],
  },
  {
    key: 'malva-5g-gateway',
    sku: 'MLV-EQP-5GGW-BASE',
    name: { en: 'Malva 5G Home Gateway', de: 'Malva 5G-Heim-Gateway' },
    description: { en: 'Plug-in 5G gateway with Wi-Fi 6 for home wireless plans.', de: '5G-Gateway zum Einstecken mit WLAN 6 für Funk-Internet-Tarife.' },
    kind: 'gateway',
    maxDownstream: 500,
    technologies: ['fixed-wireless'],
    wifi: 'wifi-6',
    highlights: [
      { en: '5G gateway with Wi-Fi 6', de: '5G-Gateway mit WLAN 6' },
      { en: 'Self-install in minutes', de: 'Selbstinstallation in Minuten' },
    ],
  },
];

export const equipmentProducts: ProductDraft[] = EQUIPMENT.map((spec) =>
  descriptiveProduct({
    key: spec.key,
    productType: 'malva-equipment',
    name: spec.name,
    description: spec.description,
    variants: [
      {
        sku: spec.sku,
        values: {
          'equipment-kind': spec.kind,
          'max-downstream-mbps': spec.maxDownstream,
          'supported-technologies': spec.technologies,
          'wifi-standard': spec.wifi,
          'charge-type': 'monthly-rental',
          'incompatible-with': spec.incompatibleWith,
          highlights: highlightSet(spec.highlights),
        },
      },
    ],
  }),
);
