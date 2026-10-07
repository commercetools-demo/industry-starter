import { ApiError } from '@/lib/api-error';
import type { BlockedAdd, Cart } from '@/lib/types';

/**
 * A refused cart request. Carries the HTTP status, a stable code and, when there is one, the unchanged cart so the UI re-renders from
 * the server (never from local state). Not an ApiError: E's code set is closed and the bundle API has its own codes.
 */
export class BundleRefusal extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    public cart?: Cart | null,
  ) {
    super(message);
    this.name = 'BundleRefusal';
  }
}

const STATUS_OF_KIND: Record<BlockedAdd['kind'], number> = {
  incompatible: 409,
  conflict: 409,
  unavailable: 409,
  ineligible: 403,
  invalid: 422,
  limit: 422,
};

/** HTTP status of a blocked add (see the table in workstream M): 409 incompatible/conflict/unavailable, 403 ineligible, 422 invalid/limit. */
export const statusOfBlocked = (kind: BlockedAdd['kind']): number => STATUS_OF_KIND[kind];

/** `OFFER_BLOCKED` with the BlockedAdd as details (the UI renders the localized text from `details.reasons[].messageKey`). */
export function blockedRefusal(blocked: BlockedAdd, extra: Record<string, unknown> = {}): BundleRefusal {
  return new BundleRefusal(statusOfBlocked(blocked.kind), 'OFFER_BLOCKED', "That item can't be added to your bundle.", { ...blocked, ...extra });
}

const BY_REASON: Record<string, { status: number; code: string; message: string }> = {
  RECURRING_PRICE_MISSING: { status: 422, code: 'RECURRING_PRICE_MISSING', message: 'This item has no monthly price yet.' },
  HAS_DEPENDENTS: { status: 409, code: 'HAS_DEPENDENTS', message: 'Other items depend on this line.' },
  LINE_NOT_FOUND: { status: 404, code: 'LINE_NOT_FOUND', message: 'That line is not in your bundle.' },
  CART_CONFLICT: { status: 409, code: 'CART_CONFLICT', message: 'Your bundle changed at the same time. Please try again.' },
};

/** Maps an ApiError of the commercetools layer (`details.reason`) to the bundle API's status and code; null for anything else. */
export function refusalFromApiError(err: unknown): BundleRefusal | null {
  if (!(err instanceof ApiError)) return null;
  const reason = err.details?.reason;
  const mapped = typeof reason === 'string' ? BY_REASON[reason] : undefined;
  return mapped ? new BundleRefusal(mapped.status, mapped.code, mapped.message, err.details) : null;
}
