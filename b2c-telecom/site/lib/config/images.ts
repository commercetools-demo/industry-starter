// Seeded imagery (D-055, D-066): the hosts the seeder and `next.config.ts` accept, and the credit constants.
// The public pexels.com search returns stock photos hosted on `media.istockphoto.com` (Getty) as well as `images.pexels.com`.
export const IMAGE_HOSTS = ['images.pexels.com', 'media.istockphoto.com'] as const;

/** The credit link the footer renders whenever seeded images are shown (contract for the SiteFooter). */
export const PEXELS_URL = 'https://www.pexels.com';

/** True for an https URL whose host is on the allow-list. */
export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (IMAGE_HOSTS as readonly string[]).includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function assertAllowedImageHost(url: string): void {
  if (!isAllowedImageUrl(url)) {
    throw new Error(`Image URL rejected: only https URLs on ${IMAGE_HOSTS.join(', ')} are allowed (got "${url}")`);
  }
}

/** Image label (also the alternative text source): names the photographer when known. */
export function imageLabel(photographer: string | null | undefined): string {
  return photographer ? `Photo: ${photographer} via Pexels` : 'Photo via Pexels';
}
