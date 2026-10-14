/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import type { Viewer } from '@/lib/portal/types';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/catalog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

import { Shell } from './Shell';

const viewer = (roles: Viewer['roles'], extra: Partial<Viewer> = {}): Viewer => ({
  customerId: 'cust-1',
  name: 'Alex Admin',
  email: 'alex@example.com',
  roles,
  ctPermissions: [],
  businessUnitKey: 'bu-1',
  businessUnitName: 'Test Garage Nord',
  storeKey: 'store-1',
  storeName: 'DACH Online',
  ...extra,
});

const ADMIN_LINKS = [
  'Dashboard', 'Catalog & pricing', 'Bundles', 'Product import', 'Store & channels', 'Content', 'Marketing', 'Email', 'Customers',
  'Subscriptions', 'Returns', 'Reviews', 'Brand partnership', 'Company & team', 'Account settings',
];
const BUYER_LINKS = ['Dashboard', 'Catalog & pricing', 'Returns', 'Reviews', 'Company & team', 'Account settings'];

const fetchMock = vi.fn(async () => Response.json({ notifications: [], units: [] }));
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

const renderShell = (v: Viewer, locale: 'en-US' | 'de-DE' = 'en-US') =>
  renderWithProviders(<Shell viewer={v} copilot><p>page body</p></Shell>, { locale, messages: locale === 'en-US' ? en : de });
const navLinks = () => within(screen.getByRole('navigation', { name: 'Main navigation' })).getAllByRole('link').map((a) => a.textContent);

describe('Shell role matrix', () => {
  it('renders the Admin navigation of the role matrix', () => {
    renderShell(viewer(['admin']));
    expect(navLinks()).toEqual(ADMIN_LINKS);
  });

  it('renders the Buyer navigation of the role matrix', () => {
    renderShell(viewer(['buyer'], { name: 'Bea Buyer' }));
    expect(navLinks()).toEqual(BUYER_LINKS);
    for (const hidden of ['Brand partnership', 'Bundles', 'Email', 'Content', 'Marketing', 'Store & channels', 'Product import', 'Customers', 'Subscriptions']) {
      expect(screen.queryByRole('link', { name: hidden })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Shop from Malva|Roles & permissions|Approvals/)).not.toBeInTheDocument();
  });

  it('marks the active item and shows the switcher label', () => {
    renderShell(viewer(['admin']));
    expect(screen.getByRole('link', { name: 'Catalog & pricing' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('switcher')).toHaveTextContent('Test Garage Nord · DACH Online');
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('shows the navigation in German', () => {
    renderShell(viewer(['buyer']), 'de-DE');
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Katalog & Preise' })).toBeInTheDocument();
  });

  it('shows the customer-session banner only while acting as a customer', async () => {
    const { unmount } = renderShell(viewer(['admin']));
    expect(screen.queryByTestId('customer-session-banner')).not.toBeInTheDocument();
    unmount();
    renderShell(viewer(['admin'], { actingAs: 'Test Driver' }));
    expect(screen.getByTestId('customer-session-banner')).toHaveTextContent('You are shopping as Test Driver. Orders are placed on their behalf.');
    expect(screen.getByRole('button', { name: 'Exit customer session' })).toBeInTheDocument();
  });
});

describe('Shell overlays', () => {
  it('escape closes the top-most overlay only', async () => {
    const user = userEvent.setup();
    renderShell(viewer(['admin']));
    await user.click(screen.getByTestId('bell'));
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.getByTestId('bell')).toHaveFocus();
  });

  it('the palette lists only the pages of the role and opens with Ctrl+K', async () => {
    const user = userEvent.setup();
    renderShell(viewer(['buyer']));
    await user.keyboard('{Control>}k{/Control}');
    const options = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(options.join(' ')).toContain('Catalog & pricing');
    expect(options.join(' ')).not.toContain('Store & channels');
  });

  it('an empty notification panel says the user is all caught up', async () => {
    const user = userEvent.setup();
    renderShell(viewer(['admin']));
    await user.click(screen.getByTestId('bell'));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
  });

  it('has no Copilot launcher unless the shell is told the copilot is on', () => {
    renderWithProviders(<Shell viewer={viewer(['admin'])}><p>page body</p></Shell>, { locale: 'en-US', messages: en });
    expect(screen.queryByTestId('copilot-launcher')).not.toBeInTheDocument();
  });

  it('the Copilot launcher opens the panel and Escape closes it', async () => {
    const user = userEvent.setup();
    renderShell(viewer(['admin']));
    await user.click(screen.getByTestId('copilot-launcher'));
    expect(screen.getByRole('dialog', { name: 'Store copilot' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Store copilot' })).not.toBeInTheDocument();
  });

  it('the drawer opens from the menu button, traps focus, closes on Escape and returns focus', async () => {
    const user = userEvent.setup();
    renderShell(viewer(['admin']));
    const menu = screen.getByRole('button', { name: 'Open menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    menu.focus();
    await user.click(menu);
    const drawer = screen.getByRole('dialog', { name: 'Open menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Open menu' })).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });
});
