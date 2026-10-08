/**
 * Central SWR keys (storefront-data-loading: Cache keys and invalidation).
 * Hooks and the root layout fallback import these; nobody writes a key string by hand.
 */
export const KEY_CART = 'cart';
export const KEY_ACCOUNT = 'account';
export const KEY_ADDRESSES = 'addresses';


/** Free times of one doctor in one mode (workstream L). Never cached beyond the open page. */
export const keyDoctorSlots = (doctorKey: string, mode: string) => ['doctor-slots', doctorKey, mode] as const;
