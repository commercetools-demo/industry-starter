import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', async () => {
  const h = await import('./order-edits.test-helpers');
  return { getApiRoot: () => h.fakeRoot() };
});

import { acceptProposal, declineProposal, ProposalConflictError, ProposalNotEditableError, ProposalNotFoundError } from './order-edits';
import { calls, editOf, ownerOrder, previewEdit, proposalCustom, results } from './order-edits.test-helpers';

beforeEach(() => {
  vi.resetAllMocks();
  results.order.mockResolvedValue({ body: ownerOrder() });
});

describe('acceptProposal', () => {
  beforeEach(() => {
    results.edit.mockResolvedValue({ body: previewEdit(1347) });
    results.apply.mockResolvedValue({ body: { ...previewEdit(1347), version: 4, result: { type: 'Applied' } } });
    results.editPost.mockResolvedValue({ body: {} });
  });

  it('Accept: applies with the edit version and the order version, then marks it applied', async () => {
    await acceptProposal('edit-1', 'cust-1');
    expect(calls.apply).toHaveBeenCalledWith({ ID: 'edit-1' }, { body: { editVersion: 3, resourceVersion: 4 } });
    expect(calls.editPost).toHaveBeenCalledWith({ ID: 'edit-1' }, { body: { version: 4, actions: [{ action: 'setCustomField', name: 'status', value: 'applied' }] } });
  });

  it('status update failing after a successful apply does not fail the accept', async () => {
    results.editPost.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(acceptProposal('edit-1', 'cust-1')).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('not the owner: rejected before anything is applied', async () => {
    await expect(acceptProposal('edit-1', 'intruder')).rejects.toBeInstanceOf(ProposalNotFoundError);
    expect(calls.apply).not.toHaveBeenCalled();
  });

  it('an edit that is not a pending proposal (declined, applied, other type): not found', async () => {
    results.edit.mockResolvedValue({ body: editOf({ custom: proposalCustom({ status: 'declined' }, 'substitution-proposal') }) });
    await expect(acceptProposal('edit-1', 'cust-1')).rejects.toBeInstanceOf(ProposalNotFoundError);
    results.edit.mockResolvedValue({ body: editOf({ custom: proposalCustom({}, 'other') }) });
    await expect(acceptProposal('edit-1', 'cust-1')).rejects.toBeInstanceOf(ProposalNotFoundError);
    expect(calls.apply).not.toHaveBeenCalled();
  });

  it.each([{ shipmentState: 'Shipped' }, { orderState: 'Cancelled' }, { orderState: 'Complete' }, { inventoryMode: 'ReserveOnOrder' }])(
    'Order not editable %j: NotEditable, nothing applied',
    async (state) => {
      results.order.mockResolvedValue({ body: ownerOrder(state) });
      await expect(acceptProposal('edit-1', 'cust-1')).rejects.toBeInstanceOf(ProposalNotEditableError);
      expect(calls.apply).not.toHaveBeenCalled();
    },
  );

  it('preview failure: NotEditable', async () => {
    results.edit.mockResolvedValue({ body: editOf({ result: { type: 'PreviewFailure', errors: [] } }) });
    await expect(acceptProposal('edit-1', 'cust-1')).rejects.toBeInstanceOf(ProposalNotEditableError);
  });

  it('Stale version: a 409 from apply becomes ProposalConflictError; other errors propagate', async () => {
    results.apply.mockRejectedValueOnce(Object.assign(new Error('ConcurrentModification'), { statusCode: 409 }));
    await expect(acceptProposal('edit-1', 'cust-1')).rejects.toBeInstanceOf(ProposalConflictError);
    results.apply.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    await expect(acceptProposal('edit-1', 'cust-1')).rejects.toThrow('boom');
  });

  it('unknown edit: not found', async () => {
    results.edit.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    await expect(acceptProposal('nope', 'cust-1')).rejects.toBeInstanceOf(ProposalNotFoundError);
  });
});

describe('declineProposal', () => {
  beforeEach(() => {
    results.edit.mockResolvedValue({ body: previewEdit(1347) });
    results.editPost.mockResolvedValue({ body: {} });
  });

  it('Decline: sets status declined and does NOT apply the edit', async () => {
    await declineProposal('edit-1', 'cust-1');
    expect(calls.editPost).toHaveBeenCalledWith({ ID: 'edit-1' }, { body: { version: 3, actions: [{ action: 'setCustomField', name: 'status', value: 'declined' }] } });
    expect(calls.apply).not.toHaveBeenCalled();
  });

  it('not the owner: rejected, nothing written', async () => {
    await expect(declineProposal('edit-1', 'intruder')).rejects.toBeInstanceOf(ProposalNotFoundError);
    expect(calls.editPost).not.toHaveBeenCalled();
  });

  it('Order already shipped: NotEditable', async () => {
    results.order.mockResolvedValue({ body: ownerOrder({ shipmentState: 'Delivered' }) });
    await expect(declineProposal('edit-1', 'cust-1')).rejects.toBeInstanceOf(ProposalNotEditableError);
    expect(calls.editPost).not.toHaveBeenCalled();
  });

  it('409 while writing the status: ProposalConflictError', async () => {
    results.editPost.mockRejectedValue(Object.assign(new Error('c'), { statusCode: 409 }));
    await expect(declineProposal('edit-1', 'cust-1')).rejects.toBeInstanceOf(ProposalConflictError);
  });
});
