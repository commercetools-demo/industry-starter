import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SavedAddress } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { AddressBook } from './AddressBook';

const addr = (id: string, extra: Partial<SavedAddress> = {}): SavedAddress => ({
  id,
  firstName: 'Ada',
  lastName: id.toUpperCase(),
  streetName: `${id} Main St`,
  postalCode: '94105',
  city: 'San Francisco',
  country: 'US',
  isDefaultShipping: false,
  isDefaultBilling: false,
  ...extra,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A tiny stateful server: the book changes like the API would change it. */
function stubServer(initial: SavedAddress[]) {
  let book = [...initial];
  const writes: { method: string; url: string; body?: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : undefined;
    if (method !== 'GET') writes.push({ method, url, body });
    if (url === '/api/account/profile') return json({ createdAt: '2023-01-01T00:00:00.000Z', firstName: 'Ada', lastName: 'L', email: 'a@example.com' });
    if (url === '/api/account/addresses' && method === 'GET') return json({ addresses: book });
    if (url === '/api/account/addresses' && method === 'POST') {
      book = [...book, { ...addr(`new${book.length}`), ...(body as object), isDefaultShipping: book.length === 0 }];
      return json({ addresses: book }, 201);
    }
    const id = decodeURIComponent(url.split('/')[4]);
    if (method === 'DELETE') {
      book = book.filter((a) => a.id !== id);
      return json({ addresses: book });
    }
    if (method === 'PATCH') {
      book = book.map((a) => (a.id === id ? { ...a, ...(body as object) } : a));
      return json({ addresses: book });
    }
    if (url.endsWith('/default')) {
      book = book.map((a) => ({ ...a, isDefaultShipping: a.id === id, isDefaultBilling: a.id === id }));
      return json({ addresses: book });
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { writes, fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

const cards = () => screen.getAllByTestId('address-card');

describe('AddressBook list', () => {
  it('Default marked: only the default shipping card shows the Default tag and no Make default button', async () => {
    stubServer([addr('a1'), addr('a2', { isDefaultShipping: true })]);
    renderWithProviders(<AddressBook />);
    await screen.findAllByTestId('address-card');
    expect(cards()).toHaveLength(2);
    expect(screen.getAllByText('Default')).toHaveLength(1);
    expect(within(cards()[1]).getByText('Default')).toHaveClass('tag-accent-2');
    expect(within(cards()[1]).queryByRole('button', { name: /Make default/ })).not.toBeInTheDocument();
    expect(within(cards()[0]).getByRole('button', { name: /Make default/ })).toBeInTheDocument();
    expect(within(cards()[0]).getByText('Ada A1')).toBeInTheDocument();
    expect(within(cards()[0]).getByText('94105 San Francisco')).toBeInTheDocument();
    expect(within(cards()[0]).getByRole('button', { name: 'Edit address: Ada A1' })).toBeInTheDocument();
  });

  it('Empty state: message and "Add an address"', async () => {
    stubServer([]);
    renderWithProviders(<AddressBook />);
    expect(await screen.findByText('You have not saved an address yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add an address' })).toBeInTheDocument();
    expect(screen.queryByTestId('address-card')).not.toBeInTheDocument();
  });

  it('Load failure: message with a retry button', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'ADDRESS_ERROR' }, 500)));
    renderWithProviders(<AddressBook />);
    expect(await screen.findByText('We could not load your addresses.', undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('Make default moves the tag', async () => {
    const { writes } = stubServer([addr('a1', { isDefaultShipping: true }), addr('a2')]);
    renderWithProviders(<AddressBook />);
    await screen.findAllByTestId('address-card');
    await userEvent.click(within(cards()[1]).getByRole('button', { name: /Make default/ }));
    await waitFor(() => expect(within(cards()[1]).getByText('Default')).toBeInTheDocument());
    expect(within(cards()[0]).queryByText('Default')).not.toBeInTheDocument();
    expect(writes).toEqual([{ method: 'POST', url: '/api/account/addresses/a2/default', body: undefined }]);
  });
});

describe('AddressDialog', () => {
  const fill = async (over: Record<string, string> = {}) => {
    const values: Record<string, string> = { 'First name': 'Bo', 'Last name': 'Kim', 'Street and number': '9 Oak St', Postcode: '10001', City: 'New York', ...over };
    for (const [label, value] of Object.entries(values)) {
      const field = screen.getByLabelText(label);
      await userEvent.clear(field);
      await userEvent.type(field, value);
    }
  };

  it('Save address: valid data is posted and the list shows it; the dialog closes', async () => {
    const { writes } = stubServer([addr('a1', { isDefaultShipping: true })]);
    renderWithProviders(<AddressBook />);
    await screen.findAllByTestId('address-card');
    await userEvent.click(screen.getByRole('button', { name: 'Add an address' }));
    const dialog = screen.getByRole('dialog', { name: 'Add an address' });
    expect(within(dialog).getByLabelText('Country')).toHaveValue('US');
    await fill();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes[0]).toMatchObject({ method: 'POST', url: '/api/account/addresses', body: { firstName: 'Bo', lastName: 'Kim', streetName: '9 Oak St', postalCode: '10001', city: 'New York', country: 'US' } });
    expect(cards()).toHaveLength(2);
    expect(screen.getByText('Bo Kim')).toBeInTheDocument();
  });

  it('Invalid postcode: inline error and nothing is saved', async () => {
    const { writes } = stubServer([]);
    renderWithProviders(<AddressBook />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an address' }));
    await fill({ Postcode: '123' });
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Enter a valid postcode for the country.')).toBeInTheDocument();
    expect(screen.getByLabelText('Postcode')).toHaveAttribute('aria-invalid', 'true');
    expect(writes).toEqual([]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Missing fields show the required message; a DE postcode needs exactly five digits', async () => {
    const { writes } = stubServer([]);
    renderWithProviders(<AddressBook />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an address' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(screen.getAllByText('This field is required.')).toHaveLength(5);
    await fill({ Postcode: '94105-1234' });
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'DE');
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Enter a valid postcode for the country.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Postcode'));
    await userEvent.type(screen.getByLabelText('Postcode'), '10115');
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({ country: 'DE', postalCode: '10115' });
  });

  it('a server 400 shows the field errors inline', async () => {
    const base = stubServer([]);
    const original = base.fetchMock.getMockImplementation();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) =>
        init?.method === 'POST' ? json({ error: 'INVALID_ADDRESS', fields: { city: 'tooLong' } }, 400) : original?.(url, init),
      ),
    );
    renderWithProviders(<AddressBook />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an address' }));
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('That is too long (100 characters at most).')).toBeInTheDocument();
  });

  it('a failing save shows a message in the dialog and keeps it open', async () => {
    const base = stubServer([]);
    const original = base.fetchMock.getMockImplementation();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'POST' ? json({ error: 'ADDRESS_ERROR' }, 500) : original?.(url, init))));
    renderWithProviders(<AddressBook />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an address' }));
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save the address.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Edit opens the dialog filled in and patches that address', async () => {
    const { writes } = stubServer([addr('a1', { isDefaultShipping: true })]);
    renderWithProviders(<AddressBook />);
    await screen.findAllByTestId('address-card');
    await userEvent.click(screen.getByRole('button', { name: 'Edit address: Ada A1' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit address' });
    expect(within(dialog).getByLabelText('Street and number')).toHaveValue('a1 Main St');
    await userEvent.clear(within(dialog).getByLabelText('City'));
    await userEvent.type(within(dialog).getByLabelText('City'), 'Oakland');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes[0]).toMatchObject({ method: 'PATCH', url: '/api/account/addresses/a1', body: { city: 'Oakland' } });
    expect(screen.getByText('94105 Oakland')).toBeInTheDocument();
  });
});

describe('Delete', () => {
  it('asks for confirmation; cancel keeps the address', async () => {
    const { writes } = stubServer([addr('a1'), addr('a2')]);
    renderWithProviders(<AddressBook />);
    await screen.findAllByTestId('address-card');
    await userEvent.click(screen.getByRole('button', { name: 'Delete address: Ada A1' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this address?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes).toEqual([]);
    expect(cards()).toHaveLength(2);
  });

  it('Delete default: the card goes and no address is marked default', async () => {
    const { writes } = stubServer([addr('a1', { isDefaultShipping: true, isDefaultBilling: true }), addr('a2')]);
    // commercetools clears the default when the default address is removed (PROJECT-FINDINGS 18); the stub does the same.
    const fetchMock = vi.mocked(fetch);
    renderWithProviders(<AddressBook />);
    await screen.findAllByTestId('address-card');
    await userEvent.click(screen.getByRole('button', { name: 'Delete address: Ada A1' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this address?' });
    expect(within(dialog).getByText(/no default address afterwards/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete address' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toEqual([{ method: 'DELETE', url: '/api/account/addresses/a1', body: undefined }]);
    expect(cards()).toHaveLength(1);
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('a failing delete keeps the dialog open with a message', async () => {
    const base = stubServer([addr('a1')]);
    const original = base.fetchMock.getMockImplementation();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'DELETE' ? json({ error: 'ADDRESS_ERROR' }, 500) : original?.(url, init))));
    renderWithProviders(<AddressBook />);
    await screen.findAllByTestId('address-card');
    await userEvent.click(screen.getByRole('button', { name: 'Delete address: Ada A1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete address' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not delete the address.');
    expect(cards()).toHaveLength(1);
  });
});
