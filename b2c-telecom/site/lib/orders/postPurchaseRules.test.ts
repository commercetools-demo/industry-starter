import { buildCancelActions, buildReturnActions, cancelEligibility, returnEligibility, returnableLines, validateCancelInput, validateReturnInput } from './postPurchaseRules';
import type { Order, OrderReturn } from '@/lib/types';

type TestLine = Pick<Order['lines'][number], 'id' | 'name' | 'quantity' | 'acquisition'>;
const acquisition: NonNullable<TestLine['acquisition']> = { mode: 'installments', termMonths: 24, endDate: null };
const device = (id: string, quantity = 1): TestLine => ({ id, name: `Nova ${id}`, quantity, acquisition });
const router: TestLine = { id: 'li-router', name: 'Router', quantity: 1, acquisition: null };

const cancelView = (patch: Partial<Pick<Order, 'orderState' | 'serviceStartDate' | 'shipmentState' | 'returns'>> = {}) => ({
  orderState: 'Open',
  serviceStartDate: '2026-10-12',
  shipmentState: null,
  returns: [] as OrderReturn[],
  ...patch,
});
const returned = (lineItemId: string, quantity: number): OrderReturn => ({
  items: [{ id: `r-${lineItemId}`, lineItemId, name: 'x', quantity, shipmentState: 'Advised', paymentState: 'NonRefundable' }],
});

describe('cancelEligibility', () => {
  const now = new Date('2026-10-07T12:00:00Z');

  it('is allowed before the service start day and names the last day', () => {
    expect(cancelEligibility(cancelView(), now)).toEqual({ allowed: true, until: '2026-10-11' });
  });

  it('cancel is blocked from the service-start day', () => {
    expect(cancelEligibility(cancelView({ serviceStartDate: '2026-10-07' }), now)).toEqual({ allowed: false, block: 'SERVICE_STARTED' });
    expect(cancelEligibility(cancelView({ serviceStartDate: '2026-10-08' }), new Date('2026-10-07T23:59:59.999Z')).allowed).toBe(true);
    expect(cancelEligibility(cancelView({ serviceStartDate: '2026-10-08' }), new Date('2026-10-08T00:00:00.000Z'))).toEqual({ allowed: false, block: 'SERVICE_STARTED' });
  });

  it('phone-only order is not cancellable online (its start date is the order date)', () => {
    expect(cancelEligibility(cancelView({ serviceStartDate: '2026-10-07' }), new Date('2026-10-07T08:00:00Z'))).toEqual({ allowed: false, block: 'SERVICE_STARTED' });
  });

  it.each([
    [{ orderState: 'Cancelled' }, 'ALREADY_CANCELLED'],
    [{ orderState: 'Complete' }, 'ORDER_COMPLETE'],
    [{ serviceStartDate: '' }, 'NO_START_DATE'],
    [{ serviceStartDate: 'soon' }, 'NO_START_DATE'],
    [{ shipmentState: 'Shipped' }, 'EQUIPMENT_SHIPPED'],
    [{ shipmentState: 'Delivered' }, 'EQUIPMENT_SHIPPED'],
    [{ shipmentState: 'Partial' }, 'EQUIPMENT_SHIPPED'],
    [{ returns: [returned('a', 1)] }, 'HAS_RETURN'],
  ] as const)('blocks %j with %s', (patch, block) => {
    expect(cancelEligibility(cancelView({ ...patch } as Parameters<typeof cancelView>[0]), now)).toEqual({ allowed: false, block });
  });

  it('still allows an order that is Pending, Ready or Delayed in shipment', () => {
    for (const shipmentState of ['Pending', 'Ready', 'Delayed', 'Backorder']) expect(cancelEligibility(cancelView({ shipmentState }), now).allowed).toBe(true);
  });
});

