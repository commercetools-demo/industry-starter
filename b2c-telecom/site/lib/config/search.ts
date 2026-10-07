// P: search configuration. Read at render time from this module (never from process.env) so tests can mock it.

/** Show the magnifier in the header and the mobile drawer. Set to false to hide the entry; /search stays reachable by URL. */
export const HEADER_SEARCH_ENABLED = true;
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;
/** Product Search `limit` (the API allows 1 to 100): facets, sort and paging happen in memory over these hits. */
export const MAX_HITS = 100;
export const SEARCH_LANGUAGES_TTL_SECONDS = 3600;
/** Fallback tiles of the empty and start states: category keys, resolved against the tree (a missing key is omitted and warned). */
export const FALLBACK_CATEGORY_KEYS = ['malva-cat-phone-plans', 'malva-cat-home-wireless', 'malva-cat-cable-internet', 'malva-cat-add-ons'] as const;
/** Curated terms of the start state (there is no type-ahead, D-056). */
export const POPULAR_SEARCHES = {
  'en-US': ['Cable 500', 'Unlimited', 'Spotify', 'Router'],
  'de-DE': ['Cable 500', 'Unlimited', 'Spotify', 'Router'],
} as const;
