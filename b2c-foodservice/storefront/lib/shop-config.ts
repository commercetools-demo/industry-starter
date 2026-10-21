// Shop-wide constants that no commercetools field holds. Each names the question that owns it.

/** Promise bar "N-day returns" (Q-F-04: owner to confirm; VELA's 90 is a placeholder). */
export const RETURN_DAYS = 30;

/** Quantity at or below which a store or the warehouse shows "Low stock" (Q-F-05). */
export const LOW_STOCK_THRESHOLD = 5;

/** A store farther than this from the search origin counts as "no match" (Q-F-01). */
export const NEARBY_RADIUS_KM = 80;

/** Minutes shown when a store channel has no collectionMinutes field (Q-F-06). */
export const COLLECTION_MINUTES_FALLBACK = 30;

/**
 * Region switch with a populated bag (Q-F-03). F resets the bag; workstream I flips this to true
 * when it adds carry over (task I-12).
 */
export const CART_CARRY_OVER_ENABLED = false;

/**
 * Shipping mode of every new cart (D-024). Settable only when a cart is created; workstream K may flip it to
 * 'Multiple' after its mixed-bag spike. Added by workstream G.
 */
export const CART_SHIPPING_MODE: 'Single' | 'Multiple' = 'Single';

// Workstream H: product detail.

/** Delivery estimate rule (Q-H-02, owner decision SO-x2): an order before the cut-off hour (market time zone) ships the same business day. */
export const DELIVERY_CUTOFF_HOUR = 14;
/** Standard delivery takes this many business days (weekends skipped). */
export const SHIP_DAYS_MIN = 2;
export const SHIP_DAYS_MAX = 4;
/** Highest quantity the stepper offers (Q-H-08), further limited by inventory `maxCartQuantity` and stock. */
export const PDP_MAX_QUANTITY = 99;
/** M's reviews section mounts on the product page when true (workstream M turned it on, Q-H-14). */
export const REVIEWS_ENABLED = true;
