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
