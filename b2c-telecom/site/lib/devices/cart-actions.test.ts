import {
  assertDeviceCartIntegrity,
  assertPriceFromPolicy,
  buildAddDeviceActions,
  buildChangeModeActions,
  checkPriceFromPolicy,
  deviceCartViolations,
  PriceNotForTermError,
} from './cart-actions';

const POLICIES = { 'malva-device-installment-24': 'pol-24', 'malva-device-lease-24': 'pol-lease', 'malva-device-installment-36': 'pol-36' };

describe('buildAddDeviceActions', () => {
  it('Mode persisted to the order: add action writes mode, term, end of term and offer key as line custom fields', () => {
    expect(buildAddDeviceActions({ sku: 'MLV-DEV-NOVAPRO-BLK-256', offerKey: 'malva-offer-phone-nova-pro', quantity: 1, mode: 'installments', termMonths: 24 })).toEqual([
      {
        action: 'addLineItem',
        sku: 'MLV-DEV-NOVAPRO-BLK-256',
        quantity: 1,
        recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-device-installment-24' }, priceSelectionMode: 'Fixed' },
        custom: {
          type: { typeId: 'type', key: 'malva-line-item' },
          fields: { offerKey: 'malva-offer-phone-nova-pro', acquisitionMode: 'installments', acquisitionTermMonths: 24, acquisitionEndOfTerm: 'owned-after-final-payment' },
        },
      },
    ]);
  });

  it('a lease carries the lease policy and the return end of term', () => {
    const [add] = buildAddDeviceActions({ sku: 'S', offerKey: 'k', quantity: 2, mode: 'lease', termMonths: 24 });
    expect(add.recurrenceInfo?.recurrencePolicy.key).toBe('malva-device-lease-24');
    expect(add.custom.fields).toMatchObject({ acquisitionMode: 'lease', acquisitionTermMonths: 24, acquisitionEndOfTerm: 'return' });
    expect(add.quantity).toBe(2);
  });

  it('outright has no recurrenceInfo, term 0 and ownership from day one', () => {
    const [add] = buildAddDeviceActions({ sku: 'S', offerKey: 'k', quantity: 1, mode: 'outright', termMonths: 24 });
    expect(add).not.toHaveProperty('recurrenceInfo');
    expect(add.custom.fields).toEqual({ offerKey: 'k', acquisitionMode: 'outright', acquisitionTermMonths: 0, acquisitionEndOfTerm: 'owned' });
  });
});

describe('buildChangeModeActions', () => {
  it('removes the old line and adds the same sku and quantity in the new mode, keeping addedAt', () => {
    const [remove, add] = buildChangeModeActions({ lineItemId: 'l-1', sku: 'S', offerKey: 'k', quantity: 2, addedAt: '2026-10-07T10:00:00.000Z' }, { mode: 'lease', termMonths: 24 });
    expect(remove).toEqual({ action: 'removeLineItem', lineItemId: 'l-1' });
    expect(add).toMatchObject({ action: 'addLineItem', sku: 'S', quantity: 2, addedAt: '2026-10-07T10:00:00.000Z', recurrenceInfo: { recurrencePolicy: { key: 'malva-device-lease-24' } } });
    expect(add.custom.fields).toMatchObject({ acquisitionMode: 'lease', acquisitionTermMonths: 24 });
  });
  it('omits addedAt when the old line has none', () => {
    const [, add] = buildChangeModeActions({ lineItemId: 'l-1', sku: 'S', offerKey: 'k', quantity: 1 }, { mode: 'outright', termMonths: 0 });
    expect(add).not.toHaveProperty('addedAt');
    expect(add).not.toHaveProperty('recurrenceInfo');
  });
});

