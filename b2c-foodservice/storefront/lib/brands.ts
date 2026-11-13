/**
 * The brand registry (multibrand design D1): the one place that knows which brands exist and how they differ. Pure data, no
 * server-only imports, so the proxy, server components and client components all read it. A brand is chosen by the first
 * URL segment (`/{brand}/{locale}/...`); no other file hard-codes a brand rule.
 */
export const BRAND_SLUGS = ['malva-coffee', 'malva-drinks'] as const;
export type BrandSlug = (typeof BRAND_SLUGS)[number];

export const DEFAULT_BRAND: BrandSlug = 'malva-coffee';

/** Request header the proxy sets so the root layout and server helpers can read the brand of the URL. */
export const BRAND_HEADER = 'x-brand';

export interface BrandConfig {
  slug: BrandSlug;
  /** Display name (also the wordmark text). */
  name: string;
  /** Product selection key (seed `mcf-selection-*`); Product Search is restricted to it. */
  productSelectionKey: string;
  /** Inventory channel key holding this brand's stock; absent when stock is the online entry plus store channels (coffee). */
  inventoryChannelKey?: string;
  /** Store pickup (collect) is offered. */
  pickup: boolean;
  /** Colour token set (`data-brand` on the root element). */
  theme: 'coffee' | 'drinks';
  /** Home page and product page variants. */
  home: 'coffee' | 'drinks';
  pdp: 'coffee' | 'drinks';
  /** Category keys of the home page tiles (a brand without them uses the coffee content). */
  tileCategoryKeys?: string[];
}

export const BRANDS: Record<BrandSlug, BrandConfig> = {
  'malva-coffee': {
    slug: 'malva-coffee', name: 'Malva Coffee', productSelectionKey: 'mcf-selection-malva-coffee',
    pickup: true, theme: 'coffee', home: 'coffee', pdp: 'coffee',
  },
  'malva-drinks': {
    slug: 'malva-drinks', name: 'Malva Drinks', productSelectionKey: 'mcf-selection-malva-drinks',
    inventoryChannelKey: 'mcf-channel-malva-drinks', pickup: false, theme: 'drinks', home: 'drinks', pdp: 'drinks',
    tileCategoryKeys: ['mcf-cat-drinks-french-kiss', 'mcf-cat-drinks-unflavored', 'mcf-cat-drinks-flavored-forever', 'mcf-cat-drinks-chic'],
  },
};

export function isBrandSlug(value: unknown): value is BrandSlug {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BRANDS, value);
}

/** The brand for a URL value; an unknown or missing value is the default brand (never throws). */
export function brandOf(value: unknown): BrandConfig {
  return isBrandSlug(value) ? BRANDS[value] : BRANDS[DEFAULT_BRAND];
}

/** The brands in tab order: the current brand first, the others after it in registry order. */
export function brandTabs(current: BrandSlug): BrandConfig[] {
  return [BRANDS[current], ...BRAND_SLUGS.filter((s) => s !== current).map((s) => BRANDS[s])];
}

/** Custom field of the line item type (`mcf-line-fulfilment`) that holds the brand of a line. */
export const LINE_BRAND_FIELD = 'brand';

/** The brand of a cart or order line from its custom fields; a line without the field (an older cart) is Malva Coffee. */
export function brandOfLineFields(fields: unknown): BrandSlug {
  const raw = (fields as Record<string, unknown> | null | undefined)?.[LINE_BRAND_FIELD];
  return isBrandSlug(raw) ? raw : DEFAULT_BRAND;
}
