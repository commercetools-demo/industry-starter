const picsum = (seed: string, w = 1200, h = 900) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

/**
 * Placeholder photography for the homepage (M-M-3: the owner replaces these with real photographs).
 * Category images are keyed by the category `key` (the same in every locale), not the localized slug.
 */
export const CATEGORY_IMAGES: Record<string, string> = {
  'fresh-produce': picsum('malva-produce', 600, 400),
  'dairy-eggs': picsum('malva-dairy', 600, 400),
  bakery: picsum('malva-bakery', 600, 400),
  pantry: picsum('malva-pantry', 600, 400),
  drinks: picsum('malva-drinks', 600, 400),
  household: picsum('malva-household', 600, 400),
};

export const HERO_GRID_IMAGES = {
  a: picsum('malva-table'),
  b: picsum('malva-fresh'),
  c: picsum('malva-bread'),
  d: picsum('malva-shelf'),
  e: picsum('malva-growers'),
} as const;

export const EDITORIAL_IMAGE_URL = picsum('malva-journal', 1000, 900);
