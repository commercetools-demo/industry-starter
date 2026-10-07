import { ApiError } from '@/lib/api-error';
import type { getCustomerById as GetCustomerById } from '@/lib/ct/customer';

type Customer = NonNullable<Awaited<ReturnType<typeof GetCustomerById>>>;

const getSession = vi.fn();
const getCustomerById = vi.fn();
const redirect = vi.fn((arg: unknown) => {
  throw new Error(`REDIRECT ${JSON.stringify(arg)}`);
});
vi.mock('@/lib/ct/session', () => ({ getSession: () => getSession() }));
vi.mock('@/i18n/routing', () => ({ redirect: (arg: unknown) => redirect(arg) }));
vi.mock('@/lib/ct/customer', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/customer')>()), getCustomerById: (id: string) => getCustomerById(id) }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => ({}) }));

import { isSessionValid, requireCustomerApi, requireCustomerPage } from './guard';

const customer = (cutOff?: string): Customer =>
  ({ id: 'c-1', version: 1, email: 'a@b.co', isEmailVerified: true, ...(cutOff ? { custom: { type: { typeId: 'type', id: 't' }, fields: { sessionsValidAfter: cutOff } } } : {}) }) as Customer;

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerById.mockResolvedValue(customer());
});

describe('requireCustomerPage', () => {
  it('sends an anonymous visitor to login with the encoded, locale-prefixed return target', async () => {
    getSession.mockResolvedValue({ anonymousId: 'a', cartId: 'cart' });
    await expect(requireCustomerPage('en-US', '/account')).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/login?returnTo=%2Fen-US%2Faccount', locale: 'en-US' });
    expect(getCustomerById).not.toHaveBeenCalled();
  });

  it('keeps a path with sub-segments and falls back to /account for an unsafe path', async () => {
    getSession.mockResolvedValue({});
    await expect(requireCustomerPage('de-DE', '/account/orders/MLV-1')).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenLastCalledWith({ href: '/login?returnTo=%2Fde-DE%2Faccount%2Forders%2FMLV-1', locale: 'de-DE' });
    await expect(requireCustomerPage('de-DE', '//evil.com')).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenLastCalledWith({ href: '/login?returnTo=%2Fde-DE%2Faccount', locale: 'de-DE' });
  });

  it('a session issued before sessionsValidAfter is redirected to login', async () => {
    getSession.mockResolvedValue({ customerId: 'c-1', signedInAt: String(Date.parse('2026-10-07T10:00:00Z')) });
    getCustomerById.mockResolvedValue(customer('2026-10-07T11:00:00.000Z'));
    await expect(requireCustomerPage('en-US', '/account')).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/login?returnTo=%2Fen-US%2Faccount', locale: 'en-US' });
  });

  it('an unknown customer is redirected', async () => {
    getSession.mockResolvedValue({ customerId: 'gone', signedInAt: '1' });
    getCustomerById.mockResolvedValue(null);
    await expect(requireCustomerPage('en-US', '/account')).rejects.toThrow('REDIRECT');
  });

  it('a valid session returns the session and the customer read by the session customer id only', async () => {
    getSession.mockResolvedValue({ customerId: 'c-1', signedInAt: String(Date.parse('2026-10-07T12:00:00Z')) });
    getCustomerById.mockResolvedValue(customer('2026-10-07T11:00:00.000Z'));
    const result = await requireCustomerPage('en-US', '/account');
    expect(result.session.customerId).toBe('c-1');
    expect(result.customer.id).toBe('c-1');
    expect(getCustomerById).toHaveBeenCalledWith('c-1');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('requireCustomerApi', () => {
  it('throws 401 UNAUTHENTICATED for an anonymous session and for an invalidated one', async () => {
    getSession.mockResolvedValue({});
    await expect(requireCustomerApi()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    getSession.mockResolvedValue({ customerId: 'c-1', signedInAt: '1' });
    getCustomerById.mockResolvedValue(customer('2026-10-07T11:00:00.000Z'));
    const error = await requireCustomerApi().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });

  it('returns the customer for a valid session', async () => {
    getSession.mockResolvedValue({ customerId: 'c-1', signedInAt: String(Date.now()) });
    expect((await requireCustomerApi()).customer.id).toBe('c-1');
  });
});

describe('isSessionValid', () => {
  it('is valid without a cut-off, even for a session without signedInAt', () => {
    expect(isSessionValid({ customerId: 'c-1' }, customer())).toBe(true);
  });

  it('with a cut-off a session without signedInAt is invalid, one signed in exactly at the cut-off is valid', () => {
    const cutOff = '2026-10-07T11:00:00.000Z';
    expect(isSessionValid({ customerId: 'c-1' }, customer(cutOff))).toBe(false);
    expect(isSessionValid({ customerId: 'c-1', signedInAt: String(Date.parse(cutOff)) }, customer(cutOff))).toBe(true);
    expect(isSessionValid({ customerId: 'c-1', signedInAt: String(Date.parse(cutOff) - 1) }, customer(cutOff))).toBe(false);
  });

  it('a missing customer is invalid', () => {
    expect(isSessionValid({ customerId: 'c-1' }, null)).toBe(false);
  });
});
