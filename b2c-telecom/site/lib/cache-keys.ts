// SWR keys shared by hooks and the code that revalidates them.
export const KEY_SESSION = 'session';
/** The bundle (M): the key is the URL, so a server-rendered page can pass the cart as the SWR fallback. */
export const KEY_CART = '/api/cart';
