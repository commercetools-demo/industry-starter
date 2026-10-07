// @vitest-environment node
import { ApiError } from '@/lib/api-error';

const state = vi.hoisted(() => ({
  requireCustomer: vi.fn(),
  getAddresses: vi.fn(),
  addAddress: vi.fn(),
}));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/ct/addresses', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/addresses')>()), getAddresses: state.getAddresses, addAddress: state.addAddress }));

import { AddressLimitError } from '@/lib/ct/addresses';
import { GET, POST } from './route';

const address = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', isService: true, isBilling: true };
const post = (body: unknown, origin: string | null = 'http://localhost') =>
  new Request('http://localhost/api/account/addresses', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
const list = [{ id: 'a1' }];

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-1' } });
  state.getAddresses.mockResolvedValue(list);
  state.addAddress.mockResolvedValue(list);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('GET /api/account/addresses', () => {
  it('401 for an anonymous request, never cached', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    const response = await GET(new Request('http://localhost/api/account/addresses'));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
    expect(state.getAddresses).not.toHaveBeenCalled();
  });
  it('lists the addresses of the session customer only', async () => {
    const response = await GET(new Request('http://localhost/api/account/addresses'));
    expect(await response.json()).toEqual({ addresses: list });
    expect(state.getAddresses).toHaveBeenCalledWith('cust-1');
  });
});

describe('POST /api/account/addresses', () => {
  it('401 for an anonymous request', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    expect((await POST(post({ address }))).status).toBe(401);
    expect(state.addAddress).not.toHaveBeenCalled();
  });
  it('refuses a request from another origin', async () => {
    expect((await POST(post({ address }, 'http://evil.example'))).status).toBe(403);
    expect(state.addAddress).not.toHaveBeenCalled();
  });
  it('400 INVALID_ADDRESS names the fields and stores nothing', async () => {
    const response = await POST(post({ address: { ...address, postalCode: '1234', city: '' } }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; details: { fields: Record<string, string> } } };
    expect(body.error.code).toBe('INVALID_ADDRESS');
    expect(body.error.details.fields).toEqual({ city: 'required', postalCode: 'invalidPostalCode' });
    expect(state.addAddress).not.toHaveBeenCalled();
  });
  it('Validation cannot resolve the address: 409 names the fields and nearest match and stores nothing', async () => {
    const response = await POST(post({ address: { ...address, city: 'Brooklyn' } }));
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string; details: { unresolvedFields: string[]; nearestMatch: { city: string } } } };
    expect(body.error.code).toBe('ADDRESS_UNRESOLVED');
    expect(body.error.details.unresolvedFields).toEqual(['city']);
    expect(body.error.details.nearestMatch.city).toBe('New York');
    expect(state.addAddress).not.toHaveBeenCalled();
  });
  it('stores an unresolved address once the buyer confirmed it', async () => {
    const response = await POST(post({ address: { ...address, city: 'Brooklyn' }, confirmed: true, makeDefaultService: true }));
    expect(response.status).toBe(201);
    expect(state.addAddress).toHaveBeenCalledWith('cust-1', expect.objectContaining({ city: 'Brooklyn' }), { service: true, billing: false });
    expect(await response.json()).toEqual({ addresses: list });
  });
  it('stores a resolved address and returns the list', async () => {
    const response = await POST(post({ address, makeDefaultService: true, makeDefaultBilling: true }));
    expect(response.status).toBe(201);
    expect(state.addAddress).toHaveBeenCalledWith('cust-1', expect.objectContaining({ postalCode: '10001', isService: true }), { service: true, billing: true });
  });
  it('422 ADDRESS_LIMIT when the book is full', async () => {
    state.addAddress.mockRejectedValue(new AddressLimitError());
    const response = await POST(post({ address }));
    expect(response.status).toBe(422);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('ADDRESS_LIMIT');
  });
  it('400 INVALID_BODY for a body that is not a JSON object', async () => {
    const response = await POST(new Request('http://localhost/api/account/addresses', { method: 'POST', headers: { origin: 'http://localhost' }, body: '[]' }));
    expect(response.status).toBe(400);
  });
});
