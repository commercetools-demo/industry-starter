import type { CheckoutState } from '@/lib/types';

/**
 * A refused checkout request: HTTP status, a stable code, and (when the cart exists) the state read back from the server so the steps
 * re-render from it. Not an ApiError: E's code set is closed and the checkout API has its own codes (like the bundle API).
 */
export class CheckoutRefusal extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    public state?: CheckoutState | null,
  ) {
    super(message);
    this.name = 'CheckoutRefusal';
  }
}
