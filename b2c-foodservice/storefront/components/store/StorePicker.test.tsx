import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import type { OpeningHours, SkuAvailability, Store } from '@/lib/types';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import StorePicker from '@/components/store/StorePicker';
import { useCollectionStore } from '@/hooks/useCollectionStore';

const OPEN_ALL: OpeningHours = {
  mon: { open: '07:00', close: '18:00' }, tue: { open: '07:00', close: '18:00' }, wed: { open: '07:00', close: '18:00' },
  thu: { open: '07:00', close: '18:00' }, fri: { open: '07:00', close: '18:00' }, sat: { open: '07:00', close: '18:00' },
  sun: { open: '07:00', close: '18:00' },
};
const store = (key: string, name: string, postalCode: string, lat: number, lng: number): Store => ({
  id: key, key, name, addressLine: `${name} Street 1`, city: 'New York', postalCode, country: 'US',
  hours: OPEN_ALL, timeZone: 'America/New_York', collectionMinutes: 15, geo: { lat, lng },
});
const SOHO = store('mcf-store-nyc-soho', 'Malva SoHo', '10012', 40.7233, -74.003);
const BROOKLYN = store('mcf-store-nyc-brooklyn', 'Malva Brooklyn', '11201', 40.6782, -73.9442);
const ASTORIA = store('mcf-store-nyc-astoria', 'Malva Astoria', '11102', 40.7644, -73.9235);
const STORES = [SOHO, BROOKLYN, ASTORIA];

const fallback = (selectedKey: string | null = null) => ({
  [unstable_serialize(keyChannels('US'))]: { stores: STORES, selectedKey },
});

function Opener({ sku }: { sku?: string }) {
  const { open, preferShip } = useCollectionStore();
  return (
    <>
      <button onClick={() => (sku ? open({ sku }) : open())}>open picker</button>
      <p data-testid="prefer-ship">{String(preferShip)}</p>
    </>
  );
}

const AVAILABILITY: SkuAvailability = {
  sku: 'POD-1', ship: 'in',
  stores: [
    { storeKey: SOHO.key, state: 'in', quantity: 20 },
    { storeKey: BROOKLYN.key, state: 'low', quantity: 3 },
    { storeKey: ASTORIA.key, state: 'out', quantity: 0 },
  ],
};

function setup({ sku, selectedKey = null, routes = {} }: { sku?: string; selectedKey?: string | null; routes?: Parameters<typeof stubFetch>[0] } = {}) {
  const fetchStub = stubFetch({
    '/api/availability': () => AVAILABILITY,
    '/api/session/store': () => ({ storeKey: 'x' }),
    ...routes,
  });
  renderShell(
    <>
      <Opener sku={sku} />
      <StorePicker />
    </>,
    { fallback: fallback(selectedKey) },
  );
  return fetchStub;
}
const dialog = () => screen.getByRole('dialog', { hidden: true });
const openPicker = () => userEvent.click(screen.getByRole('button', { name: 'open picker' }));

