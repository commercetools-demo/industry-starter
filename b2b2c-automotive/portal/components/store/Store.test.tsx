// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Store & channels screens (workstream U-05, U-06): role matrix (only an Admin writes), branches, branch stock and price, channels,
// share links with QR, the theme tab (save toast, reset dialog) and the preview.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import de from '@/messages/de-DE.json';
import { renderWithProviders } from '@/test/render';

let pathname = '/store/settings';
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('./LazyBranchMap', () => ({ LazyBranchMap: ({ label, points }: { label: string; points: unknown[] }) => <div role="region" aria-label={label} data-pins={points.length} /> }));
vi.mock('@/components/contentools/ContentoolsWrapper', () => ({ ContentoolsWrapper: () => <div data-testid="manager" /> }));

import { ThemeTab } from '@/components/portal/ThemeTab';
import { StorefrontPreview } from '@/components/portal/StorefrontPreview';
import { BranchesPanel, hoursSummary } from './BranchesPanel';
import { BranchStockDrawer, parsePriceCent } from './BranchStockDrawer';
import { ChannelsTable } from './ChannelsTable';
import { SettingsForm } from './SettingsForm';
import { SharePanel } from './SharePanel';
import { activeStoreTab, StoreTabs } from './StoreTabs';
import { localName } from './local-name';

const viewer = (roles: Viewer['roles']): Viewer => ({
  customerId: 'cust-1',
  name: 'Anna Test',
  email: 'anna@example.com',
  roles,
  ctPermissions: [],
  businessUnitKey: 'bu-1',
  businessUnitName: 'Test Garage Nord',
  storeKey: 'store-1',
  storeName: 'Test Store',
});

