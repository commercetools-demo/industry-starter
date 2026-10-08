// Feature constants of the checkout (workstream U). Never inline these.

/** D-061: the hosted Checkout runs in Payment Only mode (our steps own contact, address, delivery). `'checkout'` would run `checkoutFlow` after them. */
export type CheckoutFlow = 'payment' | 'checkout';
export const CHECKOUT_FLOW: CheckoutFlow = 'payment';

/** Install lead days per technology (D-023): the service starts this many days after the order date. */
export const INSTALL_LEAD_DAYS: Record<'cable' | 'fixed-wireless' | 'mobile', number> = { cable: 5, 'fixed-wireless': 0, mobile: 0 };

export const ORDER_NUMBER_PREFIX = 'MLV';
/** 8 characters of Crockford base32 (no I, L, O, U): about 40 bits, so the confirmation URL cannot be guessed. */
export const ORDER_NUMBER_LENGTH = 8;
export const ORDER_NUMBER_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ORDER_NUMBER_PATTERN = /^MLV-[0-9A-HJKMNP-TV-Z]{8}$/;
/** The reserved path segment the hosted Checkout returns to (`paymentReturnUrl`, one fixed URL per connector). */
export const RETURN_SEGMENT = 'return';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX = 254;

/** While the payment step is open the total is re-read on tab focus and every this many ms (D-042). */
export const TOTAL_RECHECK_MS = 60_000;
/** After this many failed `complete` calls the payment step links to the confirmation page, which can finalize lazily. */
export const COMPLETE_MAX_ATTEMPTS = 3;

/** The SDK knows `en-US` and `de`, not `de-DE`. */
export function sdkLocale(locale: string): string {
  return locale.toLowerCase().startsWith('de') ? 'de' : 'en-US';
}

/**
 * Demo-mode payment (no hosted Checkout, OA-05 not done): `CHECKOUT_DEMO_PAYMENT=true` forces it; unset means it is used only outside
 * production when no Checkout application key is configured. In production without a key checkout is unavailable (never fakes payment).
 */
export function isDemoPayment(env: Record<string, string | undefined> = process.env): boolean {
  const forced = env.CHECKOUT_DEMO_PAYMENT;
  if (forced === 'true' || forced === '1') return true;
  if (forced === 'false' || forced === '0') return false;
  return env.NODE_ENV !== 'production' && !env.CTP_CHECKOUT_APP_KEY;
}
