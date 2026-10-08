/**
 * Route Handler paths used by client hooks. Hooks import these constants instead of writing
 * a literal `fetch('/api/...')` (lint rule: no literal endpoint calls in components, hooks, context).
 */
export const API_CART = '/api/cart';
export const API_ACCOUNT = '/api/account';
export const API_LOCALE = '/api/locale';
export const API_AUTH_LOGIN = '/api/auth/login';
export const API_AUTH_REGISTER = '/api/auth/register';
export const API_AUTH_LOGOUT = '/api/auth/logout';
export const API_AUTH_ME = '/api/auth/me';
export const API_ACCOUNT_PASSWORD = '/api/account/password';
export const API_PRESCRIPTIONS = '/api/prescriptions';
export const API_PRESCRIPTIONS_LOOKUP = '/api/prescriptions/lookup';
/** Implemented by the cart workstream (O). */
export const API_CART_RX_LINES = '/api/cart/rx-lines';
