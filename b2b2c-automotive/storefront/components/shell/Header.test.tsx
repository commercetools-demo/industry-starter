// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorePickerContext } from '@/context/StorePickerContext';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { branchesResponse, settings } from '@/test/shell-fixtures';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/mau-reseller-north',
}));

// The garage chip belongs to workstream J and has its own tests; here only its slot in the header is checked.
vi.mock('@/components/vehicle/GarageChip', () => ({ GarageChip: () => <span data-testid="garage-chip" /> }));

import { Footer } from './Footer';
import { Header } from './Header';
import { UtilityBar } from './UtilityBar';

const answers = vi.hoisted(() => ({ branches: null as unknown, cart: { count: 0 } }));
beforeEach(() => {
  answers.branches = branchesResponse();
  answers.cart = { count: 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.startsWith('/api/cart/summary') ? answers.cart : answers.branches;
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const header = (signedIn = false) => <Header store="mau-reseller-north" settings={settings} signedIn={signedIn} />;

describe('Context visible everywhere: header', () => {
  it('shows store chip with name and city', async () => {
    renderWithProviders(header(), { locale: 'en-US', messages: enUS });
    const chip = await screen.findByRole('button', { name: /Your store/ });
    expect(chip).toHaveTextContent('Küstenwerk Hamburg-Harburg, Hamburg');
    expect(within(chip).getByText('Change')).toBeInTheDocument();
  });
  it('the chip opens the picker', async () => {
    const open = vi.fn();
    renderWithProviders(
      <StorePickerContext.Provider value={{ open, isOpen: false }}>{header()}</StorePickerContext.Provider>,
      { locale: 'en-US', messages: enUS },
    );
    await userEvent.click(await screen.findByRole('button', { name: /Your store/ }));
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('hides the store chip for a single branch', async () => {
    answers.branches = branchesResponse({ single: true, branches: branchesResponse().branches.slice(0, 1) });
    renderWithProviders(header(), { locale: 'en-US', messages: enUS });
    await screen.findByRole('link', { name: /Cart/ });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/store-context/branches'), expect.anything()));
    expect(screen.queryByText('Your store')).not.toBeInTheDocument();
  });
  it('has the search, sign in and cart in order with the garage slot between search and sign in', async () => {
    renderWithProviders(header(), { locale: 'en-US', messages: enUS });
    const search = screen.getByRole('searchbox', { name: 'Search' });
    expect(search).toHaveAttribute('placeholder', 'Search parts, brands, part numbers');
    expect(search).toHaveAttribute('name', 'q');
    expect(screen.getByRole('search')).toHaveAttribute('action', '/en-US/mau-reseller-north/search');
    const order = [screen.getByRole('link', { name: 'Küstenwerk Autoteile' }), search, screen.getByRole('link', { name: 'Sign in' }), screen.getByRole('link', { name: /Cart/ })];
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector('[data-slot="garage"] [data-testid="garage-chip"]')).toBeInTheDocument();
    expect(search.compareDocumentPosition(screen.getByTestId('garage-chip')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('garage-chip').compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('a signed in shopper sees Account', () => {
    renderWithProviders(header(true), { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account');
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });
  it('the wordmark links to the store home and shows the store name without a logo', () => {
    renderWithProviders(header(), { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('link', { name: 'Küstenwerk Autoteile' })).toHaveAttribute('href', '/en-US/mau-reseller-north');
  });
  it('the wordmark logo has the store name as alt text', () => {
    renderWithProviders(<Header store="mau-reseller-north" settings={{ ...settings, logoUrl: 'https://cdn.example.test/logo.png' }} signedIn={false} />, { locale: 'en-US', messages: enUS });
    expect(screen.getByAltText('Küstenwerk Autoteile')).toBeInTheDocument();
  });
  it('has no axe violations', async () => {
    const { container } = renderWithProviders(header(), { locale: 'en-US', messages: enUS });
    await screen.findByRole('button', { name: /Your store/ });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Cart count reflects quantity: header', () => {
  it('cart control reads Cart · 3 for 2 plus 1 units', async () => {
    answers.cart = { count: 3 }; // the summary route sums quantities: 2 + 1
    renderWithProviders(header(), { locale: 'en-US', messages: enUS });
    expect(await screen.findByRole('link', { name: 'Cart · 3' })).toHaveAttribute('href', '/en-US/mau-reseller-north/cart');
  });
  it('an empty or failing summary reads Cart · 0', async () => {
    renderWithProviders(header(), { locale: 'de-DE', messages: deDE });
    expect(await screen.findByRole('link', { name: 'Warenkorb · 0' })).toBeInTheDocument();
  });
});

describe('Threshold follows the shipping rule: utility bar', () => {
  it('threshold in the bar equals the store setting', () => {
    renderWithProviders(<UtilityBar store="mau-reseller-north" settings={settings} pickup={{ option: 'today', branchName: 'Hamburg' }} />, { locale: 'de-DE', messages: deDE });
    expect(screen.getByText(/Kostenloser Versand ab 99,00\s€/)).toBeInTheDocument();
    expect(screen.getByText('Deutschland (EUR €)')).toBeInTheDocument();
    expect(screen.getByText('Abholung heute in Hamburg')).toBeInTheDocument();
  });
  it('omits Help when no helpUrl and Track when no trackUrl', () => {
    renderWithProviders(<UtilityBar store="s" settings={{ ...settings, helpUrl: undefined }} />, { locale: 'en-US', messages: enUS });
    expect(screen.queryByRole('link', { name: 'Help' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track order' })).toHaveAttribute('href', 'https://track.example.test');
  });
  it('the threshold is not stated on a page of another currency', () => {
    renderWithProviders(<UtilityBar store="s" settings={settings} />, { locale: 'en-US', messages: enUS });
    expect(screen.queryByText(/Free shipping/)).not.toBeInTheDocument();
    expect(screen.getByText('United States (USD $)')).toBeInTheDocument();
  });
  it('pickup promises per option', () => {
    const { rerender } = renderWithProviders(<UtilityBar store="s" settings={settings} pickup={{ option: 'tomorrow', branchName: 'Bremen' }} />, { locale: 'en-US', messages: enUS });
    expect(screen.getByText('Pickup tomorrow at Bremen')).toBeInTheDocument();
    rerender(<UtilityBar store="s" settings={settings} pickup={{ option: 'ship-to-store', branchName: 'Austin' }} />);
    expect(screen.getByText('Ship to store: Austin')).toBeInTheDocument();
  });
  it('store relative help links keep the store path', () => {
    renderWithProviders(<UtilityBar store="mau-reseller-north" settings={{ ...settings, helpUrl: '/help' }} />, { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/en-US/mau-reseller-north/help');
  });
  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<UtilityBar store="s" settings={settings} pickup={{ option: 'today', branchName: 'Hamburg' }} />, { locale: 'de-DE', messages: deDE });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Footer', () => {
  it('footer states the seller and the disclaimer', () => {
    renderWithProviders(<Footer store="mau-reseller-north" storeName="Küstenwerk Autoteile" />, { locale: 'en-US', messages: enUS });
    expect(screen.getByText('Sold and fulfilled by Küstenwerk Autoteile')).toBeInTheDocument();
    expect(screen.getByText(enUS.shell.footer.fitmentDisclaimer)).toBeInTheDocument();
    for (const name of ['Terms', 'Privacy', 'Returns']) expect(screen.getByRole('link', { name })).toBeInTheDocument();
  });
  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<Footer store="s" storeName="X" />, { locale: 'de-DE', messages: deDE });
    expect(await axe(container)).toHaveNoViolations();
  });
});
