import type { CustomerType } from '@/lib/types';

/** The storefront is one sales channel; an offer listing other channels only is not sold here. */
export const SALES_CHANNEL = 'online';
/** Remembered ZIP (HttpOnly). The country always comes from the market, never from the cookie. */
export const POSTAL_COOKIE = 'malva-postal-code';
export const POSTAL_COOKIE_MAX_AGE = 2_592_000; // 30 days

/** Customer Group keys (D-058). */
export const GROUP_EMPLOYEE = 'employee';
export const GROUP_SMALL_BUSINESS = 'small-business';
export const GROUP_EXISTING_CUSTOMER = 'existing-customer';

/** First match wins. */
export const CUSTOMER_TYPE_PRIORITY: readonly CustomerType[] = ['employee', 'small-business', 'consumer'];
