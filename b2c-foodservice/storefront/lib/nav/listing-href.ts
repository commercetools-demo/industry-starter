export type FacetValue = string | number | boolean | ReadonlyArray<string | number>;

/**
 * Listing URL for a category (path without the locale prefix; the locale-aware `Link` adds it).
 * Facets use the shared `f_<name>` convention that the listing page (G) parses; arrays become comma lists:
 * `buildListingHref('pods', { roast: 'dark', intensity: [8, 9] })` is `/category/pods?f_roast=dark&f_intensity=8,9`.
 */
export function buildListingHref(categorySlug: string, params: Record<string, FacetValue | undefined> = {}): string {
  const query = Object.entries(params)
    .filter((entry): entry is [string, FacetValue] => entry[1] !== undefined)
    .map(([name, value]) => {
      const text = Array.isArray(value) ? value.map((v) => encodeURIComponent(String(v))).join(',') : encodeURIComponent(String(value));
      return `f_${encodeURIComponent(name)}=${text}`;
    })
    .join('&');
  const path = `/category/${encodeURIComponent(categorySlug)}`;
  return query ? `${path}?${query}` : path;
}
