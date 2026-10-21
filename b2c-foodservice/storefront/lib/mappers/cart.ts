import type { Cart } from '@commercetools/platform-sdk';
import type { CartSummary } from '@/lib/types';

/** Minimal cart for the quick add path (workstream I replaces it with the full cart mapper and keeps these fields). */
export function mapCartSummary(c: Pick<Cart, 'id' | 'version' | 'lineItems' | 'totalLineItemQuantity'>): CartSummary {
  return {
    id: c.id,
    version: c.version,
    count: c.totalLineItemQuantity ?? c.lineItems.reduce((n, l) => n + l.quantity, 0),
    lines: c.lineItems.map((l) => ({ id: l.id, sku: l.variant?.sku ?? '', quantity: l.quantity })),
  };
}
