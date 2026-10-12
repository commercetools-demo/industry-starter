// Stable, typed errors of the offer and pricing-preview APIs: the shared body `{ error: { code, message, details? } }` with codes of
// this API only (like the auth codes). Never carries commercetools text.
export type OffersApiCode =
  | 'INVALID_FILTER'
  | 'INVALID_REQUEST'
  | 'INVALID_PLAN'
  | 'INVALID_QUANTITY'
  | 'OFFER_NOT_FOUND'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL';

const STATUS: Record<OffersApiCode, number> = {
  INVALID_FILTER: 400,
  INVALID_REQUEST: 400,
  INVALID_PLAN: 400,
  INVALID_QUANTITY: 400,
  OFFER_NOT_FOUND: 404,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 502,
  INTERNAL: 500,
};

export class OffersApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: OffersApiCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OffersApiError';
    this.status = STATUS[code];
  }

  toBody(): { error: { code: OffersApiCode; message: string; details?: Record<string, unknown> } } {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}

export const UPSTREAM_MESSAGE = 'The catalog is temporarily unavailable.';
