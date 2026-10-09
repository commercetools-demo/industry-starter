// Banner and journal cover images chosen by the seed (scripts/seed/data/site-images.json, keyed by slot).
// The file is `{}` until `npm run seed:images` has run; callers then fall back to a token-styled block.
import siteImages from '@/scripts/seed/data/site-images.json';

/** A chosen photo. Photographer credits are never stored or shown (royalty-free, D-040), so a legacy `photographer` field is ignored. */
export interface SiteImage {
  url: string;
}

export function getSiteImage(slot: string, images: unknown = siteImages): SiteImage | null {
  if (!slot || typeof images !== 'object' || images === null) return null;
  const entry = (images as Record<string, unknown>)[slot];
  if (typeof entry !== 'object' || entry === null) return null;
  const { url } = entry as { url?: unknown };
  // Only https URLs from the seed file are ever used; nothing is invented.
  if (typeof url !== 'string' || !url.startsWith('https://')) return null;
  return { url };
}
