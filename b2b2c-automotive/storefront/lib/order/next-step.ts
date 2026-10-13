// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Timeline and next-step sentence of the confirmation page. Pure and free of SDK imports so the page components can use them in the
// browser too; `lib/mappers/order` re-exports both (workstream P-03).
import type { OrderStatus, OrderTimeline, OrderView, TimelineStepState } from '@/lib/types';

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The express method has no delivery window of its own (D4). */
export const SHIP_EXPRESS_KEY = 'mau-ship-express';

const STEP_KEYS = { pickup: ['received', 'ready', 'collected'], ship: ['received', 'shipped', 'delivered'] } as const;
const STEP_AT: Record<Exclude<OrderStatus, 'cancelled'>, number> = { placed: 0, 'ready-for-pickup': 1, shipped: 1, collected: 2, delivered: 2 };

/** Pickup: received, ready, collected. Ship: received, shipped, delivered. A cancelled order has no steps. */
export function buildTimeline(view: OrderView): OrderTimeline {
  if (view.status === 'cancelled') return { steps: [] };
  const current = STEP_AT[view.status];
  return { steps: STEP_KEYS[view.mode].map((key, index) => ({ key, state: (index < current ? 'done' : index === current ? 'current' : 'upcoming') as TimelineStepState })) };
}

/** The next-step sentence from the message catalogue (`order.next.*`, `order.window.*`); it never promises an email or a text message (D8). */
export function nextStepSentence(view: OrderView, t: Translate): string {
  const store = view.storeName;
  if (view.status === 'cancelled') return t('next.cancelled');
  if (view.mode === 'pickup') {
    const place = view.pickup?.branchName ?? store;
    const city = view.pickup?.address.city;
    if (view.status === 'collected') return t('next.collected', { store: place });
    const key = view.status === 'ready-for-pickup' ? 'pickupReady' : 'pickup';
    return city ? t(`next.${key}`, { store: place, city }) : t(`next.${key}NoCity`, { store: place });
  }
  if (view.status === 'delivered') return t('next.delivered');
  if (view.status === 'shipped') return t('next.shipped', { store });
  const window = view.shipWindow && view.shippingMethodKey !== SHIP_EXPRESS_KEY ? view.shipWindow : null;
  if (!window) return t('next.shipNoWindow', { store });
  const text = window.min === window.max ? t('window.same', { count: window.max }) : t('window.range', { min: window.min, max: window.max });
  return t('next.ship', { store, window: text });
}
