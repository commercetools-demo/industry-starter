// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reseller } from '@/lib/malva-types';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale, children, ...rest }: { href: string; locale?: string; children: ReactNode }) => (
    <a href={`/${locale ?? 'en-US'}${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>) => {
    const Lazy = lazy(loader);
    return (props: Record<string, unknown>) => (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  },
}));
vi.mock('@/components/store-picker/BranchMap', () => ({
  default: ({ branches, center }: { branches: { key: string }[]; center: { lat: number; lng: number } | null }) => (
    <div data-testid="map" data-count={branches.length} data-center={center ? `${center.lat},${center.lng}` : ''} />
  ),
}));

import { ResellerFinder } from './ResellerFinder';

const reseller = (over: Partial<Reseller>): Reseller => ({ key: 'mau-reseller-north', name: 'Küstenwerk', city: 'Hamburg', postalCode: '21079', address: 'Hafenstraße 1', lat: 53.46, lng: 9.98, branches: [], ...over });
const north = reseller({ branches: [{ key: 'b1', name: 'Bremen', city: 'Bremen' }, { key: 'b2', name: 'Hamburg', city: 'Hamburg' }] });
const south = reseller({ key: 'mau-reseller-south', name: 'Südkamm', city: 'München', postalCode: '80331', lat: 48.14, lng: 11.58, branches: [{ key: 'b3', name: 'Augsburg', city: 'Augsburg' }] });

const state = { resellers: [north, south], status: 200, geocode: { results: [] as unknown[], unavailable: true } };
const geolocation = { getCurrentPosition: vi.fn() };

beforeEach(() => {
  state.resellers = [north, south];
  state.status = 200;
  state.geocode = { results: [], unavailable: true };
  geolocation.getCurrentPosition.mockReset();
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.startsWith('/api/resellers')) return new Response(JSON.stringify({ resellers: state.resellers }), { status: state.status });
      return new Response(JSON.stringify(state.geocode), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderFinder = (props: Partial<Parameters<typeof ResellerFinder>[0]> = {}, locale: 'en-US' | 'de-DE' = 'en-US') =>
  renderWithProviders(<ResellerFinder mode="inline" locale={locale} {...props} />, { locale, messages: locale === 'en-US' ? enUS : deDE });

describe('ResellerFinder', () => {
  it('lists the resellers with branches and a Shop link to the reseller home', async () => {
    renderFinder();
    const list = await screen.findByRole('list', { name: 'Resellers' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText(/2 branches · Bremen, Hamburg/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Shop at this reseller: Küstenwerk' })).toHaveAttribute('href', '/en-US/mau-reseller-north');
  });

  it('links to the product at the reseller when a product slug is given', async () => {
    renderFinder({ mode: 'drawer', productSlug: 'vektra-front-brake-pad-mlv-bp-41001' });
    expect(await screen.findByRole('link', { name: /Südkamm/ })).toHaveAttribute('href', '/en-US/mau-reseller-south/p/vektra-front-brake-pad-mlv-bp-41001');
  });

  it('renders no link for a slug or a store key that is not valid', async () => {
    state.resellers = [reseller({ key: 'mau-reseller-north' }), reseller({ key: '../evil', name: 'Evil' })];
    const { unmount } = renderFinder({ productSlug: 'x/../y' });
    await screen.findByRole('list', { name: 'Resellers' });
    expect(screen.queryByRole('link')).toBeNull();
    unmount();
    renderFinder();
    await screen.findByRole('link', { name: /Küstenwerk/ });
    expect(screen.queryByRole('link', { name: /Evil/ })).toBeNull();
    expect(screen.getByText('Evil')).toBeInTheDocument();
  });

  it('filters by city, by postal code prefix and ignoring accents and case', async () => {
    const user = userEvent.setup();
    renderFinder();
    await screen.findByText('Küstenwerk');
    const search = screen.getByRole('searchbox', { name: 'Postal code or city' });
    await user.type(search, 'MUNCHEN');
    expect(screen.queryByText('Küstenwerk')).toBeNull();
    expect(screen.getByText('Südkamm')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, '210');
    expect(screen.getByText('Küstenwerk')).toBeInTheDocument();
    expect(screen.queryByText('Südkamm')).toBeNull();
    await user.clear(search);
    await user.type(search, 'bremen');
    expect(screen.getByText('Küstenwerk')).toBeInTheDocument();
  });

  it('says "No reseller found" when nothing matches', async () => {
    const user = userEvent.setup();
    renderFinder();
    await screen.findByText('Küstenwerk');
    await user.type(screen.getByRole('searchbox'), 'zzzz');
    expect(screen.getByText('No reseller found')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('asks for the location only after a click and sorts by distance', async () => {
    const user = userEvent.setup();
    geolocation.getCurrentPosition.mockImplementation((ok: (p: unknown) => void) => ok({ coords: { latitude: 48.1, longitude: 11.5 } }));
    renderFinder();
    await screen.findByText('Küstenwerk');
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    const names = () => screen.getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent);
    expect(names()).toEqual(['Küstenwerk', 'Südkamm']);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(names()).toEqual(['Südkamm', 'Küstenwerk']));
    expect(screen.getByTestId('map')).toHaveAttribute('data-center', '48.1,11.5');
  });

  it('suggests a postal code when the location is refused and keeps the list usable', async () => {
    const user = userEvent.setup();
    geolocation.getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 1 }));
    renderFinder();
    await screen.findByText('Küstenwerk');
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(await screen.findByText('Location access was refused. Type a postal code or city instead.')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'ham');
    expect(screen.getByText('Küstenwerk')).toBeInTheDocument();
  });

  it('shows a loading state and then an error with retry', async () => {
    state.status = 500;
    const user = userEvent.setup();
    renderFinder();
    expect(screen.getByText('Loading resellers')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('The resellers could not be loaded.');
    state.status = 200;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Küstenwerk')).toBeInTheDocument();
  });

  it('reads German', async () => {
    renderFinder({}, 'de-DE');
    expect(await screen.findByRole('link', { name: 'Bei diesem Händler einkaufen: Küstenwerk' })).toHaveAttribute('href', '/de-DE/mau-reseller-north');
    expect(screen.getByText('2 Filialen · Bremen, Hamburg')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderFinder();
    await screen.findByText('Küstenwerk');
    expect(await axe(container)).toHaveNoViolations();
  });
});
