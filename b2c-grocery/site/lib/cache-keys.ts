/** SWR keys. Components and hooks import these; never inline an `/api/...` string as a key. */
export const KEY_CART = 'cart';
export const KEY_ACCOUNT = 'account';
export const KEY_ORDERS = 'orders';
export const KEY_ADDRESSES = 'addresses';
export const KEY_WISHLIST = 'wishlist';
export const KEY_RECURRING = 'recurring';
export const KEY_PROFILE = 'profile';
/** Page 1 is `KEY_ORDERS`; later pages are `orders:<n>` (cleared on sign-out together with `order:<id>`). */
export const keyOrdersPage = (page: number): string => (page <= 1 ? KEY_ORDERS : `${KEY_ORDERS}:${page}`);
export const keyOrder =(id: string): string => `order:${id}`;
/** Proposals of one order; the `order:` prefix means sign-out clears them with the order caches. */
export const keyProposals = (orderId: string): string => `order:${orderId}:proposals`;
export const keySlots = (country: string, postalCode: string): string => `slots:${country}:${postalCode}`;
/** Saved products of the saved page, per locale (prefix `wishlist:`; the whole prefix is cleared on logout). */
export const keyWishlistProducts = (locale: string): string => `wishlist:products:${locale}`;
