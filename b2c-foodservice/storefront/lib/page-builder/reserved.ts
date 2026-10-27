/**
 * First path segments that belong to a native route. An authored page can never be served there: Next.js already resolves
 * these before the catch-all, and the catch-all refuses a reserved first segment without asking the service, so `/cart/x`
 * cannot be shadowed either. Authors are told these paths are taken. A test checks each one against `app/[locale]`.
 */
export const RESERVED_SEGMENTS = [
  'about', 'account', 'cart', 'category', 'checkout', 'contact', 'dev', 'faq', 'journal', 'p', 'policies', 'search', 'shop',
] as const;

export function isReservedPath(segments: readonly string[]): boolean {
  const first = segments[0]?.toLowerCase();
  return first !== undefined && (RESERVED_SEGMENTS as readonly string[]).includes(first);
}
