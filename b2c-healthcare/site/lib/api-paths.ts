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
export const API_ACCOUNT_ADDRESSES = '/api/account/addresses';
export const apiAccountAddress = (id: string) => `${API_ACCOUNT_ADDRESSES}/${encodeURIComponent(id)}`;
export const apiAccountAddressDefault = (id: string) => `${apiAccountAddress(id)}/default`;
export const API_ACCOUNT_PROFILE = '/api/account/profile';

export const API_BOOKINGS = '/api/bookings';
export const apiDoctorSlots = (doctorKey: string, mode: string): string => `/api/doctors/${encodeURIComponent(doctorKey)}/slots?mode=${encodeURIComponent(mode)}`;
