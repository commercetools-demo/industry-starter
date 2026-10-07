/** Public origin without trailing slash. `URL` is set by Netlify at build; `SITE_URL` lets the owner force the production domain. */
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const value = env.SITE_URL || env.URL || 'http://localhost:3000';
  return value.replace(/\/+$/, '');
}

export const SITE_URL: string = resolveSiteUrl();
