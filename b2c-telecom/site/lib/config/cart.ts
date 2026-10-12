// Feature constants of "My bundle" (workstream M). Never inline these numbers.
import { MAX_DEVICE_QUANTITY } from './devices';

/** D-014: one phone plan offer, quantity 1-5 = number of lines. */
export const MAX_PHONE_LINES = 5;

export const QUANTITY_RULES = {
  plan_phone: { min: 1, max: 5 },
  plan_other: { min: 1, max: 1 },
  /** Follows the parent plan. */
  addon: { min: 1, max: 5 },
  equipment: { min: 1, max: 1 },
  /** Per device line (one mode and term of one variant); Q refines (workstream Q). */
  device: { min: 1, max: MAX_DEVICE_QUANTITY },
} as const;

/** Cents; 0 disables. Confirmed by the owner (D-063). */
export const DEFAULT_MINIMUM_ORDER_VALUE: Record<'USD' | 'EUR', number> = { USD: 3000, EUR: 2800 };

/** `MINIMUM_ORDER_USD` / `MINIMUM_ORDER_EUR` (whole cents, 0 disables) override the default; anything that is not a non-negative integer is ignored. */
export function minimumOrderValues(env: Record<string, string | undefined> = process.env): Record<'USD' | 'EUR', number> {
  const read = (name: string, fallback: number): number => {
    const raw = env[name]?.trim();
    return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : fallback;
  };
  return { USD: read('MINIMUM_ORDER_USD', DEFAULT_MINIMUM_ORDER_VALUE.USD), EUR: read('MINIMUM_ORDER_EUR', DEFAULT_MINIMUM_ORDER_VALUE.EUR) };
}

/** One extra attempt after a ConcurrentModification (409). */
export const CART_RETRY_ONCE = 1;

/** Custom line item slug = prefix + offerKey. */
export const ACTIVATION_FEE_SLUG_PREFIX = 'activation-fee:';

/** The placeholder tax category seeded by F/G (D-044, `scripts/seed/data/tax.ts`). */
export const ACTIVATION_FEE_TAX_CATEGORY_KEY = 'malva-telecom-services';

/** Cart draft: commercetools deletes an untouched cart after this many days. */
export const CART_DELETE_DAYS = 90;
/** Probe carts of the discount prompt (they are deleted right away; this is the safety net). */
export const PROBE_CART_DELETE_DAYS = 1;
export const PROBE_CART_KEY_PREFIX = 'prompt-probe-';
/** The plan finder's price preview prices a throwaway cart too; a leftover is found by this key prefix and swept. */
export const PREVIEW_PROBE_KEY_PREFIX = 'preview-probe-';

export const PROMPT_MAX_CANDIDATES = 3;

/** Fee line names (custom line items have no catalog name). */
export const ACTIVATION_FEE_NAME = { 'en-US': 'Activation fee', 'de-DE': 'Aktivierungsgebühr' } as const;

/** Postal code check of POST /api/cart/address: five digits in both markets. */
export const POSTAL_CODE_PATTERN = /^\d{5}$/;
