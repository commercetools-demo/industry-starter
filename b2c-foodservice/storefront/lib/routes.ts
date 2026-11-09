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

/** Top-level categories for pages that must not call commerce (404, About). Slugs are the seeded ones; labels are `shell.nav.<id>`. */
export const STATIC_TOP_CATEGORIES = ['pods', 'coffee', 'machines', 'accessories', 'gifts'] as const;

/** The same for Malva Drinks (the seeded drinks category slugs; labels are `shell.nav.<slug>`). */
export const STATIC_TOP_CATEGORIES_DRINKS = ['french-kiss', 'unflavored', 'flavored-forever', 'chic'] as const;

/** Top-level categories of a brand for pages that must not call commerce. */
export const staticTopCategories = (brand: 'malva-coffee' | 'malva-drinks'): readonly string[] =>
  brand === 'malva-drinks' ? STATIC_TOP_CATEGORIES_DRINKS : STATIC_TOP_CATEGORIES;

/** Account area (workstreams J and L). The pages may not exist yet; they are linked from error pages only. */
export function accountHref(): string {
  return '/account';
}
export function signInHref(redirect?: string): string {
  return redirect ? `/account/sign-in?redirect=${encodeURIComponent(redirect)}` : '/account/sign-in';
}
export function registerHref(redirect?: string): string {
  return redirect ? `/account/register?redirect=${encodeURIComponent(redirect)}` : '/account/register';
}

/** The bag page (locale-free; `Link` from `@/i18n/routing` adds brand and locale). */
export function bagHref(): string {
  return '/cart';
}
