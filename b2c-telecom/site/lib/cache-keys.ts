// SWR keys shared by hooks and the code that revalidates them.
export const KEY_SESSION = 'session';
/** The bundle (M): the key is the URL, so a server-rendered page can pass the cart as the SWR fallback. */
export const KEY_CART = '/api/cart';
// Account data of the signed-in customer (T). Every key starts with this prefix so that logout clears them all at once.
export const ACCOUNT_KEY_PREFIX = 'account:';
export const KEY_ADDRESSES = 'account:addresses';
export const KEY_PAYMENT_METHODS = 'account:payment-methods';
export const KEY_LISTS = 'account:lists';
/** V: the order the last cancel/return answered with (the order pages are server-rendered; `router.refresh()` shows the new state). */
export const keyOrder = (orderNumber: string): string => `account:orders:${orderNumber}`;
export const KEY_ORDERS = 'account:orders';
export const keyList =(id: string): string => `account:lists:${id}`;
/** The checkout state (U): the cart plus contact, addresses and delivery; the server page passes it as the SWR fallback. */
export const KEY_CHECKOUT = '/api/checkout/review';
