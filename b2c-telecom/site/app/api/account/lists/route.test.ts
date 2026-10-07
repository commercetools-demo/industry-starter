// @vitest-environment node
import { ApiError } from '@/lib/api-error';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn(), getLists: vi.fn(), createList: vi.fn(), createListFromCart: vi.fn(), toDetail: vi.fn(), readBundle: vi.fn() }));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => ({ customerId: 'cust-1', cartId: 'cart-1' }) }));
vi.mock('@/lib/ct/bundle', () => ({ readBundle: state.readBundle }));
vi.mock('@/lib/ct/lists', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ct/lists')>()),
  getLists: state.getLists,
  createList: state.createList,
  createListFromCart: state.createListFromCart,
  toDetail: state.toDetail,
}));

import { InvalidListNameError, ListLimitError } from '@/lib/ct/lists';
import { GET, POST } from './route';

const post = (body: unknown) => new Request('http://localhost/api/account/lists', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-1' } });
  state.getLists.mockResolvedValue([{ id: 'l1', name: 'Home', lineCount: 2, updatedAt: 'x' }]);
  state.createList.mockResolvedValue({ id: 'new' });
  state.createListFromCart.mockResolvedValue({ id: 'new' });
  state.toDetail.mockResolvedValue({ id: 'new', name: 'Home', lines: [] });
  state.readBundle.mockResolvedValue({ cart: { id: 'cart-1', lines: [] }, cartId: 'cart-1' });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('/api/account/lists', () => {
  it('401 for an anonymous visitor (saved lists need sign-in)', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    expect((await GET(new Request('http://localhost/api/account/lists'))).status).toBe(401);
    expect((await POST(post({ name: 'x' }))).status).toBe(401);
    expect(state.createList).not.toHaveBeenCalled();
  });
  it('lists the customer lists', async () => {
    const response = await GET(new Request('http://localhost/api/account/lists'));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ lists: [{ id: 'l1', name: 'Home', lineCount: 2, updatedAt: 'x' }] });
    expect(state.getLists).toHaveBeenCalledWith('cust-1');
  });
  it('creates a list for the session customer', async () => {
    const response = await POST(post({ name: 'Home' }));
    expect(response.status).toBe(201);
    expect(state.createList).toHaveBeenCalledWith('cust-1', 'Home');
  });
  it('fromCart copies the session cart, not a cart named by the client', async () => {
    const response = await POST(post({ name: 'Home', fromCart: true, cartId: 'someone-elses' }));
    expect(response.status).toBe(201);
    expect(state.createListFromCart).toHaveBeenCalledWith('cust-1', 'Home', { id: 'cart-1', lines: [] }, expect.objectContaining({ country: 'US' }));
    expect(state.readBundle).toHaveBeenCalledWith({ customerId: 'cust-1', cartId: 'cart-1' }, expect.anything());
  });
  it('422 LIST_LIMIT and 400 INVALID_NAME', async () => {
    state.createList.mockRejectedValueOnce(new ListLimitError());
    const limit = await POST(post({ name: 'x' }));
    expect(limit.status).toBe(422);
    expect(((await limit.json()) as { error: { code: string } }).error.code).toBe('LIST_LIMIT');
    state.createList.mockRejectedValueOnce(new InvalidListNameError());
    const invalid = await POST(post({ name: '' }));
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { code: string } }).error.code).toBe('INVALID_NAME');
  });
});
