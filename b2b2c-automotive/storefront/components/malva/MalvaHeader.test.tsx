// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale, children, ...rest }: { href: string; locale?: string; children: ReactNode }) => (
    <a href={`/${locale ?? 'en-US'}${href === '/' ? '' : href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/categories/brakes',
}));

const drawer = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn(), isOpen: false }));
vi.mock('@/components/malva/FinderDrawerProvider', () => ({ useFinderDrawer: () => drawer }));

import { MalvaFooter } from './MalvaFooter';
import { MalvaHeader } from './MalvaHeader';

const categories = [
  { id: 'c1', slug: 'brakes', name: 'Brakes' },
  { id: 'c2', slug: 'filters', name: 'Filters' },
];

describe('Malva header', () => {
  it('links the wordmark to the Malva home and each category to its listing', () => {
    renderWithProviders(<MalvaHeader categories={categories} />, { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('link', { name: 'Malva home' })).toHaveAttribute('href', '/en-US');
    const nav = screen.getByRole('navigation', { name: 'Categories' });
    expect(within(nav).getByRole('link', { name: 'Brakes' })).toHaveAttribute('href', '/en-US/categories/brakes');
    expect(within(nav).getByRole('link', { name: 'Brakes' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Filters' })).not.toHaveAttribute('aria-current');
  });
  it('shows no cart, no account link and no store chip', () => {
    renderWithProviders(<MalvaHeader categories={categories} />, { locale: 'en-US', messages: enUS });
    expect(screen.queryByRole('link', { name: /cart/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /cart|your store/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /sign in|account/i })).toBeNull();
  });
  it('the Find your reseller button opens the drawer with the button as opener and no product', async () => {
    renderWithProviders(<MalvaHeader categories={categories} />, { locale: 'en-US', messages: enUS });
    const button = screen.getByRole('button', { name: 'Find your reseller' });
    await userEvent.click(button);
    expect(drawer.open).toHaveBeenCalledWith({ opener: button });
  });
  it('the locale switch links to the same page in the other locale and marks the current one', () => {
    renderWithProviders(<MalvaHeader categories={categories} />, { locale: 'en-US', messages: enUS });
    const switchNav = screen.getByRole('navigation', { name: 'Language' });
    expect(within(switchNav).getByRole('link', { name: 'EN' })).toHaveAttribute('aria-current', 'true');
    expect(within(switchNav).getByRole('link', { name: 'DE' })).toHaveAttribute('href', '/de-DE/categories/brakes');
  });
  it('a header without categories still renders (outage)', () => {
    renderWithProviders(<MalvaHeader categories={[]} />, { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('button', { name: 'Find your reseller' })).toBeInTheDocument();
  });
  it('German strings', () => {
    renderWithProviders(<MalvaHeader categories={categories} />, { locale: 'de-DE', messages: deDE });
    expect(screen.getByRole('button', { name: 'Händler finden' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Kategorien' })).toBeInTheDocument();
  });
  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<MalvaHeader categories={categories} />, { locale: 'en-US', messages: enUS });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Malva footer', () => {
  it('renders the Malva statement in both locales and no store content', () => {
    const { unmount } = renderWithProviders(<MalvaFooter />, { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Malva parts, sold by resellers near you.');
    unmount();
    renderWithProviders(<MalvaFooter />, { locale: 'de-DE', messages: deDE });
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Händlern in Ihrer Nähe');
  });
});
