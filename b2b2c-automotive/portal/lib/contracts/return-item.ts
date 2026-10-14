// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Shared return contract (workstream V-10). Pure, no server imports. The storefront keeps an IDENTICAL copy at
// `storefront/lib/contracts/return-item.ts` (the repo has no workspace); until that copy exists it is listed in plans/MISSED-FEATURES.md.

/** Return window: 30 days from delivery (owner Q-Q01). One constant, used by the portal and the storefront. */
export const RETURN_WINDOW_DAYS = 30;

export const RETURN_STATUSES = ['requested', 'in-transit', 'received', 'inspected', 'refunded', 'rejected'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_REASONS = ['wrong-fit', 'defective', 'no-longer-needed', 'damaged-in-transit', 'other'] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const OPEN_RETURN_STATUSES: readonly ReturnStatus[] = ['requested', 'in-transit', 'received', 'inspected'];
export const CLOSED_RETURN_STATUSES: readonly ReturnStatus[] = ['refunded', 'rejected'];

const NEXT: Record<ReturnStatus, readonly ReturnStatus[]> = {
  requested: ['in-transit', 'received', 'rejected'],
  'in-transit': ['received'],
  received: ['inspected'],
  inspected: ['refunded', 'rejected'],
  refunded: [],
  rejected: [],
};

export const isReturnStatus = (value: unknown): value is ReturnStatus => typeof value === 'string' && (RETURN_STATUSES as readonly string[]).includes(value);
export const isReturnReason = (value: unknown): value is ReturnReason => typeof value === 'string' && (RETURN_REASONS as readonly string[]).includes(value);

export const nextStatuses = (from: ReturnStatus): readonly ReturnStatus[] => NEXT[from];
export const canTransition = (from: ReturnStatus, to: ReturnStatus): boolean => NEXT[from].includes(to);

const DAY_MS = 86_400_000;

/** True while `now` is at most `RETURN_WINDOW_DAYS` days after `deliveredAt` (day 30 is accepted, day 31 is not). */
export function withinReturnWindow(deliveredAt: string | undefined | null, now: Date = new Date()): boolean {
  if (!deliveredAt) return false;
  const delivered = Date.parse(deliveredAt);
  if (Number.isNaN(delivered)) return false;
  return now.getTime() - delivered <= RETURN_WINDOW_DAYS * DAY_MS;
}

export type ReturnWindowProblem = 'NOT_DELIVERED' | 'RETURN_WINDOW_CLOSED';

/** `null` when a return may be requested, else the machine code of the refusal. */
export function returnWindowProblem(deliveredAt: string | undefined | null, now: Date = new Date()): ReturnWindowProblem | null {
  if (!deliveredAt || Number.isNaN(Date.parse(deliveredAt))) return 'NOT_DELIVERED';
  return withinReturnWindow(deliveredAt, now) ? null : 'RETURN_WINDOW_CLOSED';
}

export const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Requested',
  'in-transit': 'In transit',
  received: 'Received',
  inspected: 'Inspected',
  refunded: 'Refunded',
  rejected: 'Rejected',
};
export const statusLabel = (status: ReturnStatus): string => STATUS_LABELS[status];

export type NativeShipmentState = 'Advised' | 'Returned' | 'Unusable';
export type NativePaymentState = 'Initial' | 'Refunded' | 'NotRefunded';

/**
 * Native `returnInfo` states for a status (D5). `afterInspection` matters only for `rejected`: a return rejected before it was
 * inspected stays `Advised`, one rejected after inspection is `Unusable`.
 */
export function nativeStates(status: ReturnStatus, afterInspection = false): { shipmentState: NativeShipmentState; paymentState: NativePaymentState } {
  switch (status) {
    case 'requested':
    case 'in-transit':
      return { shipmentState: 'Advised', paymentState: 'Initial' };
    case 'received':
    case 'inspected':
      return { shipmentState: 'Returned', paymentState: 'Initial' };
    case 'refunded':
      return { shipmentState: 'Returned', paymentState: 'Refunded' };
    case 'rejected':
      return { shipmentState: afterInspection ? 'Unusable' : 'Advised', paymentState: 'NotRefunded' };
  }
}
