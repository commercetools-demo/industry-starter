// Typed view of the banner and cover images the seed chose (scripts/seed/data/site-images.json, keyed by slot).
// The file is `{}` until `npm run seed:images` has run: every slot is then null and callers fall back to a
// token-styled gradient block. URLs are never invented; only clean https URLs from the file are returned.
import { SITE_SLOTS } from '@/scripts/seed/data/site-slots';
import { getSiteImage, type SiteImage } from '@/lib/site-images';
import siteImages from '@/scripts/seed/data/site-images.json';

export const SITE_IMAGE_SLOTS = ['home-hero', 'home-cta', 'home-rx-delivery', 'journal-1', 'journal-2', 'journal-3'] as const;
export type SiteImageSlot = (typeof SITE_IMAGE_SLOTS)[number];

/** Same slot names as the seed's slot list (a test keeps the two in step). */
export const SEED_SLOT_NAMES: readonly string[] = SITE_SLOTS.map((s) => s.slot);

/** The image of a slot, or null (no photo chosen yet, or the stored URL is not clean: D-006). */
export function siteImage(slot: SiteImageSlot, images: unknown = siteImages): SiteImage | null {
  const image = getSiteImage(slot, images);
  if (!image || /[?#]/.test(image.url)) return null;
  return image;
}
