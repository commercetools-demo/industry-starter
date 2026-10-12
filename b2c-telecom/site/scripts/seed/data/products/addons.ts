import type { ProductDraft } from '../../types';
import { descriptiveProduct, type Copy } from './helpers';

export interface AddonSpec {
  key: string;
  sku: string;
  name: Copy;
  description: Copy;
  kind: 'streaming' | 'security' | 'protection' | 'installation';
  tag: 'music' | 'video' | 'extras';
  provider: string;
  families: ('internet' | 'phone')[];
  /** One-time items (installation) are sold once, not monthly. Default monthly. */
  charge?: 'monthly' | 'one-time';
  /** Technologies the add-on works with; absent = every technology of its families. */
  technologies?: ('cable' | 'fixed-wireless')[];
}

export const ADDONS: AddonSpec[] = [
  {
    key: 'malva-spotify',
    sku: 'MLV-ADD-SPOTIFY-BASE',
    name: { en: 'Spotify', de: 'Spotify' },
    description: { en: 'Spotify Premium, ad-free music on all devices.', de: 'Spotify Premium, werbefreie Musik auf allen Geräten.' },
    kind: 'streaming',
    tag: 'music',
    provider: 'Spotify',
    families: ['internet', 'phone'],
  },
  {
    key: 'malva-appletv',
    sku: 'MLV-ADD-APPLETV-BASE',
    name: { en: 'Apple TV+', de: 'Apple TV+' },
    description: { en: 'Award-winning originals, streamed anywhere.', de: 'Preisgekrönte Originals, überall streamen.' },
    kind: 'streaming',
    tag: 'video',
    provider: 'Apple',
    families: ['internet'],
  },
  {
    key: 'malva-applemusic',
    sku: 'MLV-ADD-APPLEMUSIC-BASE',
    name: { en: 'Apple Music', de: 'Apple Music' },
    description: { en: 'Over 100 million songs, ad-free.', de: 'Über 100 Millionen Songs, werbefrei.' },
    kind: 'streaming',
    tag: 'music',
    provider: 'Apple',
    families: ['internet', 'phone'],
  },
  {
    key: 'malva-netflix',
    sku: 'MLV-ADD-NETFLIX-BASE',
    name: { en: 'Netflix', de: 'Netflix' },
    description: { en: 'Netflix Standard with ads, on your Malva bill.', de: 'Netflix Standard mit Werbung, auf Ihrer Malva-Rechnung.' },
    kind: 'streaming',
    tag: 'video',
    provider: 'Netflix',
    families: ['internet'],
  },
  {
    key: 'malva-disneyplus',
    sku: 'MLV-ADD-DISNEY-BASE',
    name: { en: 'Disney+', de: 'Disney+' },
    description: { en: 'Disney, Pixar, Marvel and Star Wars.', de: 'Disney, Pixar, Marvel und Star Wars.' },
    kind: 'streaming',
    tag: 'video',
    provider: 'Disney',
    families: ['internet'],
  },
  {
    key: 'malva-cloud-200',
    sku: 'MLV-ADD-CLOUD200-BASE',
    name: { en: 'Cloud 200GB', de: 'Cloud 200GB' },
    description: { en: 'Back up photos and files securely.', de: 'Fotos und Dateien sicher sichern.' },
    kind: 'protection',
    tag: 'extras',
    provider: 'Malva',
    families: ['internet', 'phone'],
  },
  {
    key: 'malva-device-protect',
    sku: 'MLV-ADD-DEVCARE-BASE',
    name: { en: 'Device Care', de: 'Device Care' },
    description: { en: 'Screen and damage cover for one device.', de: 'Display- und Schadenschutz für ein Gerät.' },
    kind: 'protection',
    tag: 'extras',
    provider: 'Malva',
    families: ['phone'],
  },
  {
    key: 'malva-secure',
    sku: 'MLV-ADD-SECURE-BASE',
    name: { en: 'Malva Secure', de: 'Malva Secure' },
    description: {
      en: 'Network security and malware protection for every device on your home network.',
      de: 'Netzwerksicherheit und Malware-Schutz für jedes Gerät in Ihrem Heimnetz.',
    },
    kind: 'security',
    tag: 'extras',
    provider: 'Malva',
    families: ['internet'],
  },
  {
    key: 'malva-diy-install',
    sku: 'MLV-ADD-DIYINSTALL-BASE',
    name: { en: 'Self-installation kit', de: 'Selbstinstallations-Set' },
    description: { en: 'Everything to set up your service yourself, shipped to your door.', de: 'Alles für die Einrichtung in Eigenregie, direkt zu Ihnen geliefert.' },
    kind: 'installation',
    tag: 'extras',
    provider: 'Malva',
    families: ['internet'],
    charge: 'one-time',
    technologies: ['cable', 'fixed-wireless'],
  },
  {
    key: 'malva-pro-install',
    sku: 'MLV-ADD-PROINSTALL-BASE',
    name: { en: 'Professional installation', de: 'Professionelle Installation' },
    description: { en: 'A technician sets up your service and your equipment at home.', de: 'Ein Techniker richtet Anschluss und Geräte bei Ihnen zu Hause ein.' },
    kind: 'installation',
    tag: 'extras',
    provider: 'Malva',
    families: ['internet'],
    charge: 'one-time',
    technologies: ['cable', 'fixed-wireless'],
  },
  {
    key: 'malva-regional-sports',
    sku: 'MLV-ADD-SPORTS-BASE',
    name: { en: 'Regional Sports Pass', de: 'Regional Sports Pass' },
    description: { en: 'Local team games, live. Sold in selected states.', de: 'Spiele lokaler Teams, live. In ausgewählten Bundesstaaten erhältlich.' },
    kind: 'streaming',
    tag: 'video',
    provider: 'Malva Sports',
    families: ['internet'],
  },
];

export const addonProducts: ProductDraft[] = ADDONS.map((spec) =>
  descriptiveProduct({
    key: spec.key,
    productType: 'malva-addon',
    name: spec.name,
    description: spec.description,
    variants: [
      {
        sku: spec.sku,
        values: {
          'addon-kind': spec.kind,
          'addon-tag': spec.tag,
          provider: spec.provider,
          'applies-to-families': spec.families,
          ...(spec.technologies ? { 'applies-to-technologies': spec.technologies } : {}),
          'charge-type': spec.charge === 'one-time' ? 'one-time' : 'monthly',
        },
      },
    ],
  }),
);
