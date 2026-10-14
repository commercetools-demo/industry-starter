// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Order chip of the dashboard (S-01). Pure and client safe: no SDK import.
export type OrderChip = 'shipped' | 'processing' | 'payment-pending' | 'cancelled';
export type ChipTone = 'success' | 'info' | 'warning' | 'critical';

interface OrderStates {
  orderState?: string;
  shipmentState?: string;
  paymentState?: string;
}

/** First match wins: Cancelled, then Shipped or Delivered, then a payment that is not settled, otherwise processing. */
export function mapOrderStatus(order: OrderStates): OrderChip {
  if (order.orderState === 'Cancelled') return 'cancelled';
  if (order.shipmentState === 'Shipped' || order.shipmentState === 'Delivered') return 'shipped';
  if (order.paymentState === 'Pending' || order.paymentState === 'BalanceDue' || order.paymentState === 'Failed') return 'payment-pending';
  return 'processing';
}

export const CHIP_TONE: Record<OrderChip, ChipTone> = {
  shipped: 'success',
  processing: 'info',
  'payment-pending': 'warning',
  cancelled: 'critical',
};
