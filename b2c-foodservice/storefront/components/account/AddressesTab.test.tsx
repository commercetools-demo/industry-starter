import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import AddressesTab from '@/components/account/AddressesTab';
import { nav, renderShell, stubFetch } from '@/test/shell';
import type { AppAddress } from '@/lib/types';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: 'a1', addresses: [] };
const addr = (id: string, over: Partial<AppAddress> = {}): AppAddress => ({
  id, label: id === 'a1' ? 'Home' : 'Work', firstName: 'Maya', lastName: 'Okonkwo', streetName: `${id} Example Street`, additionalStreetInfo: null,
  city: 'New York', state: 'NY', postalCode: '10012', country: 'US', phone: null,
  isDefaultShipping: id === 'a1', isDefaultBilling: id === 'a1', ...over,
});
const TWO = [addr('a1'), addr('a2')];
const me = () => ({ customer });
const body = (init?: RequestInit) => JSON.parse(String(init?.body));

beforeEach(() => {
  nav.pathname = '/account/addresses';
});
afterEach(() => vi.unstubAllGlobals());

async function fillValid() {
  await userEvent.type(screen.getByLabelText('First name'), 'Maya');
  await userEvent.type(screen.getByLabelText('Last name'), 'Okonkwo');
  await userEvent.type(screen.getByLabelText('Street address'), '1 Main St');
  await userEvent.type(screen.getByLabelText('City'), 'New York');
  await userEvent.selectOptions(screen.getByLabelText('State'), 'NY');
  await userEvent.type(screen.getByLabelText('ZIP code'), '10012');
}

