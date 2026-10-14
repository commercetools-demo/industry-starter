// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { branches, settings } from '@/test/shell-fixtures';

class NotFound extends Error {}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => {} }));
// The garage chip belongs to workstream J and has its own tests.
vi.mock('@/components/vehicle/GarageChip', () => ({ GarageChip: () => <span data-testid="garage-chip" /> }));
vi.mock('@/components/vehicle/GarageRoot', () => ({ GarageRoot: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/mau-reseller-north',
  useRouter: () => ({ refresh: () => {} }),
}));
const getShellContext = vi.hoisted(() => vi.fn());
const getNavCategories = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));
vi.mock('@/lib/ct/categories', () => ({ getNavCategories }));
vi.mock('@/lib/session', () => ({ getSession }));

import StoreLayout, { generateMetadata } from './layout';

const ctx = {
  storeId: 'store-1',
  settings,
  retailChannelId: 'r',
  countries: ['DE'],
  branches: branches.map((view) => {
    const { hoursState, pickup, ...branch } = view;
    void hoursState;
    void pickup;
    return branch;
  }),
};
const params = Promise.resolve({ locale: 'en-US', store: 'mau-reseller-north' });

beforeEach(() => {
  getShellContext.mockReset();
  getShellContext.mockResolvedValue(ctx);
  getNavCategories.mockReset();
  getNavCategories.mockResolvedValue([{ id: 'c1', slug: 'brakes', name: 'Brakes' }]);
  getSession.mockReset();
  getSession.mockResolvedValue({ storeKey: 'mau-reseller-north', branchKey: 'mau-br-north-bremen' });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ count: 0 }) }) as Response));
});

describe('Shell carries identity and context: store layout', () => {
  it('renders shell around children', async () => {
    renderWithProviders(await StoreLayout({ children: <p>page body</p>, params }), { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Sold and fulfilled by Küstenwerk Autoteile');
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('page body');
    expect(screen.getByRole('link', { name: 'Brakes' })).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', `#${main.id}`);
  });
  it('the utility bar states the pickup promise of the chosen branch', async () => {
    renderWithProviders(await StoreLayout({ children: null, params }), { locale: 'en-US', messages: enUS });
    expect(screen.getByText(/at Küstenwerk Bremen$/)).toBeInTheDocument();
  });
  it('the chip shows the branch the session chose', async () => {
    renderWithProviders(await StoreLayout({ children: null, params }), { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('button', { name: /Your store/ })).toHaveTextContent('Küstenwerk Bremen, Bremen');
  });
  it('a signed in session shows Account', async () => {
    getSession.mockResolvedValue({ storeKey: 'mau-reseller-north', customerId: 'c1' });
    renderWithProviders(await StoreLayout({ children: null, params }), { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('link', { name: 'Account' })).toBeInTheDocument();
  });
  it('unknown store never reaches layout', async () => {
    getShellContext.mockResolvedValue(null);
    await expect(StoreLayout({ children: null, params })).rejects.toBeInstanceOf(NotFound);
    expect(getNavCategories).not.toHaveBeenCalled();
  });
  it('title template and favicon come from the store settings', async () => {
    getShellContext.mockResolvedValue({ ...ctx, settings: { ...settings, faviconUrl: 'https://cdn.example.test/fav.png' } });
    expect(await generateMetadata({ params })).toEqual({
      title: { default: 'Küstenwerk Autoteile', template: '%s | Küstenwerk Autoteile' },
      icons: { icon: 'https://cdn.example.test/fav.png' },
    });
    getShellContext.mockResolvedValue({ ...ctx, settings });
    expect((await generateMetadata({ params })).icons).toBeUndefined();
    getShellContext.mockResolvedValue(null);
    expect(await generateMetadata({ params })).toEqual({});
  });
});
