import { listingHref, parseListingParams } from '@/lib/search/params';

// Listing URLs the home page links to, written by G's serializer so the format never drifts (never by hand).

const shop = (sp: Record<string, string>): string => listingHref('/shop', parseListingParams(sp, 'shop'), 'shop');

export const bestsellersHref = (): string => shop({ f_collection: 'bestseller' });
export const newArrivalsHref = (): string => shop({ f_collection: 'new' });
export const subscribableHref = (): string => shop({ f_collection: 'subscribable' });
/** Everything available at the chosen store (needs a chosen store to take effect, G). */
export const collectEligibleHref = (): string => shop({ avail: '1' });
export const categoryHref = (slug: string): string => `/category/${encodeURIComponent(slug)}`;