beforeEach(() => {
  // A Wednesday in New York, so "Open today" is deterministic.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T16:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('StorePicker', () => {
  it('Opened from the header shows address and hours only and makes no availability call', async () => {
    const { calls } = setup();
    expect(dialog()).toHaveAttribute('aria-hidden', 'true');
    await openPicker();
    expect(dialog()).toHaveAttribute('aria-hidden', 'false');
    expect(within(dialog()).getByRole('heading', { name: 'Choose your store' })).toBeInTheDocument();
    expect(within(dialog()).getAllByRole('radio')).toHaveLength(3);
    expect(within(dialog()).getByText('Malva SoHo Street 1, New York')).toBeInTheDocument();
    expect(within(dialog()).getAllByText('Open today 07:00–18:00')).toHaveLength(3);
    expect(within(dialog()).queryByText(/stock for this item|Unavailable for this item/)).toBeNull();
    expect(calls.filter((c) => c.url.startsWith('/api/availability'))).toHaveLength(0);
  });

  it('Opened from a product shows an availability line per row', async () => {
    const { calls } = setup({ sku: 'POD-1' });
    await openPicker();
    expect(await within(dialog()).findByText('In stock for this item')).toBeInTheDocument();
    expect(within(dialog()).getByText('Low stock for this item')).toBeInTheDocument();
    expect(within(dialog()).getByText('Unavailable for this item')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.startsWith('/api/availability'))).toHaveLength(1);
    expect(calls.find((c) => c.url.startsWith('/api/availability'))?.url).toBe('/api/availability?sku=POD-1');
    // An unavailable store is still selectable.
    expect(within(dialog()).getByRole('radio', { name: /Malva Astoria/ })).toBeEnabled();
  });

  it('shows a skeleton line while availability loads', async () => {
    setup({ sku: 'POD-1', routes: { '/api/availability': () => new Promise<never>(() => {}) as never } });
    await openPicker();
    expect(within(dialog()).getAllByRole('status', { name: 'Checking stock' })).toHaveLength(3);
  });

  it('Persistence preselects the stored store', async () => {
    setup({ selectedKey: BROOKLYN.key });
    await openPicker();
    expect(within(dialog()).getByRole('radio', { name: /Malva Brooklyn/ })).toBeChecked();
    expect(within(dialog()).getByRole('radio', { name: /Malva SoHo/ })).not.toBeChecked();
  });

  it('Selecting a row persists and closes', async () => {
    const { calls } = setup();
    await openPicker();
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Malva Brooklyn/ }));
    await waitFor(() => expect(dialog()).toHaveAttribute('aria-hidden', 'true'));
    const put = calls.find((c) => c.url === '/api/session/store');
    expect(put?.init?.method).toBe('PUT');
    expect(JSON.parse(String(put?.init?.body))).toEqual({ storeKey: BROOKLYN.key });
    expect(screen.getByRole('status')).toHaveTextContent('Collecting from Malva Brooklyn');
  });

  it('a failed save keeps the picker open, rolls back and says so', async () => {
    setup({
      selectedKey: SOHO.key,
      routes: { '/api/session/store': () => Response.json({ error: { code: 'internal_error', message: 'x' } }, { status: 500 }) },
    });
    await openPicker();
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Malva Brooklyn/ }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('We could not save your store');
    expect(dialog()).toHaveAttribute('aria-hidden', 'false');
    await waitFor(() => expect(within(dialog()).getByRole('radio', { name: /Malva SoHo/ })).toBeChecked());
  });

  it('Store search by postcode sorts by distance (nearest first, with a real position)', async () => {
    setup();
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 40.68, longitude: -73.95 } }) },
    });
    await openPicker();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Use my location' }));
    const radios = await within(dialog()).findAllByRole('radio');
    expect(radios[0]).toHaveAccessibleName(/Malva Brooklyn/);
    expect(within(dialog()).getByText('Nearest')).toBeInTheDocument();
    expect(within(dialog()).getByText(/Malva Brooklyn Street 1, New York · 0\.\d mi/)).toBeInTheDocument();
  });

  it('a postcode prefix narrows the list', async () => {
    setup();
    await openPicker();
    await userEvent.type(within(dialog()).getByRole('searchbox', { name: 'Search stores' }), '11');
    await waitFor(() => expect(within(dialog()).getAllByRole('radio')).toHaveLength(2));
    expect(within(dialog()).queryByRole('radio', { name: /SoHo/ })).toBeNull();
    expect(within(dialog()).getByText('2 stores')).toBeInTheDocument();
  });

  it('without origin no distance is shown', async () => {
    setup();
    await openPicker();
    await userEvent.type(within(dialog()).getByRole('searchbox', { name: 'Search stores' }), 'Brook');
    await waitFor(() => expect(within(dialog()).getAllByRole('radio')).toHaveLength(1));
    expect(within(dialog()).queryByText(/ mi\b/)).toBeNull();
    expect(within(dialog()).queryByText('Nearest')).toBeNull();
  });

  it('No match offers shipping instead', async () => {
    setup({ sku: 'POD-1' });
    await openPicker();
    await userEvent.type(within(dialog()).getByRole('searchbox', { name: 'Search stores' }), 'Zzzz');
    expect(await within(dialog()).findByText('No stores near Zzzz.')).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Ship to me instead' }));
    expect(dialog()).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('prefer-ship')).toHaveTextContent('true');
  });

  it('No match from the header does not set the ship preference and never clears the store', async () => {
    const { calls } = setup({ selectedKey: SOHO.key });
    await openPicker();
    await userEvent.type(within(dialog()).getByRole('searchbox', { name: 'Search stores' }), 'Zzzz');
    await userEvent.click(await within(dialog()).findByRole('button', { name: 'Ship to me instead' }));
    expect(screen.getByTestId('prefer-ship')).toHaveTextContent('false');
    expect(calls.some((c) => c.url === '/api/session/store')).toBe(false);
  });

  it('geolocation denied shows the hint', async () => {
    setup();
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition: (_ok: unknown, fail: () => void) => fail() },
    });
    await openPicker();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Use my location' }));
    expect(await within(dialog()).findByText('Location is off, search by town or postcode')).toBeInTheDocument();
    expect(within(dialog()).getAllByRole('radio')).toHaveLength(3);
  });

  it('radio rows are keyboard operable', async () => {
    const { calls } = setup();
    await openPicker();
    within(dialog()).getAllByRole('radio')[0].focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(calls.some((c) => c.url === '/api/session/store')).toBe(true));
    const body = JSON.parse(String(calls.find((c) => c.url === '/api/session/store')?.init?.body));
    expect(typeof body.storeKey).toBe('string');
  });

  it('focus starts in the search field and Escape closes', async () => {
    setup();
    await openPicker();
    await waitFor(() => expect(within(dialog()).getByRole('searchbox')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(dialog()).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing in the Canada market', () => {
    stubFetch({});
    renderShell(<StorePicker />, { locale: 'en-CA' });
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('channel failure shows the error with Retry', async () => {
    stubFetch({ '/api/channels': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }) });
    renderShell(
      <>
        <Opener />
        <StorePicker />
      </>,
    );
    await openPicker();
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('We could not load the stores.');
    expect(within(dialog()).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    setup({ sku: 'POD-1', selectedKey: SOHO.key });
    await openPicker();
    await within(dialog()).findByText('In stock for this item');
    await expectNoAxeViolations(document.body);
  });
});
