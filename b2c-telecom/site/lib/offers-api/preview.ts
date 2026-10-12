import type { AppliedPromotion, CartLine, CartSummary, Money } from '@/lib/types';
import { OffersApiError } from './errors';

// Pure. The body of POST /api/pricing/preview: a plan, optional sku and line count, and the extras to price with it.

export const MAX_EXTRAS = 12;
const OFFER_KEY = /^malva-offer-[a-z0-9-]+$/;
const SKU = /^MLV-[A-Z0-9-]+$/;

export interface PreviewExtra {
  offerKey: string;
  sku?: string;
}

export interface PreviewRequest {
  planKey: string;
  sku?: string;
  quantity: number;
  extras: PreviewExtra[];
}

const invalid = (message: string, code: 'INVALID_REQUEST' | 'INVALID_PLAN' | 'INVALID_QUANTITY' = 'INVALID_REQUEST', details?: Record<string, unknown>): OffersApiError => new OffersApiError(code, message, details);

export function parsePreview(body: unknown): PreviewRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw invalid('The request body must be a JSON object.');
  const { planKey, sku, quantity = 1, extras = [] } = body as Record<string, unknown>;
  if (typeof planKey !== 'string' || !OFFER_KEY.test(planKey)) throw invalid('planKey must be an offer key.', 'INVALID_PLAN', { field: 'planKey' });
  if (sku !== undefined && (typeof sku !== 'string' || !SKU.test(sku))) throw invalid('sku is not a valid SKU.', 'INVALID_PLAN', { field: 'sku' });
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) throw invalid('quantity must be a whole number of at least 1.', 'INVALID_QUANTITY', { field: 'quantity' });
  if (!Array.isArray(extras) || extras.length > MAX_EXTRAS) throw invalid(`extras must be a list of at most ${MAX_EXTRAS} items.`, 'INVALID_REQUEST', { field: 'extras' });
  const parsed: PreviewExtra[] = extras.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw invalid('Each extra must be an object.', 'INVALID_REQUEST', { field: `extras[${index}]` });
    const { offerKey, sku: extraSku } = entry as Record<string, unknown>;
    if (typeof offerKey !== 'string' || !OFFER_KEY.test(offerKey)) throw invalid('An extra needs an offerKey.', 'INVALID_REQUEST', { field: `extras[${index}].offerKey` });
    if (extraSku !== undefined && (typeof extraSku !== 'string' || !SKU.test(extraSku))) throw invalid('An extra sku is not a valid SKU.', 'INVALID_REQUEST', { field: `extras[${index}].sku` });
    return { offerKey, ...(extraSku === undefined ? {} : { sku: extraSku }) };
  });
  // The same extra twice is one extra: the cart merges them into one line.
  const seen = new Set<string>();
  const unique = parsed.filter((extra) => (seen.has(`${extra.offerKey}|${extra.sku ?? ''}`) ? false : (seen.add(`${extra.offerKey}|${extra.sku ?? ''}`), true)));
  return { planKey, ...(sku === undefined ? {} : { sku }), quantity, extras: unique };
}

// The answer of POST /api/pricing/preview (client-safe: the finder reads it).
export interface PreviewIssue {
  offerKey: string;
  name: string;
  /** `blocked`: the rules refuse it for this plan; `unavailable`: it cannot be priced. */
  kind: 'blocked' | 'unavailable';
  reasons: { code: string; message: string }[];
}

export interface PreviewLine {
  offerKey: string;
  sku: string | null;
  kind: CartLine['kind'];
  name: string;
  quantity: number;
  chargeType: CartLine['chargeType'];
  /** The engine's standing price per unit (selected for the buyer's group and channel). */
  unitListPrice: Money;
  /** The engine's total for the line for the order placed now (after first-order promotions). */
  total: Money;
  includedAtNoCharge: boolean;
}

export interface PreviewResult {
  dueToday: Money;
  thenMonthly: Money;
  summary: CartSummary;
  lines: PreviewLine[];
  promotions: AppliedPromotion[];
  issues: PreviewIssue[];
  /** Offers removed from the preview because the plan's extra replaces them (professional installation replaces the kit). */
  replaced: string[];
}