describe('returnEligibility', () => {
  const created = '2026-10-01T10:00:00.000Z';
  const view = (patch: Partial<{ orderState: string; returns: OrderReturn[]; lines: TestLine[] }> = {}) => ({
    orderState: 'Open',
    createdAt: created,
    returns: [] as OrderReturn[],
    lines: [device('li-1'), router],
    ...patch,
  });

  it('return window is 30 days', () => {
    const edge = Date.parse(created) + 30 * 86_400_000;
    const atEdge = returnEligibility(view(), new Date(edge));
    expect(atEdge.allowed && atEdge.until).toBe('2026-10-31');
    expect(returnEligibility(view(), new Date(edge + 1))).toEqual({ allowed: false, block: 'WINDOW_CLOSED' });
  });

  it('lists only device lines and subtracts earlier requests', () => {
    const result = returnEligibility(view({ lines: [device('li-1', 2), router], returns: [returned('li-1', 1)] }), new Date('2026-10-02T00:00:00Z'));
    expect(result).toMatchObject({ allowed: true, lines: [{ lineItemId: 'li-1', quantityOrdered: 2, quantityAlreadyRequested: 1, quantityAvailable: 1 }] });
  });

  it('blocks a cancelled order, an order without devices and one with everything requested', () => {
    const early = new Date('2026-10-02T00:00:00Z');
    expect(returnEligibility(view({ orderState: 'Cancelled' }), early)).toEqual({ allowed: false, block: 'ORDER_CANCELLED' });
    expect(returnEligibility(view({ lines: [router] }), early)).toEqual({ allowed: false, block: 'NO_RETURNABLE_LINES' });
    expect(returnEligibility(view({ returns: [returned('li-1', 1)] }), early)).toEqual({ allowed: false, block: 'NO_RETURNABLE_LINES' });
  });

  it('keeps zero-available lines in returnableLines', () => {
    expect(returnableLines({ lines: [device('li-1')], returns: [returned('li-1', 1)] })[0]?.quantityAvailable).toBe(0);
  });
});

describe('update actions', () => {
  const now = new Date('2026-10-07T08:09:10.000Z');

  it('stores the reason with setCustomField when the order has the malva-order type', () => {
    const actions = buildCancelActions({ customTypeKey: 'malva-order' }, { reason: 'other', note: 'moving abroad' }, now);
    expect(actions[0]).toEqual({ action: 'changeOrderState', orderState: 'Cancelled' });
    expect(actions[1]).toMatchObject({ action: 'setCustomField', name: 'cancellation' });
    const value = (actions[1] as { value: string }).value;
    expect(JSON.parse(value)).toEqual({ reason: 'other', note: 'moving abroad', cancelledAt: '2026-10-07T08:09:10.000Z', by: 'customer' });
  });

  it('sets the type first when the order has none', () => {
    const actions = buildCancelActions({ customTypeKey: null }, { reason: 'moving' }, now);
    expect(actions[1]).toEqual({ action: 'setCustomType', type: { typeId: 'type', key: 'malva-order' }, fields: { cancellation: expect.any(String) } });
    expect(JSON.parse((actions[1] as unknown as { fields: { cancellation: string } }).fields.cancellation)).not.toHaveProperty('note');
  });

  it('adds the return in Advised state and appends to the earlier requests', () => {
    const earlier = JSON.stringify([{ requestedAt: '2026-10-05T00:00:00.000Z', reason: 'defective', lineItemIds: ['li-0'] }]);
    const actions = buildReturnActions({ customTypeKey: 'malva-order', returnRequestJson: earlier }, { items: [{ lineItemId: 'li-1', quantity: 1 }, { lineItemId: 'li-2', quantity: 2 }], reason: 'defective', note: 'cracked' }, now);
    expect(actions[0]).toEqual({
      action: 'addReturnInfo',
      returnDate: '2026-10-07T08:09:10.000Z',
      items: [
        { key: 'ret-20261007080910-1', lineItemId: 'li-1', quantity: 1, comment: 'defective: cracked', shipmentState: 'Advised' },
        { key: 'ret-20261007080910-2', lineItemId: 'li-2', quantity: 2, comment: 'defective: cracked', shipmentState: 'Advised' },
      ],
    });
    expect(actions[1]).toMatchObject({ action: 'setCustomField', name: 'returnRequest' });
    expect(JSON.parse((actions[1] as { value: string }).value)).toHaveLength(2);
  });

  it('starts the request list when the field is missing or unreadable, and sets the type if needed', () => {
    const actions = buildReturnActions({ returnRequestJson: 'not json' }, { items: [{ lineItemId: 'li-1', quantity: 1 }], reason: 'not_needed' }, now);
    expect(actions[1]).toMatchObject({ action: 'setCustomType', fields: { returnRequest: expect.stringContaining('"not_needed"') } });
    expect((actions[0] as { items: { comment: string }[] }).items[0]?.comment).toBe('not_needed');
  });
});

