// Every cache TTL (seconds) and the upstream read timeout. A TTL is the only cache invalidation: there are no webhooks in v1.
// Other workstreams only append constants here.
/** Categories change rarely; "New category appears without a deploy" within one minute. */
export const CATEGORY_TREE_TTL = 60;
/** Offers + facts: "Catalog edit changes behaviour" after the cache window. */
export const CATALOG_TTL = 60;
/** Product type key -> id. */
export const PRODUCT_TYPE_IDS_TTL = 3600;
/** Used by D/E if they validate markets against project settings. */
export const MARKET_VALIDATION_TTL = 300;
/** 5 minutes (D-020), used by K. */
export const SERVICEABILITY_TTL = 300;
/** Customer Group id -> key map (K's buyer context). */
export const CUSTOMER_GROUPS_TTL = 300;
/** Upstream read timeout (Error pages "Upstream fault"). */
export const CT_READ_TIMEOUT_MS = 8000;
