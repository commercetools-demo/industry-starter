// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Masking of the order pages while a seller shops as a customer (Q-V25, workstream X C21): pure, shared by the loader the three order pages use.
import { maskEmail } from '@/lib/impersonation/state';
import type { OrderView } from '@/lib/types';

interface MaskableOrder {
  shippingAddress?: unknown;
  billingAddress?: unknown;
  customerEmail?: string;
}

/** Masked e-mail, no delivery address, no names of the recipient; order lines, totals and status stay. */
export function maskOrderPage<T extends { order: MaskableOrder; view: OrderView }>(page: T): T {
  const { order, view } = page;
  return {
    ...page,
    order: { ...order, shippingAddress: undefined, billingAddress: undefined, customerEmail: order.customerEmail ? maskEmail(order.customerEmail) : undefined },
    view: { ...view, email: view.email ? maskEmail(view.email) : null, shipTo: null },
  };
}
