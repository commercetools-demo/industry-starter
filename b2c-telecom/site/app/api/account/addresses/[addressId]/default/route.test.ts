// @vitest-environment node
import { ApiError } from '@/lib/api-error';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn(), setDefault: vi.fn() }));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/ct/addresses', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/addresses')>()), setDefault: state.setDefault }));

import { AddressNotFoundError } from '@/lib/ct/addresses';
import { POST } from './route';

const post = (body: unknown) => new Request('http://localhost/api/account/addresses/a1/default', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(body) });
const params = (addressId = 'a1') => ({ params: Promise.resolve({ addressId }) });

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-1' } });
  state.setDefault.mockResolvedValue([{ id: 'a1' }]);
});

describe('POST /api/account/addresses/[addressId]/default', () => {
  it('401 for an anonymous request', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    expect((await POST(post({ kind: 'service' }), params())).status).toBe(401);
  });
  it('sets the default and returns the list', async () => {
    const response = await POST(post({ kind: 'billing' }), params());
    expect(state.setDefault).toHaveBeenCalledWith('cust-1', 'a1', 'billing');
    expect(await response.json()).toEqual({ addresses: [{ id: 'a1' }] });
  });
  it('400 for an unknown kind', async () => {
    expect((await POST(post({ kind: 'shipping' }), params())).status).toBe(400);
    expect(state.setDefault).not.toHaveBeenCalled();
  });
  it('404 for a foreign address id', async () => {
    state.setDefault.mockRejectedValue(new AddressNotFoundError());
    expect((await POST(post({ kind: 'service' }), params('x'))).status).toBe(404);
  });
});
