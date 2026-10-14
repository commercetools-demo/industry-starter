// Domain errors of workstream T. Pure (no server imports): thrown by lib/ct/seller/* and lib/rules/*, mapped to a JSON body
// by `sellerHandle` (lib/portal/seller-route.ts). The status is one of 400, 403, 404 or 409: `lib/api.ts` keeps coded
// messages only for those statuses, and a 422 would be answered as a 500.
export class CatalogError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

export interface PriceViolation {
  sku: string;
  attemptedCents: number | null;
  code: string;
}
