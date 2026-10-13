// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en-US.json';

const h = vi.hoisted(() => ({ session: {} as { customerId?: string }, path: null as string | null, redirect: vi.fn(), offered: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => h.session }));
vi.mock('next/headers', () => ({ headers: async () => ({ get: (name: string) => (name === 'x-pathname' ? h.path : null) }) }));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => undefined, getTranslations: async () => (key: string) => key }));
vi.mock('@/i18n/routing', () => ({
  redirect: (arg: unknown) => {
    h.redirect(arg);
    throw new Error('NEXT_REDIRECT');
  },
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => '/mau-reseller-north/account',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/ct/account-subscriptions', () => ({ subscriptionsOffered: h.offered }));

import AccountLayout from './layout';

const params = Promise.resolve({ locale: 'en-US', store: 'mau-reseller-north' });

beforeEach(() => {
  h.session = {};
  h.path = '/en-US/mau-reseller-north/account/orders/MA-ABCD2345?x=1';
  h.redirect.mockReset();
  h.offered.mockReset().mockResolvedValue(true);
  delete process.env.SUBSCRIPTIONS_PURCHASE_ENABLED;
});

describe('account layout', () => {
  it('signed out redirects with next', async () => {
    await expect(AccountLayout({ children: <p>inner</p>, params })).rejects.toThrow('NEXT_REDIRECT');
    expect(h.redirect).toHaveBeenCalledWith({ href: `/mau-reseller-north/account/sign-in?next=${encodeURIComponent('/account/orders/MA-ABCD2345?x=1')}`, locale: 'en-US' });
  });
  it('an unexpected path falls back to the account overview', async () => {
    h.path = 'https://evil.example/x';
    await expect(AccountLayout({ children: <p>inner</p>, params })).rejects.toThrow();
    expect(h.redirect.mock.calls[0][0].href).toBe(`/mau-reseller-north/account/sign-in?next=${encodeURIComponent('/account')}`);
  });
  it('signed in renders children inside the shell with the menu', async () => {
    h.session = { customerId: 'c1' };
    const tree = await AccountLayout({ children: <p>inner</p>, params });
    render(
      <NextIntlClientProvider locale="en-US" messages={enMessages}>
        <SWRConfig value={{ provider: () => new Map() }}>{tree}</SWRConfig>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('inner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toBeInTheDocument();
  });
  it('the subscriptions item follows the offer', async () => {
    h.session = { customerId: 'c1' };
    process.env.SUBSCRIPTIONS_PURCHASE_ENABLED = 'false';
    h.offered.mockResolvedValue(false);
    const tree = await AccountLayout({ children: <p>inner</p>, params });
    render(
      <NextIntlClientProvider locale="en-US" messages={enMessages}>
        <SWRConfig value={{ provider: () => new Map() }}>{tree}</SWRConfig>
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Subscriptions' })).not.toBeInTheDocument();
  });
});
