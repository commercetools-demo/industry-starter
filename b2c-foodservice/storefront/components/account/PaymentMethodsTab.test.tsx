import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import AddressesTab from '@/components/account/AddressesTab';
import PaymentMethodsTab from '@/components/account/PaymentMethodsTab';
import { nav, renderShell, stubFetch } from '@/test/shell';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const me = () => ({ customer });
const m = (id: string, isDefault = false, label = '') => ({ id, version: 1, label, method: 'card', isDefault });

beforeEach(() => {
  nav.pathname = '/account/payment-methods';
});
afterEach(() => vi.unstubAllGlobals());

describe('Payment methods tab', () => {
  it('No methods saved: the explanation, no add button, no blank table', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/payment-methods': () => ({ methods: [], hostedOnly: true }) });
    renderShell(<PaymentMethodsTab />);
    expect(await screen.findByText('No saved cards.')).toBeInTheDocument();
    expect(screen.getByText('Cards you choose to save while paying appear here.')).toBeInTheDocument();
    expect(screen.getByText('Card details are only ever entered in our secure payment form at checkout.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add/i })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('lists a method by its label or as Card, with a Default tag and no card number', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/payment-methods': () => ({ methods: [m('p1', true, 'Visa ending 4242'), m('p2')], hostedOnly: true }) });
    renderShell(<PaymentMethodsTab />);
    const rows = await screen.findAllByTestId('payment-method');
    expect(rows[0]).toHaveTextContent('Visa ending 4242');
    expect(rows[0]).toHaveTextContent('Default');
    expect(within(rows[0]).queryByRole('button', { name: 'Make default' })).toBeNull();
    expect(rows[1]).toHaveTextContent('Card');
    expect(rows[1]).not.toHaveTextContent('Default');
  });

  it('Remove hides the method; the answer replaces the list', async () => {
    const { calls } = stubFetch({
      '/api/auth/me': me,
      '/api/account/payment-methods/p1': () => ({ methods: [m('p2')] }),
      '/api/account/payment-methods': () => ({ methods: [m('p1', true), m('p2')], hostedOnly: true }),
    });
    renderShell(<PaymentMethodsTab />);
    const rows = await screen.findAllByTestId('payment-method');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.getAllByTestId('payment-method')).toHaveLength(1));
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(true);
    // Default method removed: nothing is promoted silently.
    expect(screen.queryByText('Default')).toBeNull();
  });

  it('Make default posts to the default route', async () => {
    const { calls } = stubFetch({
      '/api/auth/me': me,
      '/api/account/payment-methods/p2/default': () => ({ methods: [m('p1'), m('p2', true)] }),
      '/api/account/payment-methods': () => ({ methods: [m('p1', true), m('p2')], hostedOnly: true }),
    });
    renderShell(<PaymentMethodsTab />);
    const rows = await screen.findAllByTestId('payment-method');
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Make default' }));
    await waitFor(() => expect(within(screen.getAllByTestId('payment-method')[1]).getByText('Default')).toBeInTheDocument());
    expect(calls.some((c) => c.url === '/api/account/payment-methods/p2/default' && c.init?.method === 'POST')).toBe(true);
  });

  it('Payment panel failure does not affect the addresses panel', async () => {
    stubFetch({
      '/api/auth/me': me,
      '/api/account/payment-methods': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }),
      '/api/account/addresses': () => ({ addresses: [{ id: 'a1', label: 'Home', firstName: 'M', lastName: 'O', streetName: '1 Main St', additionalStreetInfo: null, city: 'NYC', state: 'NY', postalCode: '10012', country: 'US', phone: null, isDefaultShipping: true, isDefaultBilling: true }] }),
    });
    renderShell(
      <>
        <PaymentMethodsTab />
        <AddressesTab />
      </>,
    );
    expect(await screen.findByTestId('panel-error')).toHaveTextContent('Payment methods is unavailable right now.');
    expect(await screen.findByTestId('address-card')).toHaveTextContent('1 Main St');
  });
});
