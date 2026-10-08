/**
 * Central SWR keys (storefront-data-loading: Cache keys and invalidation).
 * Hooks and the root layout fallback import these; nobody writes a key string by hand.
 */
export const KEY_CART = 'cart';
/** Full cart with per-line re-validation (cart page). `KEY_CART` stays the cheap summary for the header. */
export const KEY_CART_DETAILS = 'cart-details';
export const KEY_ACCOUNT = 'account';
export const KEY_ADDRESSES = 'addresses';


/** Free times of one doctor in one mode (workstream L). Never cached beyond the open page. */
export const keyDoctorSlots = (doctorKey: string, mode: string) => ['doctor-slots', doctorKey, mode] as const;

/** Checkout page state (cart, delivery options). Per patient and never shared; sign-out clears it. */
export const KEY_CHECKOUT = 'checkout';
