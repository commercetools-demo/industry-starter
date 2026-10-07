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
export const MINIMUM_ORDER_VALUE: Record<'USD' | 'EUR', number> = { USD: 3000, EUR: 2800 };

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

export const PROMPT_MAX_CANDIDATES = 3;

/**
 * L's spike decides how one-time lines are created. `false` (architecture A / A-prime, the best guess recorded in
 * PROJECT-FINDINGS `SPIKE-L`): one-time variants are normal line items without `recurrenceInfo`.
 */
export const ONE_TIME_AS_CUSTOM_LINE_ITEM = false;

/** Fee line names (custom line items have no catalog name). */
export const ACTIVATION_FEE_NAME = { 'en-US': 'Activation fee', 'de-DE': 'Aktivierungsgebühr' } as const;

/** Postal code check of POST /api/cart/address: five digits in both markets. */
export const POSTAL_CODE_PATTERN = /^\d{5}$/;
