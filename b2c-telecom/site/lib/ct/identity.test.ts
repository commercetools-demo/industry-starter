// @vitest-environment node
import { ApiError } from '@/lib/api-error';
import { ensureAnonymousId, requireCustomer, sessionKind, toSummary } from './identity';

describe('sessionKind', () => {
  it('classifies sessions', () => {
    expect(sessionKind({})).toBe('none');
    expect(sessionKind({ anonymousId: 'a' })).toBe('anonymous');
    expect(sessionKind({ cartId: 'c' })).toBe('anonymous');
    expect(sessionKind({ customerId: 'c1' })).toBe('customer');
    expect(sessionKind({ customerId: 'c1', anonymousId: 'a' })).toBe('customer');
  });
});

describe('requireCustomer', () => {
  it('returns the customer id', () => {
    expect(requireCustomer({ customerId: 'c1' })).toBe('c1');
  });

  it('throws UNAUTHENTICATED (401) without one', () => {
    try {
      requireCustomer({ anonymousId: 'a' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('UNAUTHENTICATED');
      expect((error as ApiError).status).toBe(401);
    }
  });
});

describe('ensureAnonymousId', () => {
  it('keeps an existing id', () => {
    expect(ensureAnonymousId({ anonymousId: 'a1' })).toEqual({ anonymousId: 'a1', created: false });
  });

  it('mints a UUID otherwise', () => {
    const result = ensureAnonymousId({});
    expect(result.created).toBe(true);
    expect(result.anonymousId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('toSummary', () => {
  it('never includes cartId, anonymousId or other fields', () => {
    expect(toSummary({})).toEqual({ kind: 'none', hasCart: false });
    expect(toSummary({ anonymousId: 'a', cartId: 'cart', locale: 'en-US' })).toEqual({ kind: 'anonymous', hasCart: true });
    const customer = toSummary({ customerId: 'c1', cartId: 'cart', anonymousId: 'a', lastOrderNumber: 'N1' });
    expect(customer).toEqual({ kind: 'customer', customerId: 'c1', hasCart: true });
    expect(JSON.stringify(customer)).not.toContain('cart"');
  });
});
