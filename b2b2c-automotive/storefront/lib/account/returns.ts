// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Return rules of the shopper side (workstream Q-07, D6), pure. Produces exactly the portal's contract (`plans/notes/V-names.md`,
// `lib/contracts/return-item.ts`): native `addReturnInfo`, item `shipmentState: 'Advised'`, custom type `malva-return-item` with
// `returnNumber` (`RET-<orderNumber>-<n>`), `status: 'requested'` and `reason`; tracking id `RT-<yyyymmdd>-<5 base32>`.
import { RETURN_WINDOW_DAYS } from '@/lib/contracts/return-item';
import type { ReturnEligibility } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

export const RETURN_TYPE_KEY = 'malva-return-item';
const DAY_MS = 86_400_000;
const BASE32 = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';

interface ReturnItemLike {
  lineItemId: string;
  quantity: number;
  custom?: { fields?: Record<string, unknown> };
}
/** The slice of a commercetools order the return rules read. */
export interface ReturnableOrder {
  orderNumber?: string;
  shipmentState?: string;
  lastModifiedAt: string;
  custom?: { fields?: Record<string, unknown> };
  lineItems: Array<{ id: string; name: Record<string, string>; quantity: number }>;
  returnInfo?: Array<{ returnTrackingId?: string; items: ReturnItemLike[] }>;
}

/** The store's window (`store-settings.returnWindowDays`), 30 when absent or not positive. */
export const windowDaysOf = (setting: number | undefined | null): number => (typeof setting === 'number' && Number.isFinite(setting) && setting > 0 ? Math.floor(setting) : RETURN_WINDOW_DAYS);

/** `custom.deliveredAt` (set by the portal), else `lastModifiedAt` for an order that is delivered; null when it is not delivered. */
export function deliveredAtOf(order: ReturnableOrder): string | null {
  const own = order.custom?.fields?.deliveredAt;
  if (typeof own === 'string' && !Number.isNaN(Date.parse(own))) return own;
  return order.shipmentState === 'Delivered' ? order.lastModifiedAt : null;
}

/** Units already in a return, per line. Rejected returns do not count (the portal's rule). */
export function returnedQuantities(order: ReturnableOrder): Map<string, number> {
  const out = new Map<string, number>();
  for (const info of order.returnInfo ?? []) {
    for (const item of info.items) {
      if (item.custom?.fields?.status === 'rejected') continue;
      out.set(item.lineItemId, (out.get(item.lineItemId) ?? 0) + item.quantity);
    }
  }
  return out;
}

export function returnEligibility(order: ReturnableOrder, options: { now?: Date; locale: string; windowDays?: number | null }): ReturnEligibility {
  const now = options.now ?? new Date();
  const deliveredAt = deliveredAtOf(order);
  const returned = returnedQuantities(order);
  const lines = order.lineItems.map((line) => ({ lineItemId: line.id, name: getLocalizedString(line.name, options.locale), remaining: Math.max(0, line.quantity - (returned.get(line.id) ?? 0)) }));
  if (!deliveredAt) return { eligible: false, problem: 'not-delivered', deadline: null, lines };
  const days = windowDaysOf(options.windowDays);
  const deadline = new Date(Date.parse(deliveredAt) + days * DAY_MS).toISOString();
  if (now.getTime() > Date.parse(deadline)) return { eligible: false, problem: 'window-closed', deadline, lines };
  if (!lines.some((l) => l.remaining > 0)) return { eligible: false, problem: 'nothing-left', deadline, lines };
  return { eligible: true, problem: null, deadline, lines };
}

/** `RT-<yyyymmdd>-<5 base32>`, the portal's format. */
export function returnTrackingId(now: Date = new Date(), random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const code = [...random(5)].map((b) => BASE32[b % BASE32.length]).join('');
  return `RT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${code}`;
}

/** `RET-<orderNumber>-<n>` with the first n not used by an earlier return of the order (the portal groups items by this number). */
export function returnNumberFor(order: ReturnableOrder): string {
  const used = new Set<string>();
  for (const info of order.returnInfo ?? []) for (const item of info.items) if (typeof item.custom?.fields?.returnNumber === 'string') used.add(item.custom.fields.returnNumber);
  const base = order.orderNumber ?? 'order';
  let n = used.size + 1;
  while (used.has(`RET-${base}-${n}`)) n += 1;
  return `RET-${base}-${n}`;
}

export interface ReturnRequest {
  items: Array<{ lineItemId: string; quantity: number }>;
  reason: string;
  comment?: string;
}

export function buildReturnAction(order: ReturnableOrder, request: ReturnRequest, now: Date = new Date()) {
  const returnNumber = returnNumberFor(order);
  return {
    action: 'addReturnInfo' as const,
    returnTrackingId: returnTrackingId(now),
    returnDate: now.toISOString(),
    items: request.items.map((item) => ({
      lineItemId: item.lineItemId,
      quantity: item.quantity,
      ...(request.comment ? { comment: request.comment } : {}),
      shipmentState: 'Advised' as const,
      custom: { type: { typeId: 'type' as const, key: RETURN_TYPE_KEY }, fields: { returnNumber, status: 'requested', reason: request.reason } },
    })),
  };
}
