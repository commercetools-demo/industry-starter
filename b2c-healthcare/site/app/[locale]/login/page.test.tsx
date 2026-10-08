// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const redirect = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('@/i18n/routing', () => ({ redirect: (a: unknown) => redirect(a) }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('@/components/account/SignInCard', () => ({ SignInCard: () => null }));

import LoginPage from './page';

const render = async (query: Record<string, string | string[] | undefined> = {}) => {
  const element = (await LoginPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve(query) })) as {
    props: Record<string, unknown>;
  };
  return element.props;
};

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({});
  redirect.mockReset();
});

describe('account-sign-in: sign-in page', () => {
  it('anonymous visitor: renders the card with the sanitized destination and its reason', async () => {
    expect(await render({ next: '/en-US/cart' })).toEqual({ next: '/cart', reason: 'cart', initialMode: 'in' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('no next: destination /account, no reason', async () => {
    expect(await render()).toEqual({ next: '/account', reason: null, initialMode: 'in' });
  });

  it('?mode=register opens the card in create mode', async () => {
    expect((await render({ mode: 'register' })).initialMode).toBe('up');
  });

  it('Open redirect rejected: /en-US/login?next=//evil.com ignores next', async () => {
    expect(await render({ next: '//evil.com' })).toMatchObject({ next: '/account' });
    expect(await render({ next: 'https://evil.com/x' })).toMatchObject({ next: '/account' });
  });

  it('an already signed-in visitor is redirected to /account', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    await render();
    expect(redirect).toHaveBeenCalledExactlyOnceWith({ href: '/account', locale: 'en-US' });
  });

  it('an already signed-in visitor with a valid next goes there; an evil next goes to /account', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    await render({ next: '/en-US/prescriptions' });
    expect(redirect).toHaveBeenLastCalledWith({ href: '/prescriptions', locale: 'en-US' });
    await render({ next: '//evil.com' });
    expect(redirect).toHaveBeenLastCalledWith({ href: '/account', locale: 'en-US' });
  });
});
