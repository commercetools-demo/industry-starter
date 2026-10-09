import siteImages from './site-images.json';

export interface SiteImage { url: string; width: number; height: number }
export const IMAGE_SLOTS = ['home-hero', 'pillar-plumbing', 'pillar-waste', 'cctv-survey', 'team-fleet'] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

type Raw = Record<string, { url: string; dimensions?: { w: number; h: number } }[]>;

/** Clean (no query string or fragment) URL and intrinsic size of the photo for a slot; `undefined` when the slot has no photo. */
export function getSiteImage(slot: ImageSlot): SiteImage | undefined {
  const first = (siteImages as Raw)[slot]?.[0];
  return first ? { url: first.url, width: first.dimensions?.w ?? 1600, height: first.dimensions?.h ?? 1067 } : undefined;
}
