// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { makeJsonRequest, makeRequest } from '@/test/request';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const ct = { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn(), setDefault: vi.fn() };
const { AddressNotFoundError, CustomerNotFoundError } = vi.hoisted(() => ({
  AddressNotFoundError: class extends Error {},
  CustomerNotFoundError: class extends Error {},
}));
vi.mock('@/lib/ct/customer-update', () => ({ CustomerNotFoundError }));
vi.mock('@/lib/ct/addresses', () => ({
  AddressNotFoundError,
  listAddresses: (...a: unknown[]) => ct.list(...a),
  addAddress: (...a: unknown[]) => ct.add(...a),
  updateAddress: (...a: unknown[]) => ct.update(...a),
  removeAddress: (...a: unknown[]) => ct.remove(...a),
  setDefault: (...a: unknown[]) => ct.setDefault(...a),
}));

import { DELETE, PATCH } from './[id]/route';
import { POST as MAKE_DEFAULT } from './[id]/default/route';
import { GET, POST } from './route';

const body = { firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'Austin', state: 'TX', zip: '78701', phone: '(512) 555-0100' };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const list = [{ id: 'a1', isDefault: true }];

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  for (const fn of Object.values(ct)) fn.mockReset().mockResolvedValue(list);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('address-book: routes', () => {
  it('signed out: every route answers 401 before any commercetools call', async () => {
    getSession.mockResolvedValue({});
    const mocks = Object.values(ct);
    await expectUnauthenticated(GET, mocks);
    await expectUnauthenticated(POST, mocks, makeJsonRequest('/api/account/addresses', body));
    await expectUnauthenticated((r) => PATCH(r, ctx('a1')), mocks, makeJsonRequest('/x', body, { method: 'PATCH' }));
    await expectUnauthenticated((r) => DELETE(r, ctx('a1')), mocks, makeRequest('/x', { method: 'DELETE' }));
    await expectUnauthenticated((r) => MAKE_DEFAULT(r, ctx('a1')), mocks, makeRequest('/x', { method: 'POST' }));
  });

  it('GET lists the signed-in customer\'s addresses (id from the session only)', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ addresses: list });
    expect(ct.list).toHaveBeenCalledWith('c1');
  });

  it('POST stores a valid address with the normalised phone; makeDefault passes through', async () => {
    const response = await POST(makeJsonRequest('/api/account/addresses', { ...body, makeDefault: true, customerId: 'other' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'saved', addresses: list });
    expect(ct.add).toHaveBeenCalledWith('c1', expect.objectContaining({ phone: '+15125550100', zip: '78701' }), true);
  });

  it('POST with an invalid ZIP answers 400 naming the field and stores nothing', async () => {
    const response = await POST(makeJsonRequest('/api/account/addresses', { ...body, zip: '1234' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ fields: { zip: 'invalid' } });
    expect(ct.add).not.toHaveBeenCalled();
  });

  it('Validation cannot resolve the address: the fields and nearest match are named and nothing is stored until confirmed', async () => {
    const response = await POST(makeJsonRequest('/api/account/addresses', { ...body, state: 'NY', zip: '90210' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'needs-confirmation', warning: { fields: ['state', 'zip'], nearestState: 'CA' } });
    expect(ct.add).not.toHaveBeenCalled();
    const confirmed = await POST(makeJsonRequest('/api/account/addresses', { ...body, state: 'NY', zip: '90210', confirmed: true }));
    expect((await confirmed.json()).status).toBe('saved');
    expect(ct.add).toHaveBeenCalledTimes(1);
  });

  it('PATCH changes one address; an unknown or foreign id answers 404', async () => {
    expect((await PATCH(makeJsonRequest('/x', body, { method: 'PATCH' }), ctx('a1'))).status).toBe(200);
    expect(ct.update).toHaveBeenCalledWith('c1', 'a1', expect.objectContaining({ city: 'Austin' }), false);
    ct.update.mockRejectedValue(new AddressNotFoundError('x'));
    const response = await PATCH(makeJsonRequest('/x', body, { method: 'PATCH' }), ctx('theirs'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found.' });
  });

  it('DELETE and make-default answer 404 for another customer\'s address id', async () => {
    ct.remove.mockRejectedValue(new AddressNotFoundError('x'));
    ct.setDefault.mockRejectedValue(new AddressNotFoundError('x'));
    expect((await DELETE(makeRequest('/x', { method: 'DELETE' }), ctx('theirs'))).status).toBe(404);
    expect((await MAKE_DEFAULT(makeRequest('/x', { method: 'POST' }), ctx('theirs'))).status).toBe(404);
  });

  it('DELETE and make-default return the new list', async () => {
    expect(await (await DELETE(makeRequest('/x', { method: 'DELETE' }), ctx('a1'))).json()).toEqual({ status: 'saved', addresses: list });
    expect(ct.remove).toHaveBeenCalledWith('c1', 'a1');
    expect(await (await MAKE_DEFAULT(makeRequest('/x', { method: 'POST' }), ctx('a1'))).json()).toEqual({ status: 'saved', addresses: list });
    expect(ct.setDefault).toHaveBeenCalledWith('c1', 'a1');
  });

  it('a platform failure is sanitised (no street, phone or raw message)', async () => {
    ct.add.mockRejectedValue(Object.assign(new Error('boom 12 Elm St +15125550100'), { statusCode: 500 }));
    await expectSanitizedError(POST, ['12 Elm St', '+15125550100', 'boom'], makeJsonRequest('/api/account/addresses', body));
  });
});
