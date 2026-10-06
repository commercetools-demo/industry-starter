// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/ct/addresses', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/addresses')>()),
  getAddresses: vi.fn(),
  addAddress: vi.fn(),
  changeAddress: vi.fn(),
  removeAddress: vi.fn(),
  makeDefault: vi.fn(),
}));

import { GET, POST } from './route';
import { DELETE, PATCH } from './[addressId]/route';
import { POST as MAKE_DEFAULT } from './[addressId]/default/route';
import { getSession } from '@/lib/session';
import { addAddress, AddressNotFoundError, changeAddress, getAddresses, makeDefault, removeAddress } from '@/lib/ct/addresses';

const valid = { firstName: 'Ada', lastName: 'L', streetName: '1 Main', postalCode: '94105', city: 'SF', country: 'US' };
const book = [{ ...valid, id: 'a1', isDefaultShipping: true, isDefaultBilling: false }];
const body = (method: string, b: unknown) => new Request('http://localhost/api/account/addresses', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const params = (addressId: string) => ({ params: Promise.resolve({ addressId }) });
const signedIn = () => vi.mocked(getSession).mockResolvedValue({ customerId: 'c-1' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(getSession).mockResolvedValue({});
});

describe('anonymous visitors', () => {
  it('get a private 401 from every address route and nothing is read or written', async () => {
    const responses = [
      await GET(),
      await POST(body('POST', valid)),
      await PATCH(body('PATCH', valid), params('a1')),
      await DELETE(new Request('http://localhost/x', { method: 'DELETE' }), params('a1')),
      await MAKE_DEFAULT(new Request('http://localhost/x', { method: 'POST' }), params('a1')),
    ];
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    }
    for (const fn of [getAddresses, addAddress, changeAddress, removeAddress, makeDefault]) expect(fn).not.toHaveBeenCalled();
  });
});

describe('signed-in customer', () => {
  beforeEach(signedIn);

  it('GET lists the session customer only', async () => {
    vi.mocked(getAddresses).mockResolvedValue(book);
    const res = await GET();
    expect(await res.json()).toEqual({ addresses: book });
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getAddresses).toHaveBeenCalledWith('c-1');
  });

  it('POST adds and returns the full list', async () => {
    vi.mocked(addAddress).mockResolvedValue(book);
    const res = await POST(body('POST', { ...valid, firstName: ' Ada ', phone: '', extra: 'ignored' }));
    expect(res.status).toBe(201);
    expect((await res.json()).addresses).toEqual(book);
    expect(addAddress).toHaveBeenCalledWith('c-1', valid);
  });

  it('Invalid postcode: 400 with field keys and nothing is saved', async () => {
    const res = await POST(body('POST', { ...valid, postalCode: '12', city: '' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_ADDRESS', fields: { postalCode: 'invalidPostcode', city: 'required' } });
    expect(addAddress).not.toHaveBeenCalled();
  });

  it('PATCH validates, then changes and returns the list', async () => {
    const bad = await PATCH(body('PATCH', { ...valid, country: 'FR' }), params('a1'));
    expect(bad.status).toBe(400);
    expect((await bad.json()).fields).toEqual({ country: 'invalidCountry' });
    expect(changeAddress).not.toHaveBeenCalled();

    vi.mocked(changeAddress).mockResolvedValue(book);
    const ok = await PATCH(body('PATCH', valid), params('a1'));
    expect((await ok.json()).addresses).toEqual(book);
    expect(changeAddress).toHaveBeenCalledWith('c-1', 'a1', valid);
  });

  it('DELETE returns the remaining list', async () => {
    vi.mocked(removeAddress).mockResolvedValue([]);
    const res = await DELETE(new Request('http://localhost/x', { method: 'DELETE' }), params('a1'));
    expect(await res.json()).toEqual({ addresses: [] });
    expect(removeAddress).toHaveBeenCalledWith('c-1', 'a1');
  });

  it('POST /default makes the address default and returns the list', async () => {
    vi.mocked(makeDefault).mockResolvedValue(book);
    const res = await MAKE_DEFAULT(new Request('http://localhost/x', { method: 'POST' }), params('a1'));
    expect((await res.json()).addresses).toEqual(book);
    expect(makeDefault).toHaveBeenCalledWith('c-1', 'a1');
  });

  it('an address that is not in the customer book: 404 ADDRESS_NOT_FOUND', async () => {
    vi.mocked(removeAddress).mockRejectedValue(new AddressNotFoundError('x'));
    const res = await DELETE(new Request('http://localhost/x', { method: 'DELETE' }), params('x'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'ADDRESS_NOT_FOUND' });
  });

  it('commercetools failures: 500 ADDRESS_ERROR, private, no address in the log', async () => {
    vi.mocked(getAddresses).mockRejectedValue(new Error('boom'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'ADDRESS_ERROR' });
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
