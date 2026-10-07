import { CartError } from '@/hooks/useCart';
import type { BlockedAdd, Cart, CartLine } from '@/lib/types';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });

/** A cart line with sensible defaults; only what a listing test cares about is passed. */
export function cartLine(patch: Partial<CartLine> & Pick<CartLine, 'id' | 'offerKey' | 'kind'>): CartLine {
  return {
    source: 'line-item',
    sku: `${patch.offerKey}-sku`,
    name: patch.offerKey,
    family: null,
    technology: null,
    bullets: [],
    description: '',
    quantity: 1,
    termMonths: 0,
    chargeType: 'recurring',
    recurrence: null,
    unitListPrice: usd(1000),
    unitPrice: usd(1000),
    total: usd(1000),
    appliedDiscountKeys: [],
    parentLineId: null,
    includedAtNoCharge: false,
    requiredEquipment: false,
    schedule: null,
    label: null,
    stock: null,
    ...patch,
  };
}

export function cartOf(lines: CartLine[]): Cart {
  return {
    id: 'cart-1',
    version: 1,
    currencyCode: 'USD',
    country: 'US',
    lines,
    itemCount: lines.filter((line) => line.kind !== 'fee').length,
    summary: { plans: usd(0), addons: usd(0), devicesMonthly: usd(0), monthly: usd(0), oneTime: usd(0), discountTotal: usd(0), tax: null, total: usd(0) },
    discountCodes: [],
    minimumOrder: null,
    issues: [],
    canCheckout: true,
    checkoutBlockedBy: [],
    postalCode: null,
  };
}

/** The refusal `useCartMutations` throws for an add the server blocked. */
export function blockedError(blocked: BlockedAdd): CartError {
  return new CartError('OFFER_BLOCKED', 'CONFLICT', 'blocked', blocked as unknown as Record<string, unknown>, 409);
}
