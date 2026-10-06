import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', async () => {
  const h = await import('./order-edits.test-helpers');
  return { getApiRoot: () => h.fakeRoot() };
});

import { getProposalsForOrder, isOrderEditable, ProposalNotFoundError } from './order-edits';
import { calls, editOf, firstLineId, ownerOrder, previewEdit, proposalCustom, results } from './order-edits.test-helpers';

const listOf = (...results: unknown[]) => ({ body: { results } });

beforeEach(() => {
  vi.resetAllMocks();
  results.order.mockResolvedValue({ body: ownerOrder() });
});

describe('isOrderEditable', () => {
  it.each([
    [{ inventoryMode: 'None', orderState: 'Open', shipmentState: 'Pending' }, true],
    [{ inventoryMode: 'None', orderState: 'Confirmed' }, true],
    [{ inventoryMode: 'ReserveOnOrder', orderState: 'Open' }, false],
    [{ inventoryMode: 'None', orderState: 'Cancelled' }, false],
    [{ inventoryMode: 'None', orderState: 'Complete' }, false],
    [{ inventoryMode: 'None', orderState: 'Open', shipmentState: 'Shipped' }, false],
    [{ inventoryMode: 'None', orderState: 'Open', shipmentState: 'Delivered' }, false],
  ])('%j -> %s', (order, expected) => {
    expect(isOrderEditable(order as never)).toBe(expected);
  });
});

describe('getProposalsForOrder', () => {
  it('Proposal exists: pending proposal with names, price difference and new total from the preview', async () => {
    results.list.mockResolvedValue(listOf(editOf()));
    results.edit.mockResolvedValue({ body: previewEdit(1347) });
    const r = await getProposalsForOrder('order-1', 'cust-1', 'en-US');
    expect(r.removalRequested).toEqual([]);
    expect(r.proposals).toHaveLength(1);
    const p = r.proposals[0];
    expect(p).toMatchObject({
      editId: 'edit-1',
      originalLineItemId: firstLineId(),
      substituteSku: 'OAT-MILK-1L',
      substituteName: 'Oat milk 1 L',
      priceDifference: { centAmount: 300, currencyCode: 'USD' },
      newTotal: { centAmount: 1347, currencyCode: 'USD' },
      note: 'Out of stock',
      editable: true,
    });
    expect(p.originalName).not.toBe('');
    expect(calls.listGet.mock.calls[0][0].queryArgs.where).toBe('resource(id="order-1")');
  });

  it('price difference can be negative and names follow the locale', async () => {
    results.list.mockResolvedValue(listOf(editOf()));
    results.edit.mockResolvedValue({ body: previewEdit(1000) });
    const [p] = (await getProposalsForOrder('order-1', 'cust-1', 'de-DE')).proposals;
    expect(p.priceDifference.centAmount).toBe(-47);
    expect(p.substituteName).toBe('Haferdrink 1 l');
  });

  it('declined proposals are not listed but their line is reported as removal requested', async () => {
    results.list.mockResolvedValue(listOf(editOf({ custom: proposalCustom({ status: 'declined' }, 'substitution-proposal') })));
    const r = await getProposalsForOrder('order-1', 'cust-1', 'en-US');
    expect(r.proposals).toEqual([]);
    expect(r.removalRequested).toEqual([firstLineId()]);
    expect(results.edit).not.toHaveBeenCalled();
  });

  it('applied proposals are excluded', async () => {
    results.list.mockResolvedValue(
      listOf(editOf({ result: { type: 'Applied' } }), editOf({ id: 'e2', custom: proposalCustom({ status: 'applied' }, 'substitution-proposal') })),
    );
    expect(await getProposalsForOrder('order-1', 'cust-1', 'en-US')).toEqual({ proposals: [], removalRequested: [] });
  });

  it('edits of another custom type or without proposal fields are excluded', async () => {
    results.list.mockResolvedValue(
      listOf(
        editOf({ id: 'other-type', custom: proposalCustom({}, 'something-else') }),
        editOf({ id: 'no-custom', custom: undefined }),
        editOf({ id: 'no-fields', custom: { type: { typeId: 'type', id: 't' }, fields: { note: 'x' } } }),
      ),
    );
    expect(await getProposalsForOrder('order-1', 'cust-1', 'en-US')).toEqual({ proposals: [], removalRequested: [] });
    expect(results.edit).not.toHaveBeenCalled();
  });

  it('preview failure: shown read-only without price', async () => {
    results.list.mockResolvedValue(listOf(editOf()));
    results.edit.mockResolvedValue({ body: editOf({ result: { type: 'PreviewFailure', errors: [] } }) });
    const [p] = (await getProposalsForOrder('order-1', 'cust-1', 'en-US')).proposals;
    expect(p.editable).toBe(false);
    expect(p.newTotal).toBeUndefined();
    expect(p.priceDifference.centAmount).toBe(0);
  });

  it('Order already shipped: proposal is read-only', async () => {
    results.order.mockResolvedValue({ body: ownerOrder({ shipmentState: 'Shipped' }) });
    results.list.mockResolvedValue(listOf(editOf()));
    results.edit.mockResolvedValue({ body: previewEdit(1347) });
    expect((await getProposalsForOrder('order-1', 'cust-1', 'en-US')).proposals[0].editable).toBe(false);
  });

  it('not the customer\'s order (or a guest order): not found, edits are never read', async () => {
    await expect(getProposalsForOrder('order-1', 'someone-else', 'en-US')).rejects.toBeInstanceOf(ProposalNotFoundError);
    results.order.mockResolvedValue({ body: ownerOrder({ customerId: undefined }) });
    await expect(getProposalsForOrder('order-1', 'cust-1', 'en-US')).rejects.toBeInstanceOf(ProposalNotFoundError);
    expect(results.list).not.toHaveBeenCalled();
  });

  it('missing order (404): not found', async () => {
    results.order.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    await expect(getProposalsForOrder('nope', 'cust-1', 'en-US')).rejects.toBeInstanceOf(ProposalNotFoundError);
  });
});
