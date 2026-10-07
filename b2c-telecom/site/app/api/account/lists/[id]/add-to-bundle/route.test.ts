// @vitest-environment node
import { ApiError } from '@/lib/api-error';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn(), move: vi.fn(), updateSession: vi.fn() }));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/session', () => ({ updateSession: state.updateSession }));
vi.mock('@/lib/ct/list-to-bundle', () => ({ moveListToBundle: state.move }));

import { ListNotFoundError } from '@/lib/ct/lists';
import { POST } from './route';

const post = () => new Request('http://localhost/api/account/lists/l1/add-to-bundle', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: '{}' });
const params = (id = 'l1') => ({ params: Promise.resolve({ id }) });
const result = { added: [{ lineId: 'a', offerKey: 'plan', name: 'Plan' }], skipped: [], cart: { id: 'cart-9', lines: [] } };

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-1', cartId: 'cart-1' } });
  state.move.mockResolvedValue({ result, cartId: 'cart-1' });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('POST /api/account/lists/[id]/add-to-bundle', () => {
  it('401 for an anonymous visitor', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    expect((await POST(post(), params())).status).toBe(401);
    expect(state.move).not.toHaveBeenCalled();
  });
  it("404 for another customer's list", async () => {
    state.move.mockRejectedValue(new ListNotFoundError());
    expect((await POST(post(), params('theirs'))).status).toBe(404);
  });
  it('returns the BundleMoveResult for the session customer and leaves the session cookie alone when the cart did not change', async () => {
    const response = await POST(post(), params());
    expect(await response.json()).toEqual(result);
    expect(state.move).toHaveBeenCalledWith({ customerId: 'cust-1', cartId: 'cart-1' }, expect.objectContaining({ country: 'US' }), 'l1');
    expect(state.updateSession).not.toHaveBeenCalled();
  });
  it('remembers a cart the move created', async () => {
    state.move.mockResolvedValue({ result, cartId: 'cart-new' });
    await POST(post(), params());
    expect(state.updateSession).toHaveBeenCalledWith({ cartId: 'cart-new' }, expect.anything());
  });
});