const BRANCH = {
  key: 'mau-br-test-wandsbek',
  name: { 'de-DE': 'Wandsbek', 'en-US': 'Wandsbek EN' },
  address: { streetName: 'Hauptstrasse', streetNumber: '1', postalCode: '22041', city: 'Hamburg', country: 'DE' },
  geoLocation: { lat: 53.57, lng: 10.07 },
  openingHours: { mon: ['08:00', '18:00'], tue: ['08:00', '18:00'] },
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
  phone: '+49 40 123',
};
const STOCK = {
  rows: [
    { sku: 'SKU-1', name: { 'de-DE': 'Bremsscheibe', 'en-US': 'Brake disc' }, availableQuantity: 5, priceCent: null },
    { sku: 'SKU-2', name: { 'de-DE': 'Filter', 'en-US': 'Filter' }, availableQuantity: null, priceCent: 1250 },
  ],
  total: 2,
  offset: 0,
  limit: 50,
  currency: 'EUR',
};
const CHANNELS = {
  rows: [
    { id: 'web', label: 'Web', status: 'Live', orders: 4, revenue: { centAmount: 40000, currencyCode: 'EUR', fractionDigits: 2 }, sharePercent: 80, indicative: true },
    { id: 'instagram', label: 'Instagram', status: 'Live', orders: 1, revenue: { centAmount: 10000, currencyCode: 'EUR', fractionDigits: 2 }, sharePercent: 20, indicative: false },
    { id: 'tiktok', label: 'TikTok', status: 'Demo', orders: 9, revenue: { centAmount: 90000, currencyCode: 'EUR', fractionDigits: 2 }, sharePercent: 0, indicative: true },
  ],
  truncated: false,
  currency: 'EUR',
  days: 30,
};
const SETTINGS = {
  key: 'store-1',
  name: { 'de-DE': 'Shop Nord', 'en-US': 'Shop North' },
  location: { addressLine: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg', countryCode: 'DE', latitude: 53.46, longitude: 9.98 },
  address: 'https://shop.example.test/de-DE/store-1',
  currency: 'EUR',
  defaultCountry: 'DE',
};
const PAGES = {
  pages: [
    { id: 'home', url: 'https://shop.example.test/de-DE/store-1', available: true },
    { id: 'listing', url: 'https://shop.example.test/de-DE/store-1/parts', available: true },
    { id: 'product', url: null, available: false },
    { id: 'cart', url: 'https://shop.example.test/de-DE/store-1/cart', available: false },
    { id: 'checkout', url: 'https://shop.example.test/de-DE/store-1/checkout', available: false },
  ],
};

const calls: { url: string; method: string; body: unknown }[] = [];
const fetchMock = vi.fn();
beforeEach(() => {
  pathname = '/store/settings';
  calls.length = 0;
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body });
    const path = url.split('?')[0];
    if (path === '/api/seller/store/branches' && method === 'GET') return Response.json({ branches: [BRANCH] });
    if (path.endsWith('/stock') && method === 'GET') return Response.json(STOCK);
    if (path.includes('/stock/') && method === 'PUT') return Response.json({ row: { ...STOCK.rows[0], priceCent: 990 } });
    if (path.startsWith('/api/seller/store/branches/') && method === 'DELETE') return Response.json({ status: 'removed' });
    if (path === '/api/seller/store/channels') return Response.json(CHANNELS);
    if (path === '/api/seller/store/settings' && method === 'GET') return Response.json(SETTINGS);
    if (path === '/api/seller/store/settings' && method === 'PUT') return Response.json(SETTINGS);
    if (path === '/api/seller/store/link-in-bio-status') return Response.json({ published: false });
    if (path === '/api/store/preview-pages') return Response.json(PAGES);
    if (path === '/api/seller/store/theme' && method === 'DELETE') return Response.json({ status: 'deleted' });
    return Response.json({});
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const render = (ui: ReactElement, roles: Viewer['roles'] = ['admin'], messages: typeof en | typeof de = en) =>
  renderWithProviders(
    <ViewerProvider viewer={viewer(roles)}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { messages, locale: messages === en ? 'en-US' : 'de-DE' },
  );

describe('pure helpers', () => {
  it('parsePriceCent accepts comma and dot, empty clears, anything else is NaN', () => {
    expect(parsePriceCent('12,50')).toBe(1250);
    expect(parsePriceCent('9.9')).toBe(990);
    expect(parsePriceCent(' ')).toBeNull();
    for (const bad of ['0', '-1', '1.234', 'abc', '1,2,3']) expect(parsePriceCent(bad)).toBeNaN();
  });
  it('hoursSummary and localName', () => {
    expect(hoursSummary({})).toBeNull();
    expect(hoursSummary({ mon: ['08:00', '18:00'], fri: ['09:00', '17:00'] })).toEqual({ days: 2, from: '08:00', to: '18:00' });
    expect(localName({ 'de-DE': 'A', 'en-US': 'B' }, 'en-US', 'k')).toBe('B');
    expect(localName({ 'en-US': 'B' }, 'de-DE', 'k')).toBe('B');
    expect(localName(undefined, 'de-DE', 'k')).toBe('k');
  });
  it('the Theme tab owns every path below /store/theme', () => {
    expect(activeStoreTab('/store/theme/x/y')).toBe('theme');
    expect(activeStoreTab('/store/channels')).toBe('channels');
    expect(activeStoreTab('/store')).toBe('settings');
  });
});

describe('Store tabs', () => {
  it('shows the four tabs and marks the current one', () => {
    pathname = '/store/share';
    render(<StoreTabs />);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Settings', 'Channels', 'Share', 'Theme']);
    expect(screen.getByRole('link', { name: 'Share' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Settings', () => {
  it('shows the read-only storefront address with the Managed by Malva caption and saves name and location', async () => {
    render(<SettingsForm />);
    const address = (await screen.findByLabelText('Storefront address')) as HTMLInputElement;
    expect(address).toHaveAttribute('readonly');
    expect(address.value).toBe(SETTINGS.address);
    expect(screen.getAllByText('Managed by Malva').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Map of the store location' })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Store name (de-DE)'));
    await userEvent.type(screen.getByLabelText('Store name (de-DE)'), 'Shop Nord 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.url === '/api/seller/store/settings')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT') as { body: { storeKey: string; name: Record<string, string>; location: Record<string, unknown> } };
    expect(put.body.storeKey).toBe('store-1');
    expect(put.body.name['de-DE']).toBe('Shop Nord 2');
    expect(put.body.location.latitude).toBe(53.46);
    expect(await screen.findByText('Location saved')).toBeInTheDocument();
  });

  it('refuses a name that is too short without calling the server', async () => {
    render(<SettingsForm />);
    await userEvent.clear(await screen.findByLabelText('Store name (en-US)'));
    await userEvent.type(screen.getByLabelText('Store name (en-US)'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('2 to 80');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('a Buyer sees the form disabled', async () => {
    render(<SettingsForm />, ['buyer']);
    expect(await screen.findByLabelText('Store name (de-DE)')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('Branches', () => {
  it('lists branches with a map and the actions an Admin needs', async () => {
    render(<BranchesPanel timezone="Europe/Berlin" />);
    expect(await screen.findByText('Wandsbek EN')).toBeInTheDocument();
    expect(screen.getByText('Same day')).toBeInTheDocument();
    expect(screen.getByText('2 days open, 08:00 to 18:00')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Map of branches' })).toHaveAttribute('data-pins', '1');
    expect(screen.getByRole('button', { name: 'Add branch' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Stock and prices of Wandsbek EN' })).toBeEnabled();
  });

  it('a Buyer cannot add, edit, remove or edit stock', async () => {
    render(<BranchesPanel timezone="Europe/Berlin" />, ['buyer']);
    expect(await screen.findByText('Wandsbek EN')).toBeInTheDocument();
    for (const name of ['Add branch', 'Edit Wandsbek EN', 'Remove Wandsbek EN', 'Stock and prices of Wandsbek EN']) expect(screen.getByRole('button', { name })).toBeDisabled();
    expect(screen.getByText('Only an administrator can change branches.')).toBeInTheDocument();
  });

  it('removing asks for confirmation and then calls DELETE with the store key', async () => {
    render(<BranchesPanel timezone="Europe/Berlin" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Wandsbek EN' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove Wandsbek EN?' });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove branch' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del?.url).toBe('/api/seller/store/branches/mau-br-test-wandsbek?storeKey=store-1');
  });

  it('Add branch opens the drawer with the hours grid and validates before calling the server', async () => {
    render(<BranchesPanel timezone="Europe/Berlin" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add branch' }));
    const drawer = screen.getByRole('dialog', { name: 'Add branch' });
    expect(within(drawer).getByLabelText('Monday opens')).toHaveValue('08:00');
    expect(within(drawer).getByRole('region', { name: 'Map for the branch position' })).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save branch' }));
    expect(await within(drawer).findByRole('alert')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('Branch stock and price', () => {
  it('saves a branch price in cents and shows the empty price as the store price', async () => {
    render(<BranchStockDrawer branch={BRANCH as never} onClose={() => {}} />);
    expect(await screen.findByText('Brake disc')).toBeInTheDocument();
    expect(screen.getByLabelText('Branch price of SKU-1')).toHaveAttribute('placeholder', 'Store price applies');
    expect(screen.getByLabelText('Branch price of SKU-2')).toHaveValue('12.50');
    const save = screen.getAllByRole('button', { name: 'Save' })[0];
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Branch price of SKU-1'), '9,90');
    await userEvent.click(save);
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT') as { url: string; body: unknown };
    expect(put.url).toBe('/api/seller/store/branches/mau-br-test-wandsbek/stock/SKU-1');
    expect(put.body).toEqual({ storeKey: 'store-1', priceCent: 990 });
  });

  it('refuses a bad price and a negative stock without calling the server', async () => {
    render(<BranchStockDrawer branch={BRANCH as never} onClose={() => {}} />);
    await screen.findByText('Brake disc');
    await userEvent.type(screen.getByLabelText('Branch price of SKU-1'), '0');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    expect(await screen.findByText(/greater than 0/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Branch price of SKU-1'));
    await userEvent.clear(screen.getByLabelText('Stock of SKU-1'));
    await userEvent.type(screen.getByLabelText('Stock of SKU-1'), '-3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    expect(await screen.findByText(/whole number from 0 to 100000/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});

describe('Channels', () => {
  it('shows live and demo rows, the demo chip and the attribution note', async () => {
    render(<ChannelsTable />);
    expect(await screen.findByRole('row', { name: /Instagram/ })).toBeInTheDocument();
    const tiktok = screen.getByRole('row', { name: /TikTok/ });
    expect(within(tiktok).getByText('Demo')).toBeInTheDocument();
    expect(within(tiktok).getByText('Demo data')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Web/ })).getByText('80%')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Web/ })).getByText('(indicative)')).toBeInTheDocument();
    expect(screen.getByText("Attribution comes from the order's sales-channel field and is indicative where absent.")).toBeInTheDocument();
  });
});

describe('Share links', () => {
  it('shows an attributed link and a QR image (data URL) per channel and copies the link', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<SharePanel origin="https://shop.example.test" />);
    const input = (await screen.findAllByLabelText('Storefront link'))[1] as HTMLInputElement;
    expect(input.value).toBe('https://shop.example.test/en-US/store-1?ch=instagram');
    const qr = await screen.findByAltText('QR code of the Instagram link');
    await waitFor(() => expect(qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml/));
    await userEvent.click(screen.getByRole('button', { name: 'Copy the storefront link for Instagram' }));
    expect(writeText).toHaveBeenCalledWith('https://shop.example.test/en-US/store-1?ch=instagram');
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(screen.getAllByText(/slug \/link-in-bio/).length).toBeGreaterThan(0);
  });
});

describe('Storefront preview', () => {
  it('disables pages the storefront does not serve and names the reason', async () => {
    render(<StorefrontPreview reloadKey={0} />);
    const home = await screen.findByRole('tab', { name: 'Home' });
    expect(home).toBeEnabled();
    expect(screen.getByRole('tab', { name: 'Cart' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Cart' })).toHaveAttribute('title', 'Storefront page not available yet');
    const frame = await screen.findByTitle('Storefront preview: Home');
    expect(frame).toHaveAttribute('src', PAGES.pages[0].url as string);
  });

  it('the device toggle switches to a 375 wide frame and Refresh remounts the frame', async () => {
    render(<StorefrontPreview reloadKey={0} />);
    const first = await screen.findByTitle('Storefront preview: Home');
    await userEvent.click(screen.getByRole('button', { name: 'Phone' }));
    expect(screen.getByTitle('Storefront preview: Home')).toHaveStyle({ width: '375px' });
    const before = screen.getByTitle('Storefront preview: Home');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh preview' }));
    await waitFor(() => expect(screen.getByTitle('Storefront preview: Home')).not.toBe(before));
    expect(first).toBeDefined();
  });
});

describe('Theme tab', () => {
  const props = { locale: 'en-US', storeKey: 'store-1', connected: true, projectKey: 'p', parentUrl: '/en-US/store/theme', host: 'shop.example.test', cacheSeconds: 60 };

  it('a successful theme save shows the toast with the host and the cache window', async () => {
    render(<ThemeTab {...props} />);
    expect(screen.getByTestId('manager')).toBeInTheDocument();
    await act(async () => {
      await window.fetch('/api/contentools/service/store-1/configuration/theme', { method: 'PUT', body: '{}' });
    });
    expect(await screen.findByText('Saved. shop.example.test will show the change within 60 seconds.')).toBeInTheDocument();
  });

  it('Reset to Malva default asks first, then deletes the theme of the session store', async () => {
    render(<ThemeTab {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset to Malva default' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset to Malva default?' });
    expect(within(dialog).getByText('This deletes your theme. Your storefront will use the Malva default after the cache window.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete my theme' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/seller/store/theme?storeKey=store-1')).toBe(true));
    expect(await screen.findByText(/Theme deleted/)).toBeInTheDocument();
  });

  it('is disabled until Contentools is connected', () => {
    render(<ThemeTab {...props} connected={false} />);
    expect(screen.getByRole('button', { name: 'Reset to Malva default' })).toBeDisabled();
  });
});

describe('German', () => {
  it('renders the branches panel in de-DE', async () => {
    render(<BranchesPanel timezone="Europe/Berlin" />, ['admin'], de);
    expect(await screen.findByText('Wandsbek')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filiale hinzufügen' })).toBeEnabled();
  });
});
