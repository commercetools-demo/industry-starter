// Category tree (parents first). Order hints are decimal strings; the header reads Phone plans, Wireless internet,
// Cable internet, Add-ons, and the devices category last.
import type { CategoryDraft } from '../types';
import { categoryAssets, getLock, type Lock } from '../images';
import { ls } from './catalog-types';

interface CategorySpec extends Omit<CategoryDraft, 'assets'> {
  name: CategoryDraft['name'];
}

export const CATEGORY_SPECS: CategorySpec[] = [
  {
    key: 'malva-cat-phone-plans',
    name: ls('Phone plans', 'Handytarife'),
    slug: ls('phone-plans', 'handytarife'),
    description: ls(
      'Pick the data you need. No contracts, no hidden fees, keep your number.',
      'Wählen Sie das Datenvolumen, das Sie brauchen. Keine Vertragsbindung, keine versteckten Kosten, Rufnummer mitnehmen.',
    ),
    orderHint: '0.1',
  },
  {
    key: 'malva-cat-home-wireless',
    name: ls('Wireless internet', 'Funk-Internet'),
    slug: ls('home-wireless-internet', 'funk-internet'),
    description: ls(
      'Plug in, connect, go. Home internet over our 5G network with no installation visit.',
      'Einstecken, verbinden, loslegen. Heim-Internet über unser 5G-Netz ohne Installationstermin.',
    ),
    orderHint: '0.2',
  },
  {
    key: 'malva-cat-cable-internet',
    name: ls('Cable internet', 'Kabel-Internet'),
    slug: ls('cable-internet', 'kabel-internet'),
    description: ls(
      'Fiber-grade cable speeds with a locked price and professional installation.',
      'Kabel-Internet auf Glasfaser-Niveau mit festem Preis und Profi-Installation.',
    ),
    orderHint: '0.3',
  },
  {
    key: 'malva-cat-add-ons',
    name: ls('Add-ons', 'Zusatzangebote'),
    slug: ls('add-ons', 'zusatzangebote'),
    description: ls(
      'Streaming, music and extras, billed with your Malva plan. Works with phone, wireless and cable.',
      'Streaming, Musik und Extras, abgerechnet mit Ihrem Malva-Tarif. Funktioniert mit Handy, Funk und Kabel.',
    ),
    orderHint: '0.4',
  },
  {
    key: 'malva-cat-devices',
    name: ls('Phones & devices', 'Handys & Geräte'),
    slug: ls('phones-and-devices', 'handys-und-geraete'),
    description: ls('Malva phones, with outright purchase, installments or lease.', 'Malva-Handys zum Kauf, auf Raten oder zur Miete.'),
    orderHint: '0.5',
  },
  {
    key: 'malva-cat-streaming',
    name: ls('Streaming & entertainment', 'Streaming & Unterhaltung'),
    slug: ls('streaming-entertainment', 'streaming-unterhaltung'),
    description: ls('Video and music services on your Malva bill.', 'Video- und Musikdienste auf Ihrer Malva-Rechnung.'),
    orderHint: '0.1',
    parent: 'malva-cat-add-ons',
  },
  {
    key: 'malva-cat-protection',
    name: ls('Security & protection', 'Sicherheit & Schutz'),
    slug: ls('security-and-protection', 'sicherheit-und-schutz'),
    description: ls('Cloud backup, device cover and network security.', 'Cloud-Backup, Geräteschutz und Netzwerksicherheit.'),
    orderHint: '0.2',
    parent: 'malva-cat-add-ons',
  },
  {
    key: 'malva-cat-equipment',
    name: ls('Routers & equipment', 'Router & Zubehör'),
    slug: ls('routers-and-equipment', 'router-und-zubehoer'),
    description: ls('Routers, modems and gateways to rent or buy.', 'Router, Modems und Gateways zur Miete oder zum Kauf.'),
    orderHint: '0.3',
    parent: 'malva-cat-add-ons',
  },
];

/** The category drafts, with image assets from the lock file (none when a key has no entry). */
export function buildCategories(lock: Lock = getLock()): CategoryDraft[] {
  return CATEGORY_SPECS.map((spec) => {
    const assets = categoryAssets(lock, spec.key, spec.name);
    return { ...spec, ...(assets.length > 0 ? { assets } : {}) };
  });
}

export const categories: CategoryDraft[] = buildCategories();