describe('the price fallback guard', () => {
  const financed = { id: 'l', price: { recurrencePolicy: { id: 'pol-24' } }, recurrenceInfo: { recurrencePolicy: { id: 'pol-24' } } };

  it('price fallback: a financed line that resolved to the outright price is rejected', () => {
    // the line still asks for the policy, but the price has none: the platform silently charged the one-time price
    const fellBack = { id: 'l', price: {}, recurrenceInfo: { recurrencePolicy: { id: 'pol-24' } } };
    expect(checkPriceFromPolicy(fellBack, 'pol-24')).toBe('price-has-no-policy');
    expect(() => assertPriceFromPolicy(fellBack, 'pol-24')).toThrow(PriceNotForTermError);
    try {
      assertPriceFromPolicy(fellBack, 'pol-24');
    } catch (error) {
      expect((error as PriceNotForTermError).code).toBe('PRICE_NOT_FOR_TERM');
      expect((error as PriceNotForTermError).lineItemId).toBe('l');
    }
  });

  it('a price of another policy is rejected too (36 months asked, the 24-month price came back)', () => {
    expect(checkPriceFromPolicy({ ...financed, price: { recurrencePolicy: { id: 'pol-24' } } }, 'pol-36')).toBe('price-of-another-policy');
  });

  it('accepts a financed line priced from its policy, whatever the amount', () => {
    expect(checkPriceFromPolicy(financed, 'pol-24')).toBe('ok');
    expect(() => assertPriceFromPolicy(financed, 'pol-24')).not.toThrow();
  });

  it('a financed line must also carry its recurrenceInfo', () => {
    expect(checkPriceFromPolicy({ id: 'l', price: { recurrencePolicy: { id: 'pol-24' } } }, 'pol-24')).toBe('line-has-no-recurrence');
    expect(checkPriceFromPolicy({ ...financed, recurrenceInfo: { recurrencePolicy: { id: 'other' } } }, 'pol-24')).toBe('line-of-another-policy');
  });

  it('an outright line must have neither a price policy nor recurrenceInfo', () => {
    expect(checkPriceFromPolicy({ id: 'l', price: {} }, null)).toBe('ok');
    expect(checkPriceFromPolicy(financed, null)).toBe('outright-has-recurrence');
    expect(checkPriceFromPolicy({ id: 'l', price: { recurrencePolicy: { id: 'pol-24' } } }, null)).toBe('outright-has-recurrence');
  });
});

describe('assertDeviceCartIntegrity', () => {
  const fields = (mode: string, term: number) => ({ custom: { fields: { acquisitionMode: mode, acquisitionTermMonths: term } } });
  const priced = (id: string, policy?: string) => ({ id, price: policy ? { recurrencePolicy: { id: policy } } : {}, ...(policy ? { recurrenceInfo: { recurrencePolicy: { id: policy } } } : {}) });

  it('passes a cart whose device lines all price from their recorded mode and term, and ignores lines that are not devices', () => {
    const lines = [{ ...priced('a'), ...fields('outright', 0) }, { ...priced('b', 'pol-24'), ...fields('installments', 24) }, { ...priced('c', 'pol-lease'), ...fields('lease', 24) }, priced('plan', 'monthly')];
    expect(deviceCartViolations(lines, POLICIES)).toEqual([]);
    expect(() => assertDeviceCartIntegrity(lines, POLICIES)).not.toThrow();
  });

  it('reports the line whose price fell back, with the check that failed', () => {
    const lines = [{ id: 'bad', price: {}, recurrenceInfo: { recurrencePolicy: { id: 'pol-36' } }, ...fields('installments', 36) }, { ...priced('ok', 'pol-24'), ...fields('installments', 24) }];
    expect(deviceCartViolations(lines, POLICIES)).toEqual([{ lineItemId: 'bad', check: 'price-has-no-policy' }]);
    expect(() => assertDeviceCartIntegrity(lines, POLICIES)).toThrow(PriceNotForTermError);
  });

  it('reports a financed line whose policy does not exist in the project', () => {
    expect(deviceCartViolations([{ ...priced('x', 'pol-24'), ...fields('installments', 18) }], POLICIES)).toEqual([{ lineItemId: 'x', check: 'policy-unknown' }]);
  });
});