describe('Addresses tab', () => {
  it('Address cards expose default as pressed state', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/addresses': () => ({ addresses: TWO }) });
    renderShell(<AddressesTab />);
    const cards = await screen.findAllByTestId('address-card');
    expect(within(cards[0]).getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(cards[1]).getByRole('button', { name: 'Make default' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(cards[0]).getByTestId('default-pill')).toBeInTheDocument();
  });

  it('address names are level 3 headings under the level 2 section title (no skipped level)', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/addresses': () => ({ addresses: TWO }) });
    renderShell(<AddressesTab />);
    const cards = await screen.findAllByTestId('address-card');
    expect(within(cards[0]).getByRole('heading', { level: 3, name: /Home/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('No saved addresses shows an explicit empty state with Add address', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/addresses': () => ({ addresses: [] }) });
    renderShell(<AddressesTab />);
    expect(await screen.findByText('No saved addresses.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add address' })).toBeInTheDocument();
  });

  it('Make default sends a change with makeDefault and the cards update', async () => {
    const { calls } = stubFetch({
      '/api/auth/me': me,
      '/api/account/addresses/a2': () => ({ addresses: [addr('a1', { isDefaultShipping: false }), addr('a2', { isDefaultShipping: true })] }),
      '/api/account/addresses': () => ({ addresses: TWO }),
    });
    renderShell(<AddressesTab />);
    const cards = await screen.findAllByTestId('address-card');
    await userEvent.click(within(cards[1]).getByRole('button', { name: 'Make default' }));
    await waitFor(() => expect(within(screen.getAllByTestId('address-card')[1]).getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true'));
    const patch = calls.find((c) => c.init?.method === 'PATCH');
    expect(body(patch?.init)).toMatchObject({ makeDefault: true, address: { streetName: 'a2 Example Street' } });
  });

  it('Delete default: the dialog states which address becomes the default', async () => {
    const { calls } = stubFetch({
      '/api/auth/me': me,
      '/api/account/addresses/a1': () => ({ addresses: [addr('a2', { isDefaultShipping: true })], promotedId: 'a2' }),
      '/api/account/addresses': () => ({ addresses: TWO }),
    });
    renderShell(<AddressesTab />);
    const cards = await screen.findAllByTestId('address-card');
    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this address?' });
    expect(within(dialog).getByTestId('delete-default-note')).toHaveTextContent('This is your default address. Work will become your default.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete address' }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(true));
    await waitFor(() => expect(screen.getAllByTestId('address-card')).toHaveLength(1));
    expect(within(screen.getByTestId('address-card')).getByRole('button', { name: 'Default' })).toBeInTheDocument();
  });

  it('Delete default of the last address says there will be no default', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/addresses': () => ({ addresses: [addr('a1')] }) });
    renderShell(<AddressesTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByTestId('delete-default-note')).toHaveTextContent('You will have no default until you choose one.');
  });

  it('deleting a non-default address shows no default note', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/addresses': () => ({ addresses: TWO }) });
    renderShell(<AddressesTab />);
    const cards = await screen.findAllByTestId('address-card');
    await userEvent.click(within(cards[1]).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByTestId('delete-default-note')).toBeNull();
  });
});

describe('Address form', () => {
  const open = async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/addresses': () => ({ addresses: [] }) });
    renderShell(<AddressesTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
  };

  it('Add address focuses the first invalid field and shows the error beside it', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(screen.getByLabelText('First name')).toHaveFocus();
    expect(screen.getByLabelText('First name')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('addr-firstName-error')).toHaveTextContent('This field is required.');
  });

  it('refuses a bad ZIP code beside the field and posts nothing', async () => {
    const { calls } = stubFetch({ '/api/auth/me': me, '/api/account/addresses': () => ({ addresses: [] }) });
    renderShell(<AddressesTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
    await fillValid();
    await userEvent.clear(screen.getByLabelText('ZIP code'));
    await userEvent.type(screen.getByLabelText('ZIP code'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(screen.getByLabelText('ZIP code')).toHaveFocus();
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false);
  });

  it('State field only for US', async () => {
    await open();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'CA');
    expect(screen.queryByLabelText('State')).toBeNull();
    expect(screen.getByLabelText('Postal code')).toBeInTheDocument();
  });

  it('a valid address is posted and the list refreshes', async () => {
    let list: AppAddress[] = [];
    const { calls } = stubFetch({
      '/api/auth/me': me,
      '/api/account/addresses': (init) => {
        if (init?.method === 'POST') {
          list = [addr('a9', { label: null, isDefaultShipping: true })];
          return Response.json({ addresses: list }, { status: 201 });
        }
        return { addresses: list };
      },
    });
    renderShell(<AddressesTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(screen.getAllByTestId('address-card')).toHaveLength(1));
    expect(body(calls.find((c) => c.init?.method === 'POST')?.init)).toMatchObject({
      address: { streetName: '1 Main St', state: 'NY', country: 'US' }, makeDefault: false, confirmed: false,
    });
  });

  it('Verify dialog lets the shopper decide before anything is stored', async () => {
    let attempt = 0;
    const { calls } = stubFetch({
      '/api/auth/me': me,
      '/api/account/addresses': (init) => {
        if (init?.method !== 'POST') return { addresses: [] };
        attempt += 1;
        if (!body(init).confirmed) {
          return Response.json(
            { error: { code: 'address_needs_confirmation', message: 'x', unresolved: ['postalCode'], suggestion: { ...body(init).address, postalCode: '10013' } } },
            { status: 409 },
          );
        }
        return Response.json({ addresses: [addr('a9')] }, { status: 201 });
      },
    });
    renderShell(<AddressesTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    const dialog = await screen.findByRole('dialog', { name: 'Check this address' });
    expect(dialog).toHaveTextContent("We couldn't confirm: postalCode.");
    expect(dialog).toHaveTextContent('Did you mean: 1 Main St, New York, NY, 10013, US');
    // Nothing stored yet: one attempt, unconfirmed.
    expect(attempt).toBe(1);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use suggestion' }));
    await waitFor(() => expect(attempt).toBe(2));
    const second = calls.filter((c) => c.init?.method === 'POST')[1];
    expect(body(second.init)).toMatchObject({ confirmed: true, address: { postalCode: '10013' } });
  });

  it('Edit in the verify dialog returns to the form with what was typed', async () => {
    stubFetch({
      '/api/auth/me': me,
      '/api/account/addresses': (init) =>
        init?.method === 'POST'
          ? Response.json({ error: { code: 'address_needs_confirmation', message: 'x', unresolved: ['streetName'] } }, { status: 409 })
          : { addresses: [] },
    });
    renderShell(<AddressesTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    const dialog = await screen.findByRole('dialog', { name: 'Check this address' });
    expect(within(dialog).queryByRole('button', { name: 'Use suggestion' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByLabelText('Street address')).toHaveValue('1 Main St'));
  });
});
