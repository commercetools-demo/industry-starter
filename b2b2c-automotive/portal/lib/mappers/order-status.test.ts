import { describe, expect, it } from 'vitest';
import { CHIP_TONE, mapOrderStatus } from './order-status';

describe('order status mapping', () => {
  it('shipped, processing, payment pending, cancelled map to success, info, warning, critical', () => {
    const cases = [
      [{ orderState: 'Open', shipmentState: 'Shipped', paymentState: 'Paid' }, 'shipped', 'success'],
      [{ orderState: 'Open', shipmentState: 'Delivered' }, 'shipped', 'success'],
      [{ orderState: 'Open', shipmentState: 'Pending', paymentState: 'Paid' }, 'processing', 'info'],
      [{ orderState: 'Open', paymentState: 'Pending' }, 'payment-pending', 'warning'],
      [{ orderState: 'Open', paymentState: 'BalanceDue' }, 'payment-pending', 'warning'],
      [{ orderState: 'Open', paymentState: 'Failed' }, 'payment-pending', 'warning'],
      [{ orderState: 'Cancelled' }, 'cancelled', 'critical'],
    ] as const;
    for (const [order, chip, tone] of cases) {
      expect(mapOrderStatus(order)).toBe(chip);
      expect(CHIP_TONE[chip]).toBe(tone);
    }
  });

  it('cancelled wins over shipped state', () => {
    expect(mapOrderStatus({ orderState: 'Cancelled', shipmentState: 'Shipped', paymentState: 'Failed' })).toBe('cancelled');
  });

  it('shipped wins over an open payment', () => {
    expect(mapOrderStatus({ orderState: 'Complete', shipmentState: 'Shipped', paymentState: 'Pending' })).toBe('shipped');
  });
});
