/** Locale-free hrefs of the content pages. Pass them to `Link` from `@/i18n/routing`, which adds the locale. */

export const POLICY_SLUGS = ['shipping-returns', 'terms', 'privacy', 'accessibility'] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

export function aboutHref(): string {
  return '/about';
}
export function contactHref(): string {
  return '/contact';
}
export function faqHref(id?: string): string {
  return id ? `/faq?q=${encodeURIComponent(id)}` : '/faq';
}
export function policyHref(slug: PolicySlug): string {
  return `/policies/${slug}`;
}
export interface JournalParams {
  tags?: string[];
  q?: string;
  page?: number;
}
export function journalHref(params: JournalParams = {}): string {
  const sp = new URLSearchParams();
  for (const tag of params.tags ?? []) sp.append('tag', tag);
  if (params.q) sp.set('q', params.q);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return qs ? `/journal?${qs}` : '/journal';
}
export function articleHref(slug: string): string {
  return `/journal/${slug}`;
}
/** Search results page (workstream G). Used by the 404 page search form. */
export function searchHref(): string {
  return '/search';
}
