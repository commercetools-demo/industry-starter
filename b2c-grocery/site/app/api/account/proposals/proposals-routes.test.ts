// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/ct/order-edits', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/order-edits')>()),
  getProposalsForOrder: vi.fn(),
  acceptProposal: vi.fn(),
  declineProposal: vi.fn(),
}));

import { GET as LIST } from '../orders/[orderId]/proposals/route';
import { POST as ACCEPT } from './[editId]/accept/route';
import { POST as DECLINE } from './[editId]/decline/route';
import { acceptProposal, declineProposal, getProposalsForOrder, ProposalConflictError, ProposalNotEditableError, ProposalNotFoundError } from '@/lib/ct/order-edits';
import { getMarket, getSession } from '@/lib/session';

const list = (id = 'order-1') => LIST(new Request('http://localhost/x'), { params: Promise.resolve({ orderId: id }) });
const accept = (id = 'edit-1') => ACCEPT(new Request('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ editId: id }) });
const decline = (id = 'edit-1') => DECLINE(new Request('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ editId: id }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMarket).mockResolvedValue({ country: 'US', currency: 'USD', locale: 'en-US' });
  vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
});

describe('anonymous visitor', () => {
  it.each([
    ['list', list],
    ['accept', accept],
    ['decline', decline],
  ])('%s: 401, private, nothing read or changed', async (_name, call) => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await call();
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getProposalsForOrder).not.toHaveBeenCalled();
    expect(acceptProposal).not.toHaveBeenCalled();
    expect(declineProposal).not.toHaveBeenCalled();
  });
});

describe('GET /api/account/orders/[orderId]/proposals', () => {
  it('returns the proposals for the session customer and locale, private', async () => {
    vi.mocked(getProposalsForOrder).mockResolvedValue({ proposals: [], removalRequested: ['l1'] });
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ proposals: [], removalRequested: ['l1'] });
    expect(getProposalsForOrder).toHaveBeenCalledWith('order-1', 'cust-1', 'en-US');
  });

  it('not their order: 404', async () => {
    vi.mocked(getProposalsForOrder).mockRejectedValue(new ProposalNotFoundError());
    expect((await list()).status).toBe(404);
  });

  it('unexpected failure: 500 without details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getProposalsForOrder).mockRejectedValue(new Error('secret detail'));
    const res = await list();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});

describe('POST accept', () => {
  it('Accept: applies for the session customer', async () => {
    vi.mocked(acceptProposal).mockResolvedValue();
    const res = await accept();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(acceptProposal).toHaveBeenCalledWith('edit-1', 'cust-1');
  });

  it('not the owner: 404', async () => {
    vi.mocked(acceptProposal).mockRejectedValue(new ProposalNotFoundError());
    expect((await accept()).status).toBe(404);
  });

  it('Stale version: 409 STALE', async () => {
    vi.mocked(acceptProposal).mockRejectedValue(new ProposalConflictError());
    const res = await accept();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'STALE' });
  });

  it('Order already shipped: 422 NOT_EDITABLE', async () => {
    vi.mocked(acceptProposal).mockRejectedValue(new ProposalNotEditableError());
    const res = await accept();
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'NOT_EDITABLE' });
  });
});

describe('POST decline', () => {
  it('Decline: records the removal request for the session customer', async () => {
    vi.mocked(declineProposal).mockResolvedValue();
    const res = await decline();
    expect(res.status).toBe(200);
    expect(declineProposal).toHaveBeenCalledWith('edit-1', 'cust-1');
    expect(acceptProposal).not.toHaveBeenCalled();
  });

  it.each([
    [new ProposalNotFoundError(), 404],
    [new ProposalNotEditableError(), 422],
    [new ProposalConflictError(), 409],
  ])('%s maps to %i', async (error, status) => {
    vi.mocked(declineProposal).mockRejectedValue(error);
    expect((await decline()).status).toBe(status);
  });
});
