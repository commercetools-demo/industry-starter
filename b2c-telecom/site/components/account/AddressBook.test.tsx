import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SavedAddress } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { AddressBook } from './AddressBook';

const address = (id: string, over: Partial<SavedAddress> = {}): SavedAddress => ({
  id, firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US',
  isService: true, isBilling: true, isDefaultService: false, isDefaultBilling: false, ...over,
});

type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let handler: (call: Call) => { status?: number; body: unknown };

function stubFetch(): void {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = { url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body as string) : undefined };
      calls.push(call);
      const answer = handler(call);
      return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
    }),
  );
}

beforeEach(() => {
  stubFetch();
  handler = () => ({ body: { addresses: [] } });
});
afterEach(() => vi.unstubAllGlobals());

const fill = async (user: ReturnType<typeof userEvent.setup>, over: Partial<Record<'First name' | 'Last name' | 'Street address' | 'City' | 'ZIP / Postal code', string>> = {}) => {
  const values = { 'First name': 'Ada', 'Last name': 'Lovelace', 'Street address': '1 Main St', City: 'New York', 'ZIP / Postal code': '10001', ...over };
  for (const [label, value] of Object.entries(values)) {
    const field = screen.getByLabelText(label);
    await user.clear(field);
    if (value) await user.type(field, value);
  }
  await user.selectOptions(screen.getByLabelText('State'), 'NY');
};

describe('AddressBook', () => {
  it('shows the default and purpose tags and hides a default action that is not available', () => {
    renderWithProviders(
      <AddressBook
        country="US"
        initial={[
          address('a1', { isDefaultService: true, isDefaultBilling: true }),
          address('a2', { firstName: 'Bo', lastName: 'Kim', isBilling: false }),
        ]}
      />,
    );
    const first = screen.getAllByRole('listitem')[0] as HTMLElement;
    expect(within(first).getByText('Default service address')).toBeInTheDocument();
    expect(within(first).getByText('Default billing address')).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: /Make default/ })).not.toBeInTheDocument();
    const second = screen.getAllByRole('listitem')[1] as HTMLElement;
    expect(within(second).getByText('Service')).toBeInTheDocument();
    expect(within(second).getByRole('button', { name: /Make default service address/ })).toBeInTheDocument();
    expect(within(second).queryByRole('button', { name: /Make default billing address/ })).not.toBeInTheDocument();
  });

  it('shows an empty state with the add button when there are no addresses', () => {
    renderWithProviders(<AddressBook country="US" initial={[]} />);
    expect(screen.getByText('No addresses saved yet')).toBeInTheDocument();
    expect(screen.getByText('Save a service address so checkout can fill it in for you.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add an address' })).toBeInTheDocument();
  });

  it('invalid ZIP and empty city: inline errors and nothing is posted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressBook country="US" initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add an address' }));
    await fill(user, { City: '', 'ZIP / Postal code': '1234' });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a 5-digit ZIP code.')).toBeInTheDocument();
    expect(screen.getByText('Required.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('saves a resolved address with one validate call and one POST, defaults checked for the first address', async () => {
    const user = userEvent.setup();
    handler = (call) => {
      if (call.url.endsWith('/validate')) return { body: { fields: {}, resolve: { status: 'resolved', unresolvedFields: [] } } };
      if (call.method === 'POST') return { status: 201, body: { addresses: [address('new', { isDefaultService: true, isDefaultBilling: true })] } };
      return { body: { addresses: [] } };
    };
    renderWithProviders(<AddressBook country="US" initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add an address' }));
    expect(screen.getByLabelText('Use as service address')).toBeChecked();
    expect(screen.getByLabelText('Use as billing address')).toBeChecked();
    expect(screen.getByLabelText('Make this my default')).toBeChecked();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Default service address')).toBeInTheDocument();
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts.map((call) => call.url)).toEqual(['/api/account/addresses/validate', '/api/account/addresses']);
    expect(posts[1]?.body).toMatchObject({ makeDefaultService: true, makeDefaultBilling: true, address: { city: 'New York', postalCode: '10001' } });
  });

  it('Validation cannot resolve the address: panel offers suggested, keep and edit', async () => {
    const user = userEvent.setup();
    handler = (call) => {
      if (call.url.endsWith('/validate')) {
        return { body: { fields: {}, resolve: { status: 'unresolved', unresolvedFields: ['city'], nearestMatch: { city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } } } };
      }
      if (call.method === 'POST') return { status: 201, body: { addresses: [address('new')] } };
      return { body: { addresses: [] } };
    };
    renderWithProviders(<AddressBook country="US" initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add an address' }));
    await fill(user, { City: 'Brooklyn' });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText("We couldn't verify this address")).toBeInTheDocument();
    expect(screen.getByText('Check: City.')).toBeInTheDocument();
    expect(screen.getByText('New York, NY 10001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use suggested address' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep what I typed' })).toBeInTheDocument();
    // Nothing is stored yet; "Edit" returns to the form with what was typed.
    expect(calls.filter((call) => call.url === '/api/account/addresses' && call.method === 'POST')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('City')).toHaveValue('Brooklyn');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Keep what I typed' }));
    await waitFor(() => expect(calls.some((call) => call.url === '/api/account/addresses' && call.method === 'POST')).toBe(true));
    const stored = calls.find((call) => call.url === '/api/account/addresses' && call.method === 'POST');
    expect(stored?.body).toMatchObject({ confirmed: true, address: { city: 'Brooklyn' } });
  });

  it('"Use suggested address" saves the nearest match confirmed', async () => {
    const user = userEvent.setup();
    handler = (call) => {
      if (call.url.endsWith('/validate')) {
        return { body: { fields: {}, resolve: { status: 'unresolved', unresolvedFields: ['city'], nearestMatch: { city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } } } };
      }
      return { status: 201, body: { addresses: [address('new')] } };
    };
    renderWithProviders(<AddressBook country="US" initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add an address' }));
    await fill(user, { City: 'Brooklyn' });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Use suggested address' }));
    await waitFor(() => expect(calls.some((call) => call.url === '/api/account/addresses' && call.method === 'POST')).toBe(true));
    expect(calls.find((call) => call.url === '/api/account/addresses' && call.method === 'POST')?.body).toMatchObject({ confirmed: true, address: { city: 'New York', state: 'NY', postalCode: '10001' } });
  });

  it('warns that no default will remain when a default address is deleted, and deletes after confirming', async () => {
    const user = userEvent.setup();
    handler = () => ({ body: { addresses: [] } });
    renderWithProviders(<AddressBook country="US" initial={[address('a1', { isDefaultService: true })]} />);
    await user.click(screen.getByRole('button', { name: /^Delete/ }));
    expect(await screen.findByText('Delete this address?')).toBeInTheDocument();
    expect(screen.getByText('No default will remain. Your next order will ask you to choose an address.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls).toEqual([{ url: '/api/account/addresses/a1', method: 'DELETE', body: undefined }]));
    expect(await screen.findByText('No addresses saved yet')).toBeInTheDocument();
  });

  it('does not warn when a non-default address is deleted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressBook country="US" initial={[address('a1'), address('a2', { isDefaultService: true })]} />);
    await user.click(within(screen.getAllByRole('listitem')[0] as HTMLElement).getByRole('button', { name: /^Delete/ }));
    expect(screen.queryByText(/No default will remain/)).not.toBeInTheDocument();
  });
});
