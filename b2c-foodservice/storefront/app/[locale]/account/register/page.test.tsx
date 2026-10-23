// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ signedIn: false, guest: '', redirect: vi.fn() }));
vi.mock('@/lib/auth/current-customer', () => ({ hasSignedInCustomer: async () => h.signedIn }));
vi.mock('@/lib/auth/guest-email', () => ({ readGuestEmail: async () => h.guest }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('@/i18n/routing', () => ({
  redirect: (arg: unknown) => {
    h.redirect(arg);
    throw new Error('NEXT_REDIRECT');
  },
}));

import RegisterPage from '@/app/[locale]/account/register/page';

type Props = { redirectTo: string; initialEmail: string; signInHref: string };
const render = async (search: Record<string, string>) =>
  ((await RegisterPage({ params: Promise.resolve({ locale: 'en-CA' }), searchParams: Promise.resolve(search) })) as unknown as {
    props: Props;
  }).props;

beforeEach(() => {
  h.signedIn = false;
  h.guest = '';
  h.redirect.mockReset();
});

describe('register page', () => {
  it('Register pre-fills email from the guest cookie and deletes it', async () => {
    h.guest = 'guest@example.com';
    expect((await render({})).initialEmail).toBe('guest@example.com');
  });

  it('carries a safe destination to the sign-in link and refuses an unsafe one', async () => {
    const ok = await render({ redirect: '/checkout' });
    expect(ok.redirectTo).toBe('/checkout');
    expect(ok.signInHref).toBe('/account/sign-in?redirect=%2Fcheckout');
    expect((await render({ redirect: 'https://evil.example' })).redirectTo).toBe('/account');
  });

  it('sends a signed-in visitor on', async () => {
    h.signedIn = true;
    await expect(render({})).rejects.toThrow('NEXT_REDIRECT');
    expect(h.redirect).toHaveBeenCalledWith({ href: '/account', locale: 'en-CA' });
  });
});
