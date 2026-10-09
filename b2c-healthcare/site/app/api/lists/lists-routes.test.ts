// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeJsonRequest, makeRequest } from '@/test/request';

const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);
vi.mock('@/lib/ct/patient', () => ({ getPatient: async () => ({ patientRef: 'pt_sam', name: 'Sam' }) }));

const lists = vi.hoisted(() => ({
  getOwnList: vi.fn(),
  listLists: vi.fn(),
  createList: vi.fn(),
  renameList: vi.fn(),
  deleteList: vi.fn(),
  removeLine: vi.fn(),
}));
vi.mock('@/lib/ct/shopping-lists', async () => {
  class ListLimitError extends Error {
    constructor(readonly reason: 'LINES' | 'NAME') {
      super(reason);
    }
  }
  return { ...lists, ListLimitError };
});
const addAll = vi.fn();
vi.mock('@/lib/ct/lists-add-all', () => ({ addListToCart: (...a: unknown[]) => addAll(...a) }));
const save = vi.fn();
const view = vi.fn();
vi.mock('@/lib/ct/list-view', () => ({ saveRxLines: (...a: unknown[]) => save(...a), getListView: (...a: unknown[]) => view(...a) }));

import { GET as listGet, POST as listPost } from './route';
import { DELETE as listDelete, GET as oneGet, PATCH as onePatch } from './[id]/route';
import { POST as addAllPost } from './[id]/add-all-to-cart/route';
import { DELETE as lineDelete } from './[id]/lines/[lineId]/route';
import { POST as savePost } from './save/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const summary = { id: 'l1', name: { 'en-US': 'Meds' }, lineItems: [], lastModifiedAt: '2026-10-08T00:00:00Z', version: 1 };

beforeEach(() => {
  session.getSession.mockReset().mockResolvedValue({ customerId: 'c1', locale: 'en-US', cartId: 'cart-0' });
  session.setCart.mockReset();
  for (const fn of Object.values(lists)) fn.mockReset();
  addAll.mockReset();
  save.mockReset();
  view.mockReset();
});

describe('saved-lists: routes', () => {
  it('401 without a session on every route, before any commercetools call', async () => {
    session.getSession.mockResolvedValue({});
    const responses = await Promise.all([
      listGet(),
      listPost(makeJsonRequest('/api/lists', { name: 'x' })),
      oneGet(makeRequest('/api/lists/l1'), ctx('l1')),
      onePatch(makeJsonRequest('/api/lists/l1', {}, { method: 'PATCH' }), ctx('l1')),
      listDelete(makeRequest('/api/lists/l1', { method: 'DELETE' }), ctx('l1')),
      addAllPost(makeRequest('/api/lists/l1/add-all-to-cart', { method: 'POST' }), ctx('l1')),
      savePost(makeJsonRequest('/api/lists/save', { rxNumber: 'RX-1', lineRefs: ['a'] })),
      lineDelete(makeRequest('/api/lists/l1/lines/x', { method: 'DELETE' }), { params: Promise.resolve({ id: 'l1', lineId: 'x' }) }),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(401));
    expect(Object.values(lists).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it('GET lists answers no-store; an account with no lists gets an empty array', async () => {
    lists.listLists.mockResolvedValue([]);
    const r = await listGet();
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ lists: [] });
  });

  it('create answers 201; an empty name is a readable 422', async () => {
    lists.createList.mockResolvedValue(summary);
    expect((await listPost(makeJsonRequest('/api/lists', { name: 'Meds' }))).status).toBe(201);
    const { ListLimitError } = await import('@/lib/ct/shopping-lists');
    lists.createList.mockRejectedValue(new ListLimitError('NAME'));
    const r = await listPost(makeJsonRequest('/api/lists', { name: ' ' }));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: 'Give the list a name.' });
  });

  it('a foreign or unknown list answers the identical 404 on read, rename, delete, add-all and line removal', async () => {
    lists.getOwnList.mockResolvedValue(null);
    lists.renameList.mockResolvedValue(null);
    lists.deleteList.mockResolvedValue(false);
    lists.removeLine.mockResolvedValue(null);
    const bodies = [];
    for (const r of [
      await oneGet(makeRequest('/api/lists/x'), ctx('x')),
      await onePatch(makeJsonRequest('/api/lists/x', { name: 'n' }, { method: 'PATCH' }), ctx('x')),
      await listDelete(makeRequest('/api/lists/x', { method: 'DELETE' }), ctx('x')),
      await addAllPost(makeRequest('/api/lists/x/add-all-to-cart', { method: 'POST' }), ctx('x')),
      await lineDelete(makeRequest('/api/lists/x/lines/y', { method: 'DELETE' }), { params: Promise.resolve({ id: 'x', lineId: 'y' }) }),
    ]) {
      expect(r.status).toBe(404);
      bodies.push(await r.json());
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
    expect(bodies[0]).toEqual({ error: 'List not found.' });
    expect(addAll).not.toHaveBeenCalled();
  });

  it('add all to cart answers { added, notAdded } and points the session at the cart', async () => {
    lists.getOwnList.mockResolvedValue({ lineItems: [] });
    addAll.mockResolvedValue({ result: { added: ['A'], notAdded: [{ name: 'B', reason: 'NO_REFILLS' }] }, cartId: 'cart-1' });
    const r = await addAllPost(makeRequest('/api/lists/l1/add-all-to-cart', { method: 'POST' }), ctx('l1'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ added: ['A'], notAdded: [{ name: 'B', reason: 'NO_REFILLS' }] });
    expect(session.setCart).toHaveBeenCalledWith('cart-1');
  });

  it('add all on an empty list answers empty arrays (200) and no cart change', async () => {
    lists.getOwnList.mockResolvedValue({ lineItems: [] });
    addAll.mockResolvedValue({ result: { added: [], notAdded: [] }, cartId: undefined });
    const r = await addAllPost(makeRequest('/api/lists/l1/add-all-to-cart', { method: 'POST' }), ctx('l1'));
    expect(await r.json()).toEqual({ added: [], notAdded: [] });
    expect(session.setCart).not.toHaveBeenCalled();
  });

  it('save: the RX number travels in the body; bad input is 400; a foreign prescription is 404', async () => {
    save.mockResolvedValue({ listId: 'l1', saved: 1, alreadySaved: 0 });
    const ok = await savePost(makeJsonRequest('/api/lists/save', { rxNumber: 'RX-77102', lineRefs: ['RX-77102-1'] }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ listId: 'l1', saved: 1, alreadySaved: 0 });
    expect(save).toHaveBeenCalledWith('c1', { patientRef: 'pt_sam', name: 'Sam' }, 'RX-77102', ['RX-77102-1'], expect.objectContaining({ defaultName: 'My medicines' }));
    expect((await savePost(makeJsonRequest('/api/lists/save', { rxNumber: 'RX-1', lineRefs: [] }))).status).toBe(400);
    save.mockResolvedValue(null);
    expect((await savePost(makeJsonRequest('/api/lists/save', { rxNumber: 'RX-1', lineRefs: ['a'] }))).status).toBe(404);
  });
});
