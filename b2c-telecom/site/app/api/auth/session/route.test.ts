// @vitest-environment node
import { createSessionToken } from '@/lib/ct/session';
import { GET } from './route';

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.value !== undefined ? { name, value: jar.value } : undefined),
  }),
}));

beforeEach(() => {
  jar.value = undefined;
});

describe('GET /api/auth/session', () => {
  it('no cookie: answers kind none, no-store, and sets no cookie', async () => {
    const res = await GET();
    expect(await res.text()).toBe('{"session":{"kind":"none","hasCart":false}}');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('customer cookie: answers kind customer with the customer id only', async () => {
    jar.value = await createSessionToken({ customerId: 'c1', cartId: 'cart-9', anonymousId: 'a' });
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ session: { kind: 'customer', customerId: 'c1', hasCart: true } });
    expect(JSON.stringify(body)).not.toContain('cart-9');
  });

  it('anonymous cookie: answers kind anonymous', async () => {
    jar.value = await createSessionToken({ anonymousId: 'a' });
    expect((await (await GET()).json()).session).toEqual({ kind: 'anonymous', hasCart: false });
  });
});
