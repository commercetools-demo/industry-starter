// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ listAddresses: vi.fn(), addAddress: vi.fn(), changeAddress: vi.fn(), removeAddress: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/addresses', () => ct);

import { DELETE, PATCH } from '@/app/api/account/addresses/[id]/route';
import { GET, POST } from '@/app/api/account/addresses/route';
import { noopVerifier, setAddressVerifier, type AddressVerifier } from '@/lib/account/address-verifier';
import { AppError } from '@/lib/errors';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const GOOD = { firstName: 'Maya', lastName: 'O', streetName: '1 Main St', city: 'New York', postalCode: '10012', state: 'NY', country: 'US' };
const req = (method: string, body?: unknown) => new Request('http://x/api/account/addresses', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeEach(async () => {
  jar.store.clear();
  for (const f of Object.values(ct)) f.mockReset();
  setAddressVerifier(noopVerifier);
  jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
  ct.listAddresses.mockResolvedValue([]);
  ct.addAddress.mockResolvedValue([{ id: 'a1' }]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('addresses routes', () => {
  it('401 with no detail on every verb', async () => {
    jar.store.clear();
    for (const res of [await GET(req('GET'), ctx), await POST(req('POST', {}), ctx), await PATCH(req('PATCH', {}), idCtx('a1')), await DELETE(req('DELETE'), idCtx('a1'))]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
    }
  });

  it('GET lists the customer own addresses', async () => {
    ct.listAddresses.mockResolvedValue([{ id: 'a1' }]);
    const res = await GET(req('GET'), ctx);
    expect(await res.json()).toEqual({ addresses: [{ id: 'a1' }] });
    expect(ct.listAddresses).toHaveBeenCalledWith('c1');
  });

  it('POST adds and answers 201 with the list', async () => {
    const res = await POST(req('POST', { address: GOOD, makeDefault: true }), ctx);
    expect(res.status).toBe(201);
    expect(ct.addAddress).toHaveBeenCalledWith('c1', expect.objectContaining({ postalCode: '10012', state: 'NY' }), true);
  });

  it('Invalid postcode is refused with field codes and nothing is written', async () => {
    const res = await POST(req('POST', { address: { ...GOOD, postalCode: 'abc' } }), ctx);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'validation_failed', fields: { postalCode: 'invalid' } });
    expect(ct.addAddress).not.toHaveBeenCalled();
  });

  describe('Validation cannot resolve the address', () => {
    const fake: AddressVerifier = {
      verify: async () => ({ ok: false, unresolved: ['postalCode'], suggestion: { ...GOOD, postalCode: '10013' } }),
    };

    it('answers 409 with the unresolved fields and the suggestion, and writes nothing', async () => {
      setAddressVerifier(fake);
      const res = await POST(req('POST', { address: GOOD }), ctx);
      expect(res.status).toBe(409);
      const { error } = await res.json();
      expect(error).toMatchObject({ code: 'address_needs_confirmation', unresolved: ['postalCode'], suggestion: { postalCode: '10013' } });
      expect(ct.addAddress).not.toHaveBeenCalled();
    });

    it('the shopper can keep what they typed (confirmed) and then it is written', async () => {
      setAddressVerifier(fake);
      const res = await POST(req('POST', { address: GOOD, confirmed: true }), ctx);
      expect(res.status).toBe(201);
      expect(ct.addAddress).toHaveBeenCalledTimes(1);
    });

    it('the same check applies to edits', async () => {
      setAddressVerifier(fake);
      const res = await PATCH(req('PATCH', { address: GOOD }), idCtx('a1'));
      expect(res.status).toBe(409);
      expect(ct.changeAddress).not.toHaveBeenCalled();
    });
  });

  it('PATCH changes an address and DELETE removes it with promotedId', async () => {
    ct.changeAddress.mockResolvedValue([{ id: 'a1' }]);
    expect((await PATCH(req('PATCH', { address: GOOD, makeDefault: true }), idCtx('a1'))).status).toBe(200);
    expect(ct.changeAddress).toHaveBeenCalledWith('c1', 'a1', expect.objectContaining({ city: 'New York' }), true);
    ct.removeAddress.mockResolvedValue({ addresses: [{ id: 'a2' }], promotedId: 'a2' });
    const res = await DELETE(req('DELETE'), idCtx('a1'));
    expect(await res.json()).toEqual({ addresses: [{ id: 'a2' }], promotedId: 'a2' });
  });

  it('Address of another customer is 404, identical to an unknown one', async () => {
    ct.changeAddress.mockRejectedValue(new AppError('not_found', 404));
    ct.removeAddress.mockRejectedValue(new AppError('not_found', 404));
    const a = await PATCH(req('PATCH', { address: GOOD }), idCtx('foreign'));
    const b = await DELETE(req('DELETE'), idCtx('foreign'));
    expect(a.status).toBe(404);
    expect(await a.json()).toEqual(await b.json());
    const bad = await DELETE(req('DELETE'), idCtx('a b'));
    expect(bad.status).toBe(404);
  });
});
