// Feature constants of the category listings (workstream N). The page size lives in `lib/config/facets.ts` (H).

/** Most bullets a plan card shows. */
export const MAX_BULLETS = 4;
/** Page numbers shown before the pagination collapses into ellipses. */
export const PAGINATION_MAX_NUMBERS = 7;
/** Add-ons the upsell band names, preferred first (offer keys); more are taken from the other streaming add-ons. */
export const UPSELL_FEATURED_OFFER_KEYS: readonly string[] = ['malva-offer-spotify', 'malva-offer-appletv'];
/** Add-ons category: the listing the "Browse add-ons" links and the needs-plan links point to. */
export const ADDONS_CATEGORY_KEY = 'malva-cat-add-ons';
/** Where "Choose a plan" leads for an add-on that needs a plan of this family. */
export const PLAN_CATEGORY_BY_FAMILY = {
  internet: 'malva-cat-cable-internet',
  phone: 'malva-cat-phone-plans',
} as const;
/** Query parameter M's "Change" link uses to name the plan line an add-on is for. */
export const FOR_PARAM = 'for';
