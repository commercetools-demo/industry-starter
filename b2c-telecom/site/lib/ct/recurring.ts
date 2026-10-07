import 'server-only';
import { unstable_cache } from 'next/cache';
import { ApiError } from '@/lib/api-error';
import { RECURRENCE_POLICY_TTL_S } from '@/lib/config/cache';
import { MONTHLY_POLICY_KEY } from '@/lib/config/pricing';
import type { LineRecurrence, PriceSelectionMode } from '@/lib/types';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

/**
 * ApiError codes are a closed set (E), so the L-specific reasons travel in `details.reason`:
 * RECURRENCE_POLICY_MISSING (INTERNAL), RECURRING_PRICE_MISSING (VALIDATION), RECURRING_ORDER_BUSY (CONFLICT).
 */
export const RECURRING_REASON = {
  POLICY_MISSING: 'RECURRENCE_POLICY_MISSING',
  PRICE_MISSING: 'RECURRING_PRICE_MISSING',
  ORDER_BUSY: 'RECURRING_ORDER_BUSY',
} as const;

export interface RecurrencePolicyRef {
  id: string;
  key: string;
  version: number;
}

function statusOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null) {
    const e = err as { statusCode?: unknown; code?: unknown };
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (typeof e.code === 'number') return e.code;
  }
  return undefined;
}

/** GET /recurrence-policies/key=malva-monthly, cached RECURRENCE_POLICY_TTL_S. Throws RECURRENCE_POLICY_MISSING when absent. */
export async function getMonthlyPolicy(): Promise<RecurrencePolicyRef> {
  const read = unstable_cache(
    async (): Promise<RecurrencePolicyRef | null> => {
      try {
        const { body } = await withTimeout(getApiRoot().recurrencePolicies().withKey({ key: MONTHLY_POLICY_KEY }).get().execute(), 'recurring.policy');
        return { id: body.id, key: body.key ?? MONTHLY_POLICY_KEY, version: body.version };
      } catch (err) {
        if (statusOf(err) === 404) return null;
        throw err;
      }
    },
    ['recurrence-policy', MONTHLY_POLICY_KEY],
    { revalidate: RECURRENCE_POLICY_TTL_S },
  );
  const policy = await read();
  if (!policy) {
    throw new ApiError('INTERNAL', `Recurrence policy ${MONTHLY_POLICY_KEY} not found`, { reason: RECURRING_REASON.POLICY_MISSING });
  }
  return policy;
}

/** The `recurrenceInfo` of an `addLineItem` action (also `setLineItemRecurrenceInfo`). */
export function recurrenceInfoDraft(r: LineRecurrence): {
  recurrencePolicy: { typeId: 'recurrence-policy'; key: string };
  priceSelectionMode: PriceSelectionMode;
} {
  return { recurrencePolicy: { typeId: 'recurrence-policy', key: r.policyKey }, priceSelectionMode: r.priceSelectionMode };
}

/**
 * A recurring line whose variant has no price tied to the policy silently gets the one-time price. Call after addLineItem
 * and fail the add when the price carries no (or another) recurrence policy.
 */
export function assertRecurringPrice(line: { price?: { recurrencePolicy?: { id: string } } }, policy: RecurrencePolicyRef, sku: string): void {
  if (line.price?.recurrencePolicy?.id !== policy.id) {
    throw new ApiError('VALIDATION', `No recurring price for ${sku}`, { reason: RECURRING_REASON.PRICE_MISSING, sku });
  }
}
