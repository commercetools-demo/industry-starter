import { DEV_NOW_OFFSET_MAX_DAYS } from '@/lib/config/postPurchase';

const DAY_MS = 86_400_000;

/**
 * "Now" for the cancel and return windows. In `next dev` only, DEV_NOW_OFFSET_DAYS (an integer 0..400) moves it forward so a
 * check can age an order; it is ignored in every other environment, production included.
 */
export function postPurchaseNow(): Date {
  if (process.env.NODE_ENV === 'development') {
    const raw = process.env.DEV_NOW_OFFSET_DAYS;
    const days = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
    if (Number.isInteger(days) && days >= 0 && days <= DEV_NOW_OFFSET_MAX_DAYS) return new Date(Date.now() + days * DAY_MS);
  }
  return new Date();
}
