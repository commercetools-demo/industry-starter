import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import CollectionTab from '@/components/account/CollectionTab';
import StorePicker from '@/components/store/StorePicker';
import { keyChannels } from '@/lib/cache-keys';
import { renderShell, stubFetch } from '@/test/shell';
import type { OpeningHours, Store } from '@/lib/types';

const HOURS: OpeningHours = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: '07:00', close: '18:00' }]),
) as OpeningHours;
const store = (key: string, name: string, minutes: number): Store => ({
  id: key, key, name, addressLine: `${name} Street 1`, city: 'New York', postalCode: '10012', country: 'US',
  hours: HOURS, timeZone: 'America/New_York', collectionMinutes: minutes, phone: '+1 212 555 0100', geo: { lat: 40.7, lng: -74 },
});
const SOHO = store('mcf-store-nyc-soho', 'Malva SoHo', 15);
const BROOKLYN = store('mcf-store-nyc-brooklyn', 'Malva Brooklyn', 20);
const seed = (selectedKey: string | null) => ({
  [unstable_serialize(keyChannels('US'))]: { stores: [SOHO, BROOKLYN], selectedKey },
});
const THRESHOLD = { centAmount: 7500, currencyCode: 'USD' };

afterEach(() => vi.unstubAllGlobals());

describe('Collection tab', () => {
  it('Tiles read figures from data: minutes from the store, the threshold from the promise figures', () => {
    stubFetch({});
    renderShell(<CollectionTab freeShippingThreshold={THRESHOLD} />, { fallback: seed('mcf-store-nyc-brooklyn') });
    const tiles = screen.getByTestId('collection-tiles');
    expect(tiles).toHaveTextContent('Ready in about 20 minutes');
    expect(tiles).toHaveTextContent('Free shipping over $75.00');
    expect(tiles).toHaveTextContent('Subscribe and save');
    expect(within(tiles).getByRole('link', { name: 'Subscribe and save' })).toHaveAttribute('href', '/account/subscriptions');
  });

  it('hides a tile whose figure is missing, and carries no loyalty or in-store returns tile', () => {
    stubFetch({});
    renderShell(<CollectionTab freeShippingThreshold={null} />, { fallback: seed(null) });
    const tiles = screen.getByTestId('collection-tiles');
    expect(tiles).not.toHaveTextContent('Free shipping');
    expect(tiles).not.toHaveTextContent('Ready in about');
    expect(tiles.textContent).not.toMatch(/perks|points|in-store returns|loyalty/i);
  });

  it('shows the saved store with address, hours and phone', () => {
    stubFetch({});
    renderShell(<CollectionTab freeShippingThreshold={THRESHOLD} />, { fallback: seed('mcf-store-nyc-soho') });
    const card = screen.getByTestId('collection-store');
    expect(card).toHaveTextContent('Malva SoHo');
    expect(card).toHaveTextContent('Malva SoHo Street 1, New York 10012');
    expect(card).toHaveTextContent('Phone +1 212 555 0100');
    expect(screen.getByRole('button', { name: 'Change store' })).toBeInTheDocument();
  });

  it('No store chosen shows the choose button', () => {
    stubFetch({});
    renderShell(<CollectionTab freeShippingThreshold={THRESHOLD} />, { fallback: seed(null) });
    expect(screen.getByText('No store chosen yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a store' })).toBeInTheDocument();
  });

  it('Change store: the button opens the picker and the new store key is written to the session', async () => {
    const { calls } = stubFetch({ '/api/session/store': () => ({ storeKey: 'mcf-store-nyc-brooklyn' }), '/api/availability': () => ({}) });
    renderShell(
      <>
        <CollectionTab freeShippingThreshold={THRESHOLD} />
        <StorePicker />
      </>,
      { fallback: seed('mcf-store-nyc-soho') },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Change store' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose your store' });
    await userEvent.click(within(dialog).getByRole('radio', { name: /Malva Brooklyn/ }));
    await waitFor(() => {
      const put = calls.find((c) => c.url === '/api/session/store');
      expect(put?.init?.method).toBe('PUT');
      expect(JSON.parse(String(put?.init?.body))).toMatchObject({ storeKey: 'mcf-store-nyc-brooklyn' });
    });
    await waitFor(() => expect(screen.getByTestId('collection-store')).toHaveTextContent('Malva Brooklyn'));
  });
});
