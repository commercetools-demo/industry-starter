// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { K } from './base';

/**
 * Default Contentools theme (Garage Maroon, from design/export/tokens.automotive.css).
 * Shape: `ThemeTokens` of <contentools-repo>/puck/packages/puck-types/src/theme-types.ts. Contentools stores it as the
 * value of the commercetools custom object container `configuration`, key `{namespace}-theme`; namespace `default` is
 * the fallback for a store without a theme of its own (service/src/controllers/configuration.controller.ts).
 */
export const THEME_CONTAINER = K.cConfiguration;
export const THEME_KEY = 'default-theme';
export const defaultTheme = {
  colorPrimary: '#821810',
  colorPrimaryHover: '#911c14',
  colorPrimaryForeground: '#ffffff',
  colorSecondary: '#000000',
  colorSecondaryForeground: '#ffffff',
  colorBackground: '#fdfdfd',
  colorSurface: '#ffffff',
  colorText: '#191c1f',
  colorTextMuted: '#475156',
  colorForeground: '#191c1f',
  colorMuted: '#f2f4f5',
  colorMutedForeground: '#475156',
  colorDestructive: '#ee5858',
  colorDestructiveForeground: '#ffffff',
  colorAccent: '#d1a04a',
  colorAccentForeground: '#191c1f',
  colorBorder: '#e4e7e9',
  colorInput: '#ffffff',
  colorRing: '#821810',
  borderRadius: 'md',
  borderWidth: '1',
  borderStyle: 'solid',
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontHeading: 'Poppins, system-ui, sans-serif',
  fontWeightBase: '400',
  fontWeightHeading: '700',
  letterSpacing: 'normal',
  textTransform: 'none',
  spacingScale: 1,
  buttonStyle: 'solid',
  cardShadow: 'sm',
  shadowStyle: 'soft',
  headerStyle: 'solid',
  backgroundStyle: 'solid',
} as const;

// ---------- product tailoring (reseller-specific name, description and images; locked data is never tailored) ----------
/**
 * Tailored text and images publish at once: there is no approval, no review state and no review object (Q-T06). Images
 * are external URLs without query or fragment. The seed uses a neutral placeholder host until `seed:images` records real
 * ones into `tailoring-images.json` (key `<store>--<sku>`), which then take precedence.
 */
export interface TailoredImage { url: string; dimensions: { w: number; h: number } }
export interface TailoringDef {
  store: string;
  sku: string;
  name?: { de: string; en: string };
  description?: { de: string; en: string };
  images?: TailoredImage[];
}

const placeholder = (hex: string): TailoredImage => ({ url: `https://placehold.co/800x600/${hex}/ffffff.jpg`, dimensions: { w: 800, h: 600 } });

export const TAILORINGS: TailoringDef[] = [
  { store: K.storeNorth, sku: 'MLV-BP-41001', name: { de: 'Küstenwerk Bremsbeläge vorn, Keramik', en: 'Küstenwerk front brake pads, ceramic' }, description: { de: 'Leise, staubarm und von unseren Werkstätten empfohlen.', en: 'Quiet, low dust and recommended by our workshops.' }, images: [placeholder('821810')] },
  { store: K.storeNorth, sku: 'MLV-OF-44002', name: { de: 'Diesel-Ölfilter für Dauerläufer', en: 'Diesel oil filter for high mileage' } },
  { store: K.storeNorth, sku: 'MLV-AF-45001', description: { de: 'Hochwertiger Luftfilter, in unseren Werkstätten täglich im Einsatz.', en: 'High-quality air filter, used daily in our workshops.' } },
  { store: K.storeSouth, sku: 'MLV-BT-54001', name: { de: 'Südkamm Starterbatterie 70 Ah', en: 'Südkamm starter battery 70 Ah' }, description: { de: 'Mit Altteilrücknahme in jeder Filiale.', en: 'Core return at any branch.' }, images: [placeholder('191c1f')] },
  { store: K.storeSouth, sku: 'MLV-OF-44001', description: { de: 'Ölfilter-Wechsel in 10 Minuten.', en: 'Oil filter change in 10 minutes.' }, images: [placeholder('d1a04a')] },
];

export const tailoringKey = (store: string, sku: string): string => `mau-tl-${store.replace(/^mau-reseller-/, '')}-${sku.toLowerCase()}`;
export const tailoringImageKey = (store: string, sku: string): string => `${store}--${sku}`;

// ---------- banner and category image slots (queries for seed:images) ----------
export const BANNER_SLOTS = [
  { key: 'home-hero', query: 'car workshop mechanic' },
  { key: 'promo-banner', query: 'car brake disc' },
  { key: 'pickup-banner', query: 'auto parts store counter' },
] as const;

export const CATEGORY_IMAGE_QUERIES: Record<string, string> = {
  brakes: 'car brake disc',
  filters: 'car oil filter',
  engine: 'car engine',
  suspension: 'car suspension',
  electrical: 'car battery',
  cooling: 'car radiator',
  exhaust: 'car exhaust pipe',
  care: 'car engine oil',
};

// ---------- Malva home banners (container malva-site, key home-banners) ----------
export const MALVA_BANNERS_KEY = 'home-banners';

/** Slots of the Malva home carousel. `imageKey` keys banner-images.json; `query` feeds `npm run seed:images`. `categorySlug` are real slugs of categories.ts (system level). */
export const MALVA_BANNER_SLOTS = [
  { imageKey: 'malva-home-1', query: 'car brake disc', hex: '821810', headline: { de: 'Bremsen für sicheres Fahren', en: 'Brakes for safe driving' }, subline: { de: 'Beläge und Scheiben der Top-Marken bei Ihrem Händler.', en: 'Pads and discs from top brands at your reseller.' }, categorySlug: { de: 'bremsen', en: 'brakes' } },
  { imageKey: 'malva-home-2', query: 'car oil change', hex: '191c1f', headline: { de: 'Filter und Öl für lange Laufzeit', en: 'Filters and oil for the long haul' }, subline: { de: 'Alles für den nächsten Service.', en: 'Everything for your next service.' }, categorySlug: { de: 'filter', en: 'filters' } },
  { imageKey: 'malva-home-3', query: 'car battery', hex: 'd1a04a', headline: { de: 'Starke Batterien, startklar', en: 'Strong batteries, ready to go' }, subline: { de: 'Elektrik und Licht für jede Jahreszeit.', en: 'Electrical and lighting for every season.' }, categorySlug: { de: 'elektrik-und-licht', en: 'electrical-and-lighting' } },
] as const;

export interface MalvaBanner {
  headline: { de: string; en: string };
  subline: { de: string; en: string };
  categorySlug: { de: string; en: string };
  image: { url: string; dimensions: { w: number; h: number } };
}

/** Recorded Pexels image (first of the slot) wins; else a placehold.co placeholder. */
export function malvaBannersObject(recorded: Record<string, { url: string; dimensions: { w: number; h: number } }[]> = {}): { banners: MalvaBanner[] } {
  return {
    banners: MALVA_BANNER_SLOTS.map((b) => ({
      headline: { ...b.headline }, subline: { ...b.subline }, categorySlug: { ...b.categorySlug },
      image: recorded[b.imageKey]?.[0] ?? { url: `https://placehold.co/1600x600/${b.hex}/ffffff.jpg`, dimensions: { w: 1600, h: 600 } },
    })),
  };
}
