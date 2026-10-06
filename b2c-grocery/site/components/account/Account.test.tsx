import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { AccountShell } from './AccountShell';
import { AddressCard, addressLines } from './AddressCard';
import { DetailsCard } from './DetailsCard';

const user = { id: 'c-1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' };
const profile = (extra: Record<string, unknown> = {}) => ({ createdAt: '2023-04-01T10:00:00.000Z', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', ...extra });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Routes `/api/auth/me` and `/api/account/profile`. */
function stubApi(profileBody: unknown, profileStatus = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/auth/me') return json({ user });
      if (url === '/api/account/profile') return json(profileBody, profileStatus);
      throw new Error(`unexpected ${url}`);
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('AccountShell', () => {
  it('Signed-in customer: name as H1, kicker with the member-since year, both columns render', async () => {
    stubApi(profile());
    renderWithProviders(<AccountShell main={<p>left</p>} aside={<p>right</p>} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(await screen.findByText('Member since 2023')).toBeInTheDocument();
    expect(screen.getByText('left')).toBeInTheDocument();
    expect(screen.getByText('right')).toBeInTheDocument();
  });

  it('German locale: kicker is translated', async () => {
    stubApi(profile());
    renderWithProviders(<AccountShell main={null} aside={null} />, { locale: 'de-DE' });
    expect(await screen.findByText('Kunde seit 2023')).toBeInTheDocument();
  });

  it('profile failure: no kicker, the name still comes from the session', async () => {
    stubApi({ error: 'PROFILE_ERROR' }, 500);
    renderWithProviders(<AccountShell main={null} aside={null} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
  });
});

describe('DetailsCard', () => {
  it('Open addresses: rows with their hrefs (locale prefixed)', () => {
    renderWithProviders(<DetailsCard />);
    const hrefs = Object.fromEntries(['Orders', 'Addresses', 'Saved lists', 'Subscriptions', 'Contact us'].map((name) => [name, screen.getByRole('link', { name: new RegExp(name) }).getAttribute('href')]));
    expect(hrefs).toEqual({
      Orders: '/en-US/account/orders',
      Addresses: '/en-US/account/addresses',
      'Saved lists': '/en-US/account/saved',
      Subscriptions: '/en-US/account/subscriptions',
      'Contact us': '/en-US/contact',
    });
  });

  it('marks the current row', () => {
    renderWithProviders(<DetailsCard current="orders" />);
    expect(screen.getByRole('link', { name: /Orders/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Addresses/ })).not.toHaveAttribute('aria-current');
  });
});

describe('AddressCard', () => {
  it('shows the default address lines and an Edit link to the address book', async () => {
    stubApi(profile({ defaultShippingAddress: { firstName: 'Ada', lastName: 'Lovelace', streetName: 'Main St 1', postalCode: '73301', city: 'Austin', country: 'US' } }));
    renderWithProviders(<AddressCard />);
    expect(await screen.findByText('Main St 1')).toBeInTheDocument();
    expect(screen.getByText('73301 Austin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/en-US/account/addresses');
  });

  it('no default address: empty state with an add link', async () => {
    stubApi(profile());
    renderWithProviders(<AddressCard />);
    expect(await screen.findByText('No default address yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add an address' })).toHaveAttribute('href', '/en-US/account/addresses');
  });

  it('load failure: a message instead of the empty state', async () => {
    stubApi({ error: 'PROFILE_ERROR' }, 500);
    renderWithProviders(<AddressCard />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText('No default address yet')).not.toBeInTheDocument();
  });

  it('addressLines skips missing parts', () => {
    expect(addressLines({ country: 'DE', city: 'Berlin' })).toEqual(['Berlin', 'DE']);
  });
});
