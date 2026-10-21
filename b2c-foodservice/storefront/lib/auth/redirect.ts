const MAX_LENGTH = 512;
const CONTROL = /[\u0000-\u001f\u007f]/;
const FRAGMENT = /^#[A-Za-z0-9-]*$/;

/** Same-origin, locale-free relative paths only (`/account/orders`, `/p/slug#reviews`); anything else is the fallback. */
export function safeRedirect(target: string | null | undefined, fallback: string): string {
  if (typeof target !== 'string' || target.length === 0 || target.length > MAX_LENGTH) return fallback;
  if (!target.startsWith('/') || target.includes('//')) return fallback;
  if (target.includes('\\') || CONTROL.test(target)) return fallback;
  const hash = target.indexOf('#');
  if (hash !== -1 && !FRAGMENT.test(target.slice(hash))) return fallback;
  const path = hash === -1 ? target : target.slice(0, hash);
  if (/%2f|%5c/i.test(path)) return fallback;
  return target;
}
