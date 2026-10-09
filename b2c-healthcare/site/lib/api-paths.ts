/**
 * Route Handler paths used by client hooks. Hooks import these constants instead of writing
 * a literal `fetch('/api/...')` (lint rule: no literal endpoint calls in components, hooks, context).
 */
export const API_CART = '/api/cart';
export const API_ACCOUNT = '/api/account';
export const API_LOCALE = '/api/locale';
export const API_AUTH_LOGIN = '/api/auth/login';
export const API_AUTH_DEMO_LOGIN = '/api/auth/demo-login';
export const API_AUTH_REGISTER = '/api/auth/register';
export const API_AUTH_LOGOUT = '/api/auth/logout';
export const API_AUTH_ME = '/api/auth/me';
export const API_ACCOUNT_PASSWORD = '/api/account/password';
export const API_ACCOUNT_ADDRESSES = '/api/account/addresses';
export const apiAccountAddress = (id: string) => `${API_ACCOUNT_ADDRESSES}/${encodeURIComponent(id)}`;
export const apiAccountAddressDefault = (id: string) => `${apiAccountAddress(id)}/default`;
export const API_ACCOUNT_PROFILE = '/api/account/profile';

export const API_BOOKINGS = '/api/bookings';
// Workstream R (account area)
export const API_ACCOUNT_OVERVIEW = '/api/account/overview';
export const API_ACCOUNT_LABS = '/api/account/labs';
export const apiAccountLabPdf = (id: string): string => `${API_ACCOUNT_LABS}/${encodeURIComponent(id)}/pdf`;
export const apiBookingCancel = (reference: string): string => `${API_BOOKINGS}/${encodeURIComponent(reference)}/cancel`;
export const apiDoctorSlots = (doctorKey: string, mode: string): string => `/api/doctors/${encodeURIComponent(doctorKey)}/slots?mode=${encodeURIComponent(mode)}`;

export const API_PRESCRIPTIONS = '/api/prescriptions';
export const API_PRESCRIPTIONS_LOOKUP = '/api/prescriptions/lookup';
export const API_CART_RX_LINES = '/api/cart/rx-lines';
/** Cart summary for the header count (cheap read, no re-validation). */
export const API_CART_SUMMARY = '/api/cart?view=summary';
export const apiCartLine = (id: string): string => `/api/cart/lines/${encodeURIComponent(id)}`;

// Workstream S (orders)
export const API_ORDERS = '/api/orders';
export const apiOrder = (id: string): string => `${API_ORDERS}/${encodeURIComponent(id)}`;
export const apiOrderCancel = (id: string): string => `${apiOrder(id)}/cancel`;
export const apiOrderReorder = (id: string): string => `${apiOrder(id)}/reorder`;

export const API_CHECKOUT = '/api/checkout';
export const API_CHECKOUT_ADDRESS = '/api/checkout/address';
export const API_CHECKOUT_SHIPPING_METHOD = '/api/checkout/shipping-method';
/** The pre-checkout gate: validates the cart and answers what to mount (workstream AA). */
export const API_CHECKOUT_PREPARE = '/api/checkout/prepare';
/** The browser's completion callback: finalizes the order Checkout created. */
export const API_CHECKOUT_COMPLETE = '/api/checkout/complete';
/** Development only (fake payment provider); answers 404 everywhere else. */
export const API_CHECKOUT_DEMO_AUTHORIZE = '/api/checkout/demo-authorize';

// Workstream T (saved lists, auto-refill, payment methods)
export const API_LISTS = '/api/lists';
export const API_LISTS_SAVE = '/api/lists/save';
export const apiList = (id: string): string => `${API_LISTS}/${encodeURIComponent(id)}`;
export const apiListLine = (id: string, lineId: string): string => `${apiList(id)}/lines/${encodeURIComponent(lineId)}`;
export const apiListAddAll = (id: string): string => `${apiList(id)}/add-all-to-cart`;
export const API_AUTO_REFILL = '/api/auto-refill';
export const apiAutoRefill = (id: string): string => `${API_AUTO_REFILL}/${encodeURIComponent(id)}`;
export const API_PAYMENT_METHODS = '/api/payment-methods';
export const apiPaymentMethod = (id: string, confirm = false): string => `${API_PAYMENT_METHODS}/${encodeURIComponent(id)}${confirm ? '?confirm=1' : ''}`;
export const apiPaymentMethodDefault = (id: string): string => `${API_PAYMENT_METHODS}/${encodeURIComponent(id)}/default`;

// Workstream U (funding): the restricted instrument choice and the allowance read. No write endpoint exists for an allowance.
export const API_CHECKOUT_TENDER = '/api/checkout/tender';
export const API_ACCOUNT_ALLOWANCE = '/api/account/allowance';
