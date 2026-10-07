// @vitest-environment node
import { ApiError } from '@/lib/api-error';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn(), changeAddress: vi.fn(), removeAddress: vi.fn() }));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/ct/addresses', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/addresses')>()), changeAddress: state.changeAddress, removeAddress: state.removeAddress }));

import { AddressNotFoundError } from '@/lib/ct/addresses';
import { DELETE, PATCH } from './route';

const address = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', isService: true, isBilling: false };
const headers = { 'content-type': 'application/json', origin: 'http://localhost' };
const patch = (body: unknown) => new Request('http://localhost/api/account/addresses/a1', { method: 'PATCH', headers, body: JSON.stringify(body) });
const del = () => new Request('http://localhost/api/account/addresses/a1', { method: 'DELETE', headers });
const params = (addressId = 'a1') => ({ params: Promise.resolve({ addressId }) });

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-1' } });
  state.changeAddress.mockResolvedValue([{ id: 'a1' }]);
  state.removeAddress.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('PATCH /api/account/addresses/[addressId]', () => {
  it('401 for an anonymous request', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    expect((await PATCH(patch({ address }), params())).status).toBe(401);
  });
  it('changes the address and returns the list', async () => {
    const response = await PATCH(patch({ address }), params());
    expect(response.status).toBe(200);
    expect(state.changeAddress).toHaveBeenCalledWith('cust-1', 'a1', expect.objectContaining({ streetName: '1 Main St', isBilling: false }));
    expect(await response.json()).toEqual({ addresses: [{ id: 'a1' }] });
  });
  it('400 field errors and 409 unresolved store nothing', async () => {
    expect((await PATCH(patch({ address: { ...address, state: 'ZZ' } }), params())).status).toBe(400);
    expect((await PATCH(patch({ address: { ...address, city: 'Brooklyn' } }), params())).status).toBe(409);
    expect(state.changeAddress).not.toHaveBeenCalled();
    expect((await PATCH(patch({ address: { ...address, city: 'Brooklyn' }, confirmed: true }), params())).status).toBe(200);
  });
  it('404 ADDRESS_NOT_FOUND for another customer address id', async () => {
    state.changeAddress.mockRejectedValue(new AddressNotFoundError());
    const response = await PATCH(patch({ address }), params('someone-elses'));
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('ADDRESS_NOT_FOUND');
  });
});

describe('DELETE /api/account/addresses/[addressId]', () => {
  it('removes the address and returns the remaining list', async () => {
    const response = await DELETE(del(), params());
    expect(state.removeAddress).toHaveBeenCalledWith('cust-1', 'a1');
    expect(await response.json()).toEqual({ addresses: [] });
  });
  it('404 for a foreign id', async () => {
    state.removeAddress.mockRejectedValue(new AddressNotFoundError());
    expect((await DELETE(del(), params('x'))).status).toBe(404);
  });
});
