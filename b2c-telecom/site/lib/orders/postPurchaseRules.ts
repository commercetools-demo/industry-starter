// Pure rules of post-purchase order management (workstream V): who may cancel or return what, and the update actions that record it.
// No I/O and no SDK import: the order page (server) and the dialogs (client) use the same functions.

import {
  CANCEL_NOTE_MAX,
  CANCEL_REASONS,
  CANCEL_WINDOW_INCLUSIVE,
  DEVICE_RETURN_WINDOW_DAYS,
  RETURN_NOTE_MAX,
  RETURN_REASONS,
} from '@/lib/config/postPurchase';
import { addDays, parseDateOnly } from '@/lib/pricing/dates';
import type { CancelReason, CancellationRecord, Order, ReturnReason } from '@/lib/types';

const DAY_MS = 86_400_000;

export type CancelBlock = 'ALREADY_CANCELLED' | 'ORDER_COMPLETE' | 'SERVICE_STARTED' | 'NO_START_DATE' | 'EQUIPMENT_SHIPPED' | 'HAS_RETURN';
export type ReturnBlock = 'ORDER_CANCELLED' | 'WINDOW_CLOSED' | 'NO_RETURNABLE_LINES';

/** Update actions of the Orders API that V writes (structurally the SDK's `OrderUpdateAction`; the SDK stays on the server). */
export type OrderUpdateAction =
  | { action: 'changeOrderState'; orderState: 'Cancelled' }
  | { action: 'setCustomField'; name: string; value: string }
  | { action: 'setCustomType'; type: { typeId: 'type'; key: string }; fields: Record<string, string> }
  | {
      action: 'addReturnInfo';
      returnDate: string;
      items: { key: string; lineItemId: string; quantity: number; comment: string; shipmentState: 'Advised' }[];
    };

export const ORDER_CUSTOM_TYPE_KEY = 'malva-order';

type CancelOrderView = Pick<Order, 'orderState' | 'serviceStartDate' | 'shipmentState' | 'returns'>;

export function cancelEligibility(order: CancelOrderView, now: Date): { allowed: true; until: string } | { allowed: false; block: CancelBlock } {
  if (order.orderState === 'Cancelled') return { allowed: false, block: 'ALREADY_CANCELLED' };
  if (order.orderState === 'Complete') return { allowed: false, block: 'ORDER_COMPLETE' };
  const start = order.serviceStartDate ? parseDateOnly(order.serviceStartDate) : null;
  if (start === null) return { allowed: false, block: 'NO_START_DATE' }; // fail closed
  if (order.shipmentState === 'Shipped' || order.shipmentState === 'Delivered' || order.shipmentState === 'Partial') {
    return { allowed: false, block: 'EQUIPMENT_SHIPPED' };
  }
  if (order.returns.length > 0) return { allowed: false, block: 'HAS_RETURN' };
  const closesAt = start.getTime() + (CANCEL_WINDOW_INCLUSIVE ? DAY_MS : 0);
  if (now.getTime() >= closesAt) return { allowed: false, block: 'SERVICE_STARTED' };
  return { allowed: true, until: CANCEL_WINDOW_INCLUSIVE ? order.serviceStartDate : addDays(order.serviceStartDate, -1) };
}

export interface ReturnableLine {
  lineItemId: string;
  name: string;
  quantityOrdered: number;
  quantityAlreadyRequested: number;
  quantityAvailable: number;
}

type ReturnOrderView = Pick<Order, 'orderState' | 'createdAt' | 'returns'> & { lines: Pick<Order['lines'][number], 'id' | 'name' | 'quantity' | 'acquisition'>[] };

/** Device lines (those with acquisition fields) with what is still returnable: ordered quantity minus every earlier request. */
export function returnableLines(order: Pick<ReturnOrderView, 'lines' | 'returns'>): ReturnableLine[] {
  const requested = new Map<string, number>();
  for (const request of order.returns) for (const item of request.items) requested.set(item.lineItemId, (requested.get(item.lineItemId) ?? 0) + item.quantity);
  return order.lines
    .filter((line) => line.acquisition !== null)
    .map((line) => {
      const already = requested.get(line.id) ?? 0;
      return { lineItemId: line.id, name: line.name, quantityOrdered: line.quantity, quantityAlreadyRequested: already, quantityAvailable: Math.max(0, line.quantity - already) };
    });
}

export function returnEligibility(order: ReturnOrderView, now: Date): { allowed: true; lines: ReturnableLine[]; until: string } | { allowed: false; block: ReturnBlock } {
  if (order.orderState === 'Cancelled') return { allowed: false, block: 'ORDER_CANCELLED' };
  const created = Date.parse(order.createdAt);
  const closesAt = created + DEVICE_RETURN_WINDOW_DAYS * DAY_MS;
  if (Number.isNaN(created) || now.getTime() > closesAt) return { allowed: false, block: 'WINDOW_CLOSED' };
  const lines = returnableLines(order).filter((line) => line.quantityAvailable > 0);
  if (lines.length === 0) return { allowed: false, block: 'NO_RETURNABLE_LINES' };
  return { allowed: true, lines, until: new Date(closesAt).toISOString().slice(0, 10) };
}

/** What the update builders need to know about the order's custom type. */
export interface CustomTypeView {
  /** Key of the order's custom type, or null/undefined when the order has none. */
  customTypeKey?: string | null | undefined;
}

