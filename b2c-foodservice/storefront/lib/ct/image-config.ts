// Stored image URLs are clean (no query, no fragment); sizing is added here, at render time only.
// To change the CDN style later, edit only this file (Q-D-6).

function parseHttps(url: string): URL | undefined {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u : undefined;
  } catch {
    return undefined;
  }
}

/** scheme + host + path only. A URL that is not https or not parseable is returned unchanged. */
export function cleanImageUrl(url: string): string {
  const u = parseHttps(url);
  return u ? `${u.origin}${u.pathname}` : url;
}

function transform(url: string, w: number, h: number): string {
  const u = parseHttps(url);
  if (!u) return url;
  return `${cleanImageUrl(url)}?auto=compress&fit=crop&w=${w}&h=${h}`;
}

/** 600 x 720 (5:6 card) */
export const transformListingImageUrl = (url: string): string => transform(url, 600, 720);
/** 1200 x 1440 */
export const transformDetailImageUrl = (url: string): string => transform(url, 1200, 1440);
/** 160 x 192 */
export const transformThumbnailImageUrl = (url: string): string => transform(url, 160, 192);
