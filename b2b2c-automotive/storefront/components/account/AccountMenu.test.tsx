// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

const nav = vi.hoisted(() => ({ path: '/mau-reseller-north/account/orders', push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => nav.path,
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: nav.refresh }),
}));

import { AccountMenu } from './AccountMenu';

function setup(showSubscriptions = true, locale: 'en-US' | 'de-DE' = 'en-US') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-US' ? enMessages : deMessages}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AccountMenu store="mau-reseller-north" showSubscriptions={showSubscriptions} />
      </SWRConfig>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  nav.path = '/mau-reseller-north/account/orders';
  nav.push.mockReset();
});

describe('AccountMenu', () => {
  it('menu lists the eight items in order', () => {
    setup();
    const links = within(screen.getByRole('navigation', { name: 'Account' })).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Overview', 'Orders', 'Garage', 'Addresses', 'Payment methods', 'Subscriptions', 'Returns', 'Profile']);
    expect(links[1]).toHaveAttribute('href', '/en-US/mau-reseller-north/account/orders');
  });
  it('select replaces menu under 700', async () => {
    setup();
    const nav700 = screen.getByRole('navigation', { name: 'Account' });
    expect(nav700.className).toContain('hidden');
    expect(nav700.className).toContain('min-[43.75rem]:block');
    const select = screen.getByLabelText('Account pages');
    expect(select.parentElement?.parentElement?.className).toContain('min-[43.75rem]:hidden');
    expect(within(select).getAllByRole('option')).toHaveLength(8);
    await userEvent.selectOptions(select, 'garage');
    expect(nav.push).toHaveBeenCalledWith('/mau-reseller-north/account/garage');
  });
  it('current page has aria-current', () => {
    setup();
    const links = within(screen.getByRole('navigation', { name: 'Account' })).getAllByRole('link');
    expect(links.filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent)).toEqual(['Orders']);
    expect(screen.getByLabelText('Account pages')).toHaveValue('orders');
  });
  it('a detail page keeps its section current and overview is exact', () => {
    nav.path = '/mau-reseller-north/account/orders/MA-ABCD2345/return';
    setup();
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });
  it('overview is current on the account root', () => {
    nav.path = '/mau-reseller-north/account';
    setup();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });
  it('subscriptions item shown when purchasable', () => {
    setup(true);
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toBeInTheDocument();
  });
  it('subscriptions item hidden when not purchasable and no recurring orders', () => {
    setup(false);
    expect(screen.queryByRole('link', { name: 'Subscriptions' })).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Account pages')).getAllByRole('option')).toHaveLength(7);
  });
  it('de-DE labels and axe clean', async () => {
    const { container } = setup(true, 'de-DE');
    expect(screen.getByRole('link', { name: 'Zahlungsarten' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
