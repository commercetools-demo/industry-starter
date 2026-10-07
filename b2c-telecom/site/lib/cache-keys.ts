// SWR keys shared by hooks and the code that revalidates them.
export const KEY_SESSION = 'session';
/** The bundle (M): the key is the URL, so a server-rendered page can pass the cart as the SWR fallback. */
export const KEY_CART = '/api/cart';
// Account data of the signed-in customer (T). Every key starts with this prefix so that logout clears them all at once.
export const ACCOUNT_KEY_PREFIX = 'account:';
export const KEY_ADDRESSES = 'account:addresses';
export const KEY_PAYMENT_METHODS = 'account:payment-methods';
export const KEY_LISTS = 'account:lists';
export const keyList = (id: string): string => `account:lists:${id}`;
