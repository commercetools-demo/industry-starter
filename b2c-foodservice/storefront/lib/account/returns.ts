/** Reasons offered by the return dialog (`account.orders.return.reasons.*`); the English label is stored as the comment. */
export const RETURN_REASONS = {
  damaged: 'Damaged',
  wrong: 'Wrong item',
  notAsDescribed: 'Not as described',
  changedMind: 'Changed my mind',
} as const;
export type ReturnReasonKey = keyof typeof RETURN_REASONS;

export interface ReturnRequestLine { lineId: string; quantity: number; reason?: string }

export type ReturnValidation =
  | { ok: true; items: ReturnRequestLine[] }
  | { ok: false; fields: Record<string, string> };

const LINE_ID = /^[A-Za-z0-9-]{1,64}$/;
const MAX_LINES = 50;

/**
 * Validates `{ items: [{ lineId, quantity, reason? }] }` against the units still returnable per line. A shopper cannot
 * return more than remains (ordered minus everything already in `returnInfo`), a line twice, or an unknown line.
 */
export function validateReturnRequest(raw: unknown, returnable: Record<string, number>): ReturnValidation {
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) return { ok: false, fields: { items: 'required' } };
  const seen = new Set<string>();
  const out: ReturnRequestLine[] = [];
  const fields: Record<string, string> = {};
  items.forEach((entry, i) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const lineId = typeof e.lineId === 'string' && LINE_ID.test(e.lineId) ? e.lineId : null;
    const key = `items.${i}`;
    if (!lineId || !(lineId in returnable)) return void (fields[key] = 'unknown_line');
    if (seen.has(lineId)) return void (fields[key] = 'duplicate_line');
    seen.add(lineId);
    const quantity = e.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return void (fields[key] = 'quantity_invalid');
    if (quantity > (returnable[lineId] ?? 0)) return void (fields[key] = 'quantity_exceeds_returnable');
    let reason: string | undefined;
    if (e.reason !== undefined && e.reason !== null && e.reason !== '') {
      if (typeof e.reason !== 'string' || !(e.reason in RETURN_REASONS)) return void (fields[key] = 'reason_invalid');
      reason = RETURN_REASONS[e.reason as ReturnReasonKey];
    }
    out.push({ lineId, quantity, ...(reason ? { reason } : {}) });
  });
  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, items: out };
}
