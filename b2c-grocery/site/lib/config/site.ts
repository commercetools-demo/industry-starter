export type HomeLayout = 'editorial' | 'grid';

export interface SiteConfig {
  homeLayout: HomeLayout;
  contactStrip: boolean;
  heroImageUrl: string;
}

export const DEFAULT_HERO_IMAGE_URL = 'https://picsum.photos/seed/malva-hero/1200/1200';

type Source = Record<string, string | undefined>;

function parseLayout(raw: string | undefined): HomeLayout {
  const value = raw?.trim().toLowerCase();
  return value === 'grid' || value === 'editorial' ? value : 'editorial';
}

/** `true/1/on` and `false/0/off` (any case); empty or unknown values keep the fallback. */
function parseFlag(raw: string | undefined, fallback: boolean): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === 'true' || value === '1' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'off') return false;
  return fallback;
}

function parseHttpsUrl(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  if (!value) return fallback;
  try {
    return new URL(value).protocol === 'https:' ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Merchandising switches, read on the server from `HOME_LAYOUT`, `HOME_CONTACT_STRIP` and `HERO_IMAGE_URL`
 * (deliberately not `NEXT_PUBLIC_*`). An invalid value falls back to the default.
 */
export function getSiteConfig(source: Source = process.env): SiteConfig {
  return {
    homeLayout: parseLayout(source.HOME_LAYOUT),
    contactStrip: parseFlag(source.HOME_CONTACT_STRIP, true),
    heroImageUrl: parseHttpsUrl(source.HERO_IMAGE_URL, DEFAULT_HERO_IMAGE_URL),
  };
}
