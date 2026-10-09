// Image hosts the seeder, `next.config.ts` and the image components accept.
export const IMAGE_HOSTS = ['images.pexels.com', 'media.istockphoto.com'] as const;

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
