// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure model of the Subscriptions screen (V-07, V-08): RecurringOrder to row, monthly equivalent, transition table, KPIs.
import type { SubscriptionList, SubscriptionRow, SubscriptionStatus } from '@/lib/v-types';

/** The parts of a commercetools RecurringOrder (with `cart` and `customer` expanded) the screen reads. */
export interface RecurringOrderInput {
  id: string;
  recurringOrderState: string;
  schedule: { type: string; value?: number; intervalUnit?: string; day?: number };
  nextOrderAt?: string;
  skipConfiguration?: { type?: string; totalToSkip?: number; skipped?: number };
  customerEmail?: string;
  customer?: { id: string; obj?: { firstName?: string; lastName?: string; email?: string } };
  cart: { obj?: { totalPrice: { centAmount: number; currencyCode: string }; lineItems: { quantity: number; name: Record<string, string> }[] } };
}

const DAY_MS = 86_400_000;
export const RENEWAL_DAYS = 7;

export type Schedule = SubscriptionRow['interval'];

export function scheduleOf(schedule: RecurringOrderInput['schedule']): Schedule {
  if (schedule.type === 'dayOfMonth') return { kind: 'dayOfMonth', day: schedule.day ?? 1 };
  const unit = schedule.intervalUnit === 'Days' || schedule.intervalUnit === 'Weeks' ? schedule.intervalUnit : 'Months';
  return { kind: 'standard', value: Math.max(1, schedule.value ?? 1), unit };
}

/** Value of one renewal per month: Months n total/n; Weeks n total*52/12/n; Days n total*30.4375/n; day of month: total. */
export function monthlyCents(schedule: Schedule, totalCents: number): number {
  if (schedule.kind === 'dayOfMonth') return totalCents;
  const { value, unit } = schedule;
  const factor = unit === 'Months' ? 1 : unit === 'Weeks' ? 52 / 12 : 30.4375;
  return Math.round((totalCents * factor) / value);
}

/** Status word of a commercetools state; Expired and Failed show as Canceled with the "Needs attention" chip. */
export function statusOf(state: string): { status: SubscriptionStatus; needsAttention: boolean } {
  if (state === 'Active') return { status: 'Active', needsAttention: false };
  if (state === 'Paused') return { status: 'Paused', needsAttention: false };
  if (state === 'Canceled') return { status: 'Canceled', needsAttention: false };
  return { status: 'Canceled', needsAttention: true };
}

const NEXT: Record<string, readonly string[]> = {
  Active: ['Paused', 'Canceled'],
  Paused: ['Active', 'Canceled'],
  Canceled: [],
  Expired: [],
  // A failed recurring order stays failed until it is set back to Active (docs, Recurring Orders overview > Failed).
  Failed: ['Active', 'Canceled'],
};
/** Active to Paused or Canceled; Paused to Active or Canceled; Failed to Active (retry) or Canceled; Canceled and Expired are final (V-08). */
export const canSubscriptionTransition = (from: string, to: string): boolean => (NEXT[from] ?? []).includes(to);

/** What a row action does to the state: `skip` keeps it. Returns null when the state does not allow it. */
export function actionTarget(from: string, action: 'pause' | 'resume' | 'cancel' | 'skip'): string | null {
  if (action === 'skip') return from === 'Active' ? 'Active' : null;
  const to = action === 'pause' ? 'Paused' : action === 'resume' ? 'Active' : 'Canceled';
  return canSubscriptionTransition(from, to) ? to : null;
}

const nameOf = (obj: NonNullable<RecurringOrderInput['customer']>['obj'], fallback: string): string => {
  const full = [obj?.firstName?.trim(), obj?.lastName?.trim()].filter(Boolean).join(' ');
  return full || fallback;
};

export function mapSubscription(order: RecurringOrderInput, locale = 'en-US'): SubscriptionRow {
  const cart = order.cart.obj;
  const interval = scheduleOf(order.schedule);
  const { status, needsAttention } = statusOf(order.recurringOrderState);
  const total = cart?.totalPrice.centAmount ?? 0;
  const skip = order.skipConfiguration;
  const open = status === 'Active';
  return {
    id: order.id,
    customerId: order.customer?.id ?? null,
    customer: nameOf(order.customer?.obj, '-'),
    items: (cart?.lineItems ?? []).map((l) => ({ quantity: l.quantity, name: l.name[locale] ?? Object.values(l.name)[0] ?? '' })),
    interval,
    status,
    state: order.recurringOrderState,
    needsAttention,
    valueCents: total,
    currency: cart?.totalPrice.currencyCode ?? 'EUR',
    monthlyCents: monthlyCents(interval, total),
    nextOrderAt: open && order.nextOrderAt ? order.nextOrderAt : null,
    skipsRemaining: skip && skip.type === 'Counter' ? Math.max(0, (skip.totalToSkip ?? 0) - (skip.skipped ?? 0)) : 0,
  };
}

/** KPIs (Monthly recurring sums the Active ones) and the panel "Renewals in the next 7 days" (Active with nextOrderAt inside it). */
export function summarize(rows: SubscriptionRow[], now: Date = new Date()): SubscriptionList {
  const active = rows.filter((r) => r.status === 'Active');
  const until = now.getTime() + RENEWAL_DAYS * DAY_MS;
  return {
    rows,
    kpis: {
      monthlyCents: active.reduce((sum, r) => sum + r.monthlyCents, 0),
      currency: rows[0]?.currency ?? 'EUR',
      active: active.length,
      paused: rows.filter((r) => r.status === 'Paused').length,
      canceled: rows.filter((r) => r.status === 'Canceled').length,
    },
    renewals: active.filter((r) => r.nextOrderAt !== null && Date.parse(r.nextOrderAt) <= until).sort((a, b) => (a.nextOrderAt ?? '').localeCompare(b.nextOrderAt ?? '')),
  };
}
