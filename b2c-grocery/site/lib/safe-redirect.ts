/** `/en-US/account/orders?x=1` → `/account/orders?x=1`: the i18n router adds the locale itself. */
export function withoutLocale(path: string, locale: string): string {
  const prefix = `/${locale}`;
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path === prefix ? '/' : path;
}

/**
 * The `redirect` query is attacker-controlled. Only a same-site path inside the current locale is allowed;
 * anything else (protocol-relative, absolute URL, backslash tricks, another locale) falls back to the account page.
 */
export function safeRedirectPath(input: string | null | undefined, locale: string): string {
  const fallback = `/${locale}/account`;
  if (typeof input !== 'string' || input.length === 0) return fallback;
  if (!input.startsWith('/') || input.startsWith('//') || input.includes('://') || input.includes('\\')) return fallback;
  if (/[\u0000-\u001f]/.test(input)) return fallback;
  if (!input.startsWith(`/${locale}/`)) return fallback;
  return input;
}