function customFieldAction(order: CustomTypeView, name: string, value: string): OrderUpdateAction {
  return order.customTypeKey === ORDER_CUSTOM_TYPE_KEY
    ? { action: 'setCustomField', name, value }
    : { action: 'setCustomType', type: { typeId: 'type', key: ORDER_CUSTOM_TYPE_KEY }, fields: { [name]: value } };
}

export function buildCancelActions(order: CustomTypeView, input: { reason: CancelReason; note?: string }, now: Date): OrderUpdateAction[] {
  const record: CancellationRecord = { reason: input.reason, ...(input.note ? { note: input.note } : {}), cancelledAt: now.toISOString(), by: 'customer' };
  return [{ action: 'changeOrderState', orderState: 'Cancelled' }, customFieldAction(order, 'cancellation', JSON.stringify(record))];
}

export interface ReturnRequestEntry {
  requestedAt: string;
  reason: ReturnReason;
  note?: string;
  lineItemIds: string[];
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
const stamp = (now: Date): string =>
  `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}`;

function parseRequests(json: string | null | undefined): ReturnRequestEntry[] {
  if (typeof json !== 'string' || json === '') return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ReturnRequestEntry[]) : [];
  } catch {
    return [];
  }
}

export function buildReturnActions(
  order: CustomTypeView & { returnRequestJson?: string | null | undefined },
  input: { items: { lineItemId: string; quantity: number }[]; reason: ReturnReason; note?: string },
  now: Date,
): OrderUpdateAction[] {
  const comment = input.note ? `${input.reason}: ${input.note}` : input.reason;
  const entry: ReturnRequestEntry = { requestedAt: now.toISOString(), reason: input.reason, ...(input.note ? { note: input.note } : {}), lineItemIds: input.items.map((item) => item.lineItemId) };
  return [
    {
      action: 'addReturnInfo',
      returnDate: now.toISOString(),
      items: input.items.map((item, index) => ({ key: `ret-${stamp(now)}-${index + 1}`, lineItemId: item.lineItemId, quantity: item.quantity, comment, shipmentState: 'Advised' as const })),
    },
    customFieldAction(order, 'returnRequest', JSON.stringify([...parseRequests(order.returnRequestJson), entry])),
  ];
}

// ---- input validation ----------------------------------------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

type NoteCode = 'NOTE_REQUIRED' | 'NOTE_TOO_LONG';

/** The note: trimmed; 'other' needs 1..max characters, any other reason 0..max. */
function checkNote(raw: unknown, required: boolean, max: number): { ok: true; note: string | undefined } | { ok: false; code: NoteCode } {
  const note = typeof raw === 'string' ? raw.trim() : '';
  if (note.length > max) return { ok: false, code: 'NOTE_TOO_LONG' };
  if (required && note === '') return { ok: false, code: 'NOTE_REQUIRED' };
  return { ok: true, note: note === '' ? undefined : note };
}

export type CancelInputCode = 'INVALID_REASON' | NoteCode;

export function validateCancelInput(body: unknown): { ok: true; value: { reason: CancelReason; note?: string } } | { ok: false; code: CancelInputCode } {
  const reason = isRecord(body) ? body.reason : undefined;
  if (typeof reason !== 'string' || !(CANCEL_REASONS as readonly string[]).includes(reason)) return { ok: false, code: 'INVALID_REASON' };
  const note = checkNote((body as Record<string, unknown>).note, reason === 'other', CANCEL_NOTE_MAX);
  if (!note.ok) return note;
  return { ok: true, value: { reason: reason as CancelReason, ...(note.note ? { note: note.note } : {}) } };
}

export type ReturnInputCode = 'INVALID_ITEMS' | 'QUANTITY_TOO_HIGH' | 'INVALID_REASON' | NoteCode;

export function validateReturnInput(
  body: unknown,
  lines: ReturnableLine[],
): { ok: true; value: { items: { lineItemId: string; quantity: number }[]; reason: ReturnReason; note?: string } } | { ok: false; code: ReturnInputCode } {
  if (!isRecord(body)) return { ok: false, code: 'INVALID_ITEMS' };
  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return { ok: false, code: 'INVALID_ITEMS' };
  const items: { lineItemId: string; quantity: number }[] = [];
  const seen = new Set<string>();
  let tooHigh = false;
  for (const raw of rawItems) {
    if (!isRecord(raw) || typeof raw.lineItemId !== 'string' || typeof raw.quantity !== 'number' || !Number.isInteger(raw.quantity) || raw.quantity < 1) {
      return { ok: false, code: 'INVALID_ITEMS' };
    }
    const line = lines.find((candidate) => candidate.lineItemId === raw.lineItemId);
    if (!line || seen.has(raw.lineItemId)) return { ok: false, code: 'INVALID_ITEMS' };
    seen.add(raw.lineItemId);
    if (raw.quantity > line.quantityAvailable) tooHigh = true;
    items.push({ lineItemId: raw.lineItemId, quantity: raw.quantity });
  }
  if (tooHigh) return { ok: false, code: 'QUANTITY_TOO_HIGH' };
  const reason = body.reason;
  if (typeof reason !== 'string' || !(RETURN_REASONS as readonly string[]).includes(reason)) return { ok: false, code: 'INVALID_REASON' };
  const note = checkNote(body.note, reason === 'other', RETURN_NOTE_MAX);
  if (!note.ok) return note;
  return { ok: true, value: { items, reason: reason as ReturnReason, ...(note.note ? { note: note.note } : {}) } };
}
