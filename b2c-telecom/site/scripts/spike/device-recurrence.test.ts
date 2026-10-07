import { describeRecurringOrder, deviceLineAction, firstGeneratedPaymentNumber, renderSpike } from './device-recurrence';

describe('device recurrence spike helpers', () => {
  it('a financed line carries the policy and Fixed, an outright line carries no recurrenceInfo', () => {
    expect(deviceLineAction('SKU-1', 'installments', 24, 'malva-offer-x')).toEqual({
      action: 'addLineItem',
      sku: 'SKU-1',
      quantity: 1,
      recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-device-installment-24' }, priceSelectionMode: 'Fixed' },
      custom: { type: { typeId: 'type', key: 'malva-line-item' }, fields: { offerKey: 'malva-offer-x', acquisitionMode: 'installments', acquisitionTermMonths: 24 } },
    });
    const outright = deviceLineAction('SKU-1', 'outright', 0, 'malva-offer-x');
    expect(outright).not.toHaveProperty('recurrenceInfo');
    expect((outright.custom as { fields: { acquisitionTermMonths: number } }).fields.acquisitionTermMonths).toBe(0);
    expect(deviceLineAction('SKU-2', 'lease', 24, 'malva-offer-x').recurrenceInfo).toMatchObject({ recurrencePolicy: { key: 'malva-device-lease-24' } });
  });

  it('measures which payment falls at startsAt from the gap to nextOrderAt', () => {
    expect(firstGeneratedPaymentNumber('2026-10-07T22:43:54.251Z', '2026-11-07T22:43:54.251Z')).toBe(1);
    expect(firstGeneratedPaymentNumber('2026-10-07T22:43:54.251Z', '2026-10-07T22:50:00.000Z')).toBe(2);
    expect(firstGeneratedPaymentNumber('2026-10-07T22:43:54.251Z', '2026-12-07T22:43:54.251Z')).toBeUndefined();
    expect(firstGeneratedPaymentNumber('2026-10-07T22:43:54.251Z', undefined)).toBeUndefined();
  });

  it('describes a recurring order by its schedule, lines and policy keys', () => {
    const keys: Record<string, string> = { 'p-1': 'malva-monthly', 'p-2': 'malva-device-installment-24' };
    const facts = describeRecurringOrder(
      {
        id: 'ro-1',
        recurringOrderState: 'Active',
        startsAt: '2026-10-07T00:00:00.000Z',
        nextOrderAt: '2026-11-07T00:00:00.000Z',
        schedule: { type: 'standard', value: 1, intervalUnit: 'Months' },
        cart: { obj: { lineItems: [{ variant: { sku: 'A' }, recurrenceInfo: { recurrencePolicy: { id: 'p-1' } } }, { variant: { sku: 'B' }, recurrenceInfo: { recurrencePolicy: { id: 'p-2' } } }] } },
      },
      (id) => keys[id] ?? 'none',
    );
    expect(facts).toEqual({
      id: 'ro-1',
      state: 'Active',
      startsAt: '2026-10-07T00:00:00.000Z',
      nextOrderAt: '2026-11-07T00:00:00.000Z',
      schedule: 'standard 1 Months',
      skus: ['A', 'B'],
      policyKeys: ['malva-monthly', 'malva-device-installment-24'],
    });
  });

  it('renders a markdown table without pipes inside cells', () => {
    const text = renderSpike({ results: [{ id: 'Q1', title: 'a | b', status: 'PASS', evidence: 'x\ny' }], facts: { recurringOrders: [], firstGeneratedPaymentNumber: 1 }, leftovers: [] }, '2026-10-07T00:00:00Z');
    expect(text).toContain('| Q1 | a / b | PASS | x y |');
    expect(text).toContain('measured: 1');
    expect(text).toContain('Leftovers: none');
  });
});
