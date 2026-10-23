// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ signedIn: false, redirect: vi.fn() }));
vi.mock('@/lib/auth/current-customer', () => ({ hasSignedInCustomer: async () => h.signedIn }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('@/i18n/routing', () => ({
  redirect: (arg: unknown) => {
    h.redirect(arg);
    throw new Error('NEXT_REDIRECT');
  },
}));

import SignInPage from '@/app/[locale]/account/sign-in/page';

const render = (search: Record<string, string | string[]>) =>
  SignInPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve(search) });

beforeEach(() => {
  h.signedIn = false;
  h.redirect.mockReset();
});

describe('sign-in page', () => {
  it('Unsafe redirect falls back to account', async () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil', 'javascript:1']) {
      const el = (await render({ redirect: bad })) as { props: { redirectTo: string } };
      expect(el.props.redirectTo).toBe('/account');
    }
    const ok = (await render({ redirect: '/checkout' })) as { props: { redirectTo: string; registerHref: string } };
    expect(ok.props.redirectTo).toBe('/checkout');
    expect(ok.props.registerHref).toBe('/account/register?redirect=%2Fcheckout');
  });

  it('accepts next as an alias, redirect wins', async () => {
    const alias = (await render({ next: '/account/orders' })) as { props: { redirectTo: string } };
    expect(alias.props.redirectTo).toBe('/account/orders');
    const both = (await render({ redirect: '/checkout', next: '/account/orders' })) as { props: { redirectTo: string } };
    expect(both.props.redirectTo).toBe('/checkout');
  });

  it('Signed in visitor is sent on', async () => {
    h.signedIn = true;
    await expect(render({ redirect: '/checkout' })).rejects.toThrow('NEXT_REDIRECT');
    expect(h.redirect).toHaveBeenCalledWith({ href: '/checkout', locale: 'en-US' });
  });

  it('a session whose customer no longer resolves shows the form', async () => {
    const el = (await render({ notice: 'signedOut' })) as { props: { notice: string | null } };
    expect(h.redirect).not.toHaveBeenCalled();
    expect(el.props.notice).toBe('signedOut');
  });

  it('ignores an unknown notice', async () => {
    const el = (await render({ notice: '<script>' })) as { props: { notice: string | null } };
    expect(el.props.notice).toBeNull();
  });
});