describe('validateCancelInput', () => {
  it('accepts every reason and trims the note', () => {
    expect(validateCancelInput({ reason: 'moving', note: '  new city ' })).toEqual({ ok: true, value: { reason: 'moving', note: 'new city' } });
    expect(validateCancelInput({ reason: 'changed_mind' })).toEqual({ ok: true, value: { reason: 'changed_mind' } });
  });
  it('rejects a bad reason or body', () => {
    expect(validateCancelInput({ reason: 'bored' })).toEqual({ ok: false, code: 'INVALID_REASON' });
    expect(validateCancelInput(null)).toEqual({ ok: false, code: 'INVALID_REASON' });
  });
  it('requires a note for other and limits it to 280 characters', () => {
    expect(validateCancelInput({ reason: 'other', note: '   ' })).toEqual({ ok: false, code: 'NOTE_REQUIRED' });
    expect(validateCancelInput({ reason: 'other', note: 'a'.repeat(280) }).ok).toBe(true);
    expect(validateCancelInput({ reason: 'other', note: 'a'.repeat(281) })).toEqual({ ok: false, code: 'NOTE_TOO_LONG' });
    expect(validateCancelInput({ reason: 'moving', note: 'a'.repeat(281) })).toEqual({ ok: false, code: 'NOTE_TOO_LONG' });
  });
});

describe('validateReturnInput', () => {
  const lines = [
    { lineItemId: 'li-1', name: 'A', quantityOrdered: 2, quantityAlreadyRequested: 0, quantityAvailable: 2 },
    { lineItemId: 'li-2', name: 'B', quantityOrdered: 1, quantityAlreadyRequested: 1, quantityAvailable: 0 },
  ];
  it('accepts a valid request', () => {
    expect(validateReturnInput({ items: [{ lineItemId: 'li-1', quantity: 2 }], reason: 'wrong_item' }, lines)).toEqual({
      ok: true,
      value: { items: [{ lineItemId: 'li-1', quantity: 2 }], reason: 'wrong_item' },
    });
  });
  it.each([
    [{ items: [], reason: 'defective' }, 'INVALID_ITEMS'],
    [{ items: [{ lineItemId: 'nope', quantity: 1 }], reason: 'defective' }, 'INVALID_ITEMS'],
    [{ items: [{ lineItemId: 'li-1', quantity: 0 }], reason: 'defective' }, 'INVALID_ITEMS'],
    [{ items: [{ lineItemId: 'li-1', quantity: 1.5 }], reason: 'defective' }, 'INVALID_ITEMS'],
    [{ items: [{ lineItemId: 'li-1', quantity: 1 }, { lineItemId: 'li-1', quantity: 1 }], reason: 'defective' }, 'INVALID_ITEMS'],
    [{ items: [{ lineItemId: 'li-1', quantity: 3 }], reason: 'defective' }, 'QUANTITY_TOO_HIGH'],
    [{ items: [{ lineItemId: 'li-2', quantity: 1 }], reason: 'defective' }, 'QUANTITY_TOO_HIGH'],
    [{ items: [{ lineItemId: 'li-1', quantity: 1 }], reason: 'meh' }, 'INVALID_REASON'],
    [{ items: [{ lineItemId: 'li-1', quantity: 1 }], reason: 'other' }, 'NOTE_REQUIRED'],
    [{ items: [{ lineItemId: 'li-1', quantity: 1 }], reason: 'defective', note: 'x'.repeat(281) }, 'NOTE_TOO_LONG'],
    ['nope', 'INVALID_ITEMS'],
  ] as const)('rejects %j with %s', (body, code) => {
    expect(validateReturnInput(body, lines)).toEqual({ ok: false, code });
  });
});
