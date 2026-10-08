// @vitest-environment node
import { ApiError } from '@/lib/api-error';
import { mapOrder } from '@/lib/mappers/order';
import { orderDevice } from '@/test/fixtures/orders';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn(), requestReturn: vi.fn() }));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/post-purchase', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/post-purchase')>()), requestReturn: state.requestReturn }));

import { OrderNotFoundError, ReturnInputError, ReturnNotAllowedError } from '@/lib/ct/post-purchase';
import { POST } from './route';

const BODY = { items: [{ lineItemId: 'd2', quantity: 1 }], reason: 'defective', note: 'cracked' };
const request = (body: unknown = BODY, origin: string | null = 'http://localhost') =>
  new Request('http://localhost/api/orders/QA-DDDD04/return', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
const call = (req: Request = request(), orderNumber = 'QA-DDDD04') => POST(req, { params: Promise.resolve({ orderNumber }) });
const codeOf = async (response: Response) => ((await response.json()) as { error: { code: string } }).error.code;

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-alex' } });
  state.requestReturn.mockResolvedValue(mapOrder(orderDevice(), 'en-US'));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('POST /api/orders/[orderNumber]/return', () => {
  it('401 for an anonymous request', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    const response = await call();
    expect(response.status).toBe(401);
    expect(await codeOf(response)).toBe('UNAUTHENTICATED');
    expect(state.requestReturn).not.toHaveBeenCalled();
  });

  it('404 for a malformed order number and for an order that is not theirs', async () => {
    expect((await call(request(), '../x')).status).toBe(404);
    state.requestReturn.mockRejectedValue(new OrderNotFoundError());
    const response = await call();
    expect(response.status).toBe(404);
    expect(await codeOf(response)).toBe('ORDER_NOT_FOUND');
  });

  it.each(['INVALID_ITEMS', 'QUANTITY_TOO_HIGH', 'INVALID_REASON', 'NOTE_REQUIRED', 'NOTE_TOO_LONG'] as const)('400 %s', async (code) => {
    state.requestReturn.mockRejectedValue(new ReturnInputError(code));
    const response = await call();
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe(code);
  });

  it.each(['ORDER_CANCELLED', 'WINDOW_CLOSED', 'NO_RETURNABLE_LINES'] as const)('409 %s', async (code) => {
    state.requestReturn.mockRejectedValue(new ReturnNotAllowedError(code));
    const response = await call();
    expect(response.status).toBe(409);
    expect(await codeOf(response)).toBe(code);
  });

  it('502 RETURN_FAILED for an upstream failure', async () => {
    state.requestReturn.mockRejectedValue(new Error('boom'));
    const response = await call();
    expect(response.status).toBe(502);
    expect(await codeOf(response)).toBe('RETURN_FAILED');
  });

  it('400 INVALID_BODY for an array body', async () => {
    const response = await call(request([1]));
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe('INVALID_BODY');
  });

  it('200 returns the order and passes the session customer, never one from the request', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(((await response.json()) as { order: { orderNumber: string } }).order.orderNumber).toBe('QA-DDDD04');
    expect(state.requestReturn).toHaveBeenCalledWith('QA-DDDD04', 'cust-alex', BODY, 'en-US');
  });
});
