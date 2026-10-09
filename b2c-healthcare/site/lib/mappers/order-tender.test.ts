import { describe, expect, it } from 'vitest';
import type { Order } from '@commercetools/platform-sdk';
import { mapOrder, refundOf } from './order';

describe('the order mapper (U-09)', () => {
  const sdk = (): Order =>
    ({
      id: 'o1', orderNumber: 'MLV-000001', createdAt: '2026-10-08T12:00:00Z', state: { obj: { key: 'mlv-received' } },
      totalPrice: { type: 'centPrecision', currencyCode: 'USD', centAmount: 3135, fractionDigits: 2 },
      custom: { fields: { allowanceApplied: { centAmount: 1000 }, restrictedApplied: { centAmount: 1875 } } },
      lineItems: [
        { name: { 'en-US': 'Atorvastatin' }, quantity: 1, custom: { fields: { eligibleForRestricted: true, settlement: JSON.stringify({ allowance: 0, 'restricted-health-account': 1875, card: 0 }) } } },
        { name: { 'en-US': 'Alprazolam' }, quantity: 1, custom: { fields: { eligibleForRestricted: false, settlement: JSON.stringify({ allowance: 1000, 'restricted-health-account': 0, card: 260 }) } } },
      ],
      paymentInfo: { payments: [] },
    }) as unknown as Order;

  it('reads the per-line record and the tender split from the order itself', () => {
    const view = mapOrder(sdk(), 'en-US');
    expect(view.lines.map((l) => [l.eligible, l.settledBy])).toEqual([[true, ['restricted-health-account']], [false, ['allowance', 'card']]]);
    expect(view.tender).toMatchObject({ allowance: { centAmount: 1000 }, restricted: { centAmount: 1875 }, card: { centAmount: 260 } });
  });

  it('an order without the record has no tender and no per-line claims', () => {
    const plain = { ...sdk(), custom: undefined, lineItems: [{ name: { 'en-US': 'X' }, quantity: 1 }] } as unknown as Order;
    const view = mapOrder(plain, 'en-US');
    expect(view.tender).toBeUndefined();
    expect(view.lines[0]).toEqual({ name: 'X', quantity: 1 });
  });

  it('refund is "requested" while the card share is open even if the internal tenders are refunded', () => {
    const tx = (state: string) => ({ transactions: [{ type: 'Refund', state }] }) as never;
    expect(refundOf([tx('Success'), tx('Initial')])).toBe('requested');
    expect(refundOf([tx('Success')])).toBe('refunded');
    expect(refundOf([])).toBe('none');
  });
});
