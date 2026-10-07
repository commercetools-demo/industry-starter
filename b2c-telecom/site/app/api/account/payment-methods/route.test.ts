// @vitest-environment node
import { ApiError } from '@/lib/api-error';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn(), list: vi.fn(), setDefault: vi.fn(), remove: vi.fn() }));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/payment-methods', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ct/payment-methods')>()),
  listPaymentMethods: state.list,
  setDefaultPaymentMethod: state.setDefault,
  removePaymentMethod: state.remove,
}));

import { PaymentMethodNotFoundError, PaymentMethodsForbiddenError } from '@/lib/ct/payment-methods';
import { DELETE } from './[id]/route';
import { POST } from './[id]/default/route';
import { GET } from './route';

const record = (id: string, isDefault = false) => ({
  id, version: 1, default: isDefault, paymentMethodStatus: 'Active', customer: { typeId: 'customer', id: 'cust-1' },
  token: { value: 'tok_demo_visa_4242' }, paymentInterface: 'malva-demo', interfaceAccount: 'acct-1',
  custom: { fields: { brand: 'visa', last4: '4242', expMonth: 3, expYear: 2030 } },
});
const headers = { origin: 'http://localhost' };
const params = (id = 'pm-1') => ({ params: Promise.resolve({ id }) });
const get = () => new Request('http://localhost/api/account/payment-methods');

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-1' } });
  state.list.mockResolvedValue([record('pm-1', true), record('pm-2')]);
  state.setDefault.mockResolvedValue(undefined);
  state.remove.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('/api/account/payment-methods', () => {
  it('401 for an anonymous request on every route', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    expect((await GET(get())).status).toBe(401);
    expect((await POST(new Request('http://localhost/x', { method: 'POST', headers }), params())).status).toBe(401);
    expect((await DELETE(new Request('http://localhost/x', { method: 'DELETE', headers }), params())).status).toBe(401);
    expect(state.list).not.toHaveBeenCalled();
  });

  it('lists the descriptor and default flag, never the token, and is not cacheable', async () => {
    const response = await GET(get());
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ paymentMethods: [{ id: 'pm-1', brand: 'visa', last4: '4242', expiry: '03/30', label: '', isDefault: true }, { id: 'pm-2', brand: 'visa', last4: '4242', expiry: '03/30', label: '', isDefault: false }] });
    expect(text).not.toMatch(/tok_demo|token|malva-demo|acct-1|paymentInterface/);
  });

  it('makes a method the default for the session customer and answers with the list', async () => {
    const response = await POST(new Request('http://localhost/x', { method: 'POST', headers }), params('pm-2'));
    expect(state.setDefault).toHaveBeenCalledWith('cust-1', 'pm-2');
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('tok_demo');
  });

  it('removes a method and answers with the list', async () => {
    const response = await DELETE(new Request('http://localhost/x', { method: 'DELETE', headers }), params('pm-1'));
    expect(state.remove).toHaveBeenCalledWith('cust-1', 'pm-1');
    expect(response.status).toBe(200);
  });

  it('404 PAYMENT_METHOD_NOT_FOUND for another customer record', async () => {
    state.setDefault.mockRejectedValue(new PaymentMethodNotFoundError());
    state.remove.mockRejectedValue(new PaymentMethodNotFoundError());
    for (const response of [await POST(new Request('http://localhost/x', { method: 'POST', headers }), params('foreign')), await DELETE(new Request('http://localhost/x', { method: 'DELETE', headers }), params('foreign'))]) {
      expect(response.status).toBe(404);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe('PAYMENT_METHOD_NOT_FOUND');
    }
  });

  it('503 PAYMENT_METHODS_UNAVAILABLE when the storefront client lacks the scope', async () => {
    state.list.mockRejectedValue(new PaymentMethodsForbiddenError());
    const response = await GET(get());
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('PAYMENT_METHODS_UNAVAILABLE');
  });

  it('refuses a write from another origin', async () => {
    expect((await DELETE(new Request('http://localhost/x', { method: 'DELETE', headers: { origin: 'http://evil.example' } }), params())).status).toBe(403);
    expect(state.remove).not.toHaveBeenCalled();
  });
});
