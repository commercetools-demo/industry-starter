// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ session: {} as { customerId?: string }, redirect: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('@/lib/session', () => ({ getSession: async () => h.session }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en-CA' }));
vi.mock('@/i18n/routing', () => ({
  redirect: (arg: unknown) => {
    h.redirect(arg);
    throw new Error('NEXT_REDIRECT');
  },
}));

import { handle } from '@/lib/api';
import { requireCustomerApi, requireCustomerPage } from '@/lib/auth/require-customer';

beforeEach(() => {
  h.session = {};
  h.redirect.mockReset();
});

describe('guards', () => {
  it('requireCustomerPage redirects with the path preserved', async () => {
    await expect(requireCustomerPage('/account/orders')).rejects.toThrow('NEXT_REDIRECT');
    expect(h.redirect).toHaveBeenCalledWith({
      href: '/account/sign-in?redirect=%2Faccount%2Forders',
      locale: 'en-CA',
    });
  });

  it('requireCustomerPage never forwards an unsafe path', async () => {
    await expect(requireCustomerPage('https://evil.example')).rejects.toThrow();
    expect(h.redirect.mock.calls[0][0].href).toBe('/account/sign-in?redirect=%2Faccount');
  });

  it('requireCustomerPage returns the customer id when signed in', async () => {
    h.session = { customerId: 'c1' };
    await expect(requireCustomerPage('/account')).resolves.toEqual({ customerId: 'c1' });
  });

  it('requireCustomerApi returns 401 with no detail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const route = handle('/api/x', async () => {
      await requireCustomerApi();
      return Response.json({ ok: true });
    });
    const res = await route(new Request('http://x/api/x'), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
  });
});
