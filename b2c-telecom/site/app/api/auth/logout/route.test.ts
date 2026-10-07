// @vitest-environment node
import { authRequest, resetWorld, world } from '@/test/fixtures/authWorld';

vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/authWorld')).sessionMock);

import { POST } from './route';

beforeEach(() => resetWorld({ anonymousId: 'anon-1', customerId: 'c-1', signedInAt: '1', cartId: 'cart-9' }));

describe('POST /api/auth/logout', () => {
  it('clears the identity fields and the cart id, keeps the anonymous id and needs no commercetools call', async () => {
    const res = await POST(authRequest('/api/auth/logout', {}));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(world.session).toEqual({ anonymousId: 'anon-1' });
    expect(world.calls).toEqual([]);
  });

  it('refuses another origin', async () => {
    const res = await POST(authRequest('/api/auth/logout', {}, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(world.session.customerId).toBe('c-1');
  });
});
