import type { LocaleKey } from '@/lib/types';

// DRAFT copy (SO-O1, Q-O-3): the hero and editorial text and the recycling claim are placeholders written for the demo.
// The owner approves or rewrites every line before release. Image URLs are stored clean (no query string); null shows a
// token-coloured placeholder (real photography is SO-02 / OA-03).

/** Both locales are required, so a missing locale is a type error and no fallback logic is needed. */
export type PerLocale = Record<LocaleKey, string>;

export interface HomeContent {
  hero: {
    /** commercetools product key; null hides the glass card. */
    featuredProductKey: string | null;
    /** Clean URL; null uses the featured product's image, then a placeholder. */
    imageUrl: string | null;
    imageAlt: PerLocale;
    eyebrow: PerLocale;
    /** A line break is written as \n. */
    headline: PerLocale;
    subline: PerLocale;
  };
  /** Category keys in display order; the component shows at most four. */
  tiles: { categoryKeys: string[] };
  editorial: {
    imageUrl: string | null;
    imageAlt: PerLocale;
    eyebrow: PerLocale;
    headline: PerLocale;
    body: PerLocale;
    cta: PerLocale;
    /** Locale-less app path. */
    href: string;
  };
}

export const HOME_CONTENT: HomeContent = {
  hero: {
    // First seeded Original pod that has a price in both markets (Q-O-11).
    featuredProductKey: 'mcf-p-ember-ristretto',
    imageUrl: null,
    imageAlt: {
      'en-US': 'A cup of Malva Coffee next to a capsule',
      'en-CA': 'A cup of Malva Coffee next to a capsule',
    },
    eyebrow: { 'en-US': 'The Autumn Edit', 'en-CA': 'The Autumn Edit' },
    headline: { 'en-US': 'Great coffee,\nyour way.', 'en-CA': 'Great coffee,\nyour way.' },
    subline: {
      'en-US': 'Compatible pods, fresh beans and machines. Order online, collect in store or have it delivered.',
      'en-CA': 'Compatible pods, fresh beans and machines. Order online and have it delivered.',
    },
  },
  tiles: { categoryKeys: ['mcf-cat-pods', 'mcf-cat-coffee', 'mcf-cat-machines', 'mcf-cat-accessories'] },
  editorial: {
    imageUrl: null,
    imageAlt: {
      'en-US': 'Coffee beans being roasted in a small batch',
      'en-CA': 'Coffee beans being roasted in a small batch',
    },
    eyebrow: { 'en-US': 'Our promise', 'en-CA': 'Our promise' },
    headline: { 'en-US': 'Sourced with care.\nRoasted for flavour.', 'en-CA': 'Sourced with care.\nRoasted for flavour.' },
    body: {
      'en-US': 'We work with growers we know, roast in small batches, and take back used capsules so they can be recycled.',
      'en-CA': 'We work with growers we know, roast in small batches, and take back used capsules so they can be recycled.',
    },
    cta: { 'en-US': 'Read about our coffee', 'en-CA': 'Read about our coffee' },
    href: '/about',
  },
};

/** The locale's text for a field; both locales are always present. */
export function pick(field: PerLocale, locale: string): string {
  return field[locale as LocaleKey] ?? field['en-US'];
}

/** Splits a \n marked headline into lines (rendered with <br />, never parsed as HTML). */
export function headlineLines(text: string): string[] {
  return text.split('\n');
}
