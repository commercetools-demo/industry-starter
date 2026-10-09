/** Client-state keys (SWR). Business-Unit-scoped entries are `[KEY, businessUnitKey]` tuples (malva-data-loading › Keys). */
export const KEY_ACCOUNT = 'account';
export const KEY_CART = 'quote-list';
export const KEY_BUSINESS_UNITS = 'business-units';
export const KEY_QUOTE_CONTEXT = 'quote-context';

/** Portal quotes, sites and team (workstreams R and S): all Business-Unit-scoped tuples. */
export const KEY_QUOTES = 'portal-quotes';
export const KEY_SITES = 'portal-sites';
export const KEY_TEAM = 'portal-team';

export const CLIENT_KEYS = [KEY_QUOTES, KEY_SITES, KEY_TEAM, KEY_ACCOUNT, KEY_CART, KEY_BUSINESS_UNITS, KEY_QUOTE_CONTEXT] as const;

export const buKey = (key: string, businessUnitKey: string | null | undefined): readonly [string, string | null] => [key, businessUnitKey ?? null];

/** The key family of a cache key, whether it is a plain string or a tuple. */
export const familyOf = (key: unknown): string | undefined => (Array.isArray(key) ? String(key[0]) : typeof key === 'string' ? key : undefined);
