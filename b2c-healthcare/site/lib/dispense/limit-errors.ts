import type { Refusal } from '@/lib/dispense/rules';

/**
 * Native inventory limits (`maxCartQuantity` / `minCartQuantity` on the inventory entry; the seed sets them from
 * `maxQtyPerOrder`) are enforced by the platform on cart create/update and order creation. Its 400 errors are mapped
 * here to the same `Refusal` shape the BFF rules produce, so the patient sees one message style.
 *
 * Error codes (docs: inventory-overview "Quantity limits"; carts-and-orders refresher):
 *  - `LineItemQuantityBelowLimit` { quantity, minCartQuantity }  (documented with a sample response)
 *  - `LineItemQuantityAboveLimit` { quantity, maxCartQuantity }  (the counterpart; exact field names unverified, see N-todos)
 * Pure module: no server imports.
 */

interface PlatformError { code?: unknown; quantity?: unknown; minCartQuantity?: unknown; maxCartQuantity?: unknown }

const asNumber = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Errors array of an SDK/HTTP error: `error.body.errors`, `error.errors` or a body passed directly. */
function errorsOf(error: unknown): PlatformError[] {
  if (typeof error !== 'object' || error === null) return [];
  const e = error as { body?: { errors?: unknown }; errors?: unknown };
  const list = e.body?.errors ?? e.errors;
  return Array.isArray(list) ? (list as PlatformError[]) : [];
}

export const LIMIT_CODES = ['LineItemQuantityAboveLimit', 'LineItemQuantityBelowLimit'] as const;

/** True when a thrown platform error is a quantity-limit violation. */
export const isLimitError = (error: unknown): boolean => errorsOf(error).some((e) => (LIMIT_CODES as readonly unknown[]).includes(e.code));

/**
 * Refusal for a platform limit error, or null when the error is something else.
 *  - above the limit: CEILING (scope `order`) with the ceiling, and the same number as what one order may hold;
 *  - below the minimum: CEILING (scope `order`) carrying the minimum as `ceiling` and `remaining: 0`. The seed sets
 *    no minimums, so this exists only so an unexpected platform refusal is not shown as a generic failure.
 */
export function mapLimitError(error: unknown): Refusal | null {
  for (const e of errorsOf(error)) {
    if (e.code === 'LineItemQuantityAboveLimit') {
      const max = asNumber(e.maxCartQuantity);
      return { reason: 'CEILING', scope: 'order', ceiling: max ?? 0, remaining: max ?? 0 };
    }
    if (e.code === 'LineItemQuantityBelowLimit') {
      const min = asNumber(e.minCartQuantity);
      return { reason: 'CEILING', scope: 'order', ceiling: min ?? 0, remaining: 0 };
    }
  }
  return null;
}
