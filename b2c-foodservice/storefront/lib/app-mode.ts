/**
 * App mode (workstream R, D-041). One server variable, `APP_MODE`, switches the same build into the In-store companion.
 * Anything other than `instore` (trimmed, any case) is the normal website, so a typo never turns the shop into the companion.
 * Not secret and not `server-only`: `proxy.ts`, `next.config.ts` and server components read it. Client components never do; a
 * server component passes what they need as a prop (no `NEXT_PUBLIC_APP_MODE`).
 */
export type AppMode = 'website' | 'instore';

export function parseAppMode(value: string | undefined | null): AppMode {
  return value?.trim().toLowerCase() === 'instore' ? 'instore' : 'website';
}

export function getAppMode(env: Record<string, string | undefined> = process.env): AppMode {
  return parseAppMode(env.APP_MODE);
}

export function isInstore(env: Record<string, string | undefined> = process.env): boolean {
  return getAppMode(env) === 'instore';
}

/** Path prefixes (after the locale) that the In-store companion serves; everything else under a locale goes to its home. */
export const INSTORE_ALLOWED = ['', '/c', '/p', '/bag', '/checkout'] as const;

/**
 * Where the In-store companion sends a path (the part after the locale), or null when the path is served as it is.
 * `/category/<slug>` becomes `/c/<slug>`, `/cart` becomes `/bag`, every content, account, journal, search, shop and unknown path
 * goes to the home. `/dev` is left alone (development only, removed before deploy).
 */
export function instoreRedirect(tail: string): string | null {
  const path = tail === '' ? '/' : tail;
  if (path === '/') return null;
  const [, first = '', ...rest] = path.split('/');
  if (first === 'category') return rest.length > 0 ? `/c/${rest.join('/')}` : '/';
  if (first === 'cart') return '/bag';
  if (first === 'dev') return null;
  if ((INSTORE_ALLOWED as readonly string[]).includes(`/${first}`)) return null;
  return '/';
}
