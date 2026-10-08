// @vitest-environment node
import { ApiError } from '@/lib/api-error';
import { mapOrder } from '@/lib/mappers/order';
import { orderA } from '@/test/fixtures/orders';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn(), cancel: vi.fn() }));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/post-purchase', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/post-purchase')>()), cancelOrder: state.cancel }));

import { NotCancellableError, OrderNotFoundError } from '@/lib/ct/post-purchase';
import { POST } from './route';

const NOTE = 'private words that must not be logged';
const request = (body: unknown = { reason: 'moving' }, origin: string | null = 'http://localhost') =>
  new Request('http://localhost/api/orders/QA-AAAA01/cancel', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const call = (req: Request = request(), orderNumber = 'QA-AAAA01') => POST(req, { params: Promise.resolve({ orderNumber }) });
const codeOf = async (response: Response) => ((await response.json()) as { error: { code: string; details?: Record<string, unknown> } }).error;

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-alex' } });
  state.cancel.mockResolvedValue({ ...mapOrder(orderA(), 'en-US'), orderState: 'Cancelled', status: 'cancelled' });
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('POST /api/orders/[orderNumber]/cancel', () => {
  it('401 for an anonymous request and nothing is read', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    const response = await call();
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await codeOf(response)).code).toBe('UNAUTHENTICATED');
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('refuses a request from another origin', async () => {
    expect((await call(request({ reason: 'moving' }, 'http://evil.example'))).status).toBe(403);
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it.each(['../etc', 'a b', '', 'x'.repeat(41)])('404 for the order number %j before anything is read', async (orderNumber) => {
    const response = await call(request(), orderNumber);
    expect(response.status).toBe(404);
    expect((await codeOf(response)).code).toBe('ORDER_NOT_FOUND');
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('404 ORDER_NOT_FOUND for an order that is not the customer\'s', async () => {
    state.cancel.mockRejectedValue(new OrderNotFoundError());
    const response = await call();
    expect(response.status).toBe(404);
    expect((await codeOf(response)).code).toBe('ORDER_NOT_FOUND');
    expect(state.cancel).toHaveBeenCalledWith('QA-AAAA01', 'cust-alex', { reason: 'moving' }, 'en-US');
  });

  it.each([
    [{ reason: 'bored' }, 'INVALID_REASON'],
    [{ reason: 'other' }, 'NOTE_REQUIRED'],
    [{ reason: 'moving', note: 'x'.repeat(281) }, 'NOTE_TOO_LONG'],
  ])('400 %j is %s', async (body, code) => {
    const response = await call(request(body));
    expect(response.status).toBe(400);
    expect((await codeOf(response)).code).toBe(code);
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('400 INVALID_BODY for a body that is not JSON', async () => {
    const response = await call(request('nope'));
    expect(response.status).toBe(400);
    expect((await codeOf(response)).code).toBe('INVALID_BODY');
  });

  it('409 NOT_CANCELLABLE carries the block', async () => {
    state.cancel.mockRejectedValue(new NotCancellableError('SERVICE_STARTED'));
    const response = await call();
    expect(response.status).toBe(409);
    expect(await codeOf(response)).toMatchObject({ code: 'NOT_CANCELLABLE', details: { block: 'SERVICE_STARTED' } });
  });

  it('502 CANCEL_FAILED when the write fails, and the note is not logged', async () => {
    state.cancel.mockRejectedValue(Object.assign(new Error(`failed for ${NOTE}`), { name: 'HttpError' }));
    const response = await call(request({ reason: 'other', note: NOTE }));
    expect(response.status).toBe(502);
    expect((await codeOf(response)).code).toBe('CANCEL_FAILED');
    expect(JSON.stringify(errors.mock.calls)).not.toContain(NOTE);
  });

  it('200 returns the cancelled order for the session customer', async () => {
    const response = await call(request({ reason: 'other', note: `  ${NOTE} ` }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(((await response.json()) as { order: { orderState: string } }).order.orderState).toBe('Cancelled');
    expect(state.cancel).toHaveBeenCalledWith('QA-AAAA01', 'cust-alex', { reason: 'other', note: NOTE }, 'en-US');
    expect(JSON.stringify(errors.mock.calls)).not.toContain(NOTE);
  });
});
