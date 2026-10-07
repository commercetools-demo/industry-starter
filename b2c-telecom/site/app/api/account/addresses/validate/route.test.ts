// @vitest-environment node
import { ApiError } from '@/lib/api-error';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn() }));
vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));

import { POST } from './route';

const address = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' };
const post = (body: unknown) => new Request('http://localhost/api/account/addresses/validate', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(body) });

beforeEach(() => {
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-1' } });
});

describe('POST /api/account/addresses/validate', () => {
  it('401 for an anonymous request', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    expect((await POST(post({ address }))).status).toBe(401);
  });
  it('returns the field errors and no resolution when the format is wrong', async () => {
    const body = (await (await POST(post({ address: { ...address, postalCode: '1' } }))).json()) as { fields: Record<string, string>; resolve?: unknown };
    expect(body.fields).toEqual({ postalCode: 'invalidPostalCode' });
    expect(body.resolve).toBeUndefined();
  });
  it('returns the resolver verdict when the format is fine', async () => {
    const body = (await (await POST(post({ address: { ...address, city: 'Brooklyn' } }))).json()) as { fields: object; resolve: { status: string } };
    expect(body.fields).toEqual({});
    expect(body.resolve.status).toBe('unresolved');
    const ok = (await (await POST(post({ address }))).json()) as { resolve: { status: string } };
    expect(ok.resolve.status).toBe('resolved');
  });
});
