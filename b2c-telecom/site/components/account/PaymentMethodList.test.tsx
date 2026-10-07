import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PaymentMethodView } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { PaymentMethodList } from './PaymentMethodList';

const visa: PaymentMethodView = { id: 'pm-1', brand: 'visa', last4: '4242', expiry: '03/30', label: '', isDefault: true };
const mc: PaymentMethodView = { id: 'pm-2', brand: 'mastercard', last4: '5454', expiry: '11/29', label: '', isDefault: false };

let calls: Array<{ url: string; method: string }>;
let answer: PaymentMethodView[];
beforeEach(() => {
  calls = [];
  answer = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      return new Response(JSON.stringify({ paymentMethods: answer }), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('PaymentMethodList', () => {
  it('lists each method with brand, last four digits, expiry and the Default tag; the default has no make-default action', () => {
    renderWithProviders(<PaymentMethodList initial={[visa, mc]} />);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0] as HTMLElement).getAllByText('Visa ending 4242').length).toBeGreaterThan(0);
    expect(within(rows[0] as HTMLElement).getByText('Expires 03/30')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Default')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).queryByRole('button', { name: /Make default/ })).not.toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getAllByText('Mastercard ending 5454').length).toBeGreaterThan(0);
    expect(within(rows[1] as HTMLElement).queryByText('Default')).not.toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: /Make default/ })).toBeInTheDocument();
  });

  it('falls back to the record name and then to "Saved card"', () => {
    renderWithProviders(<PaymentMethodList initial={[{ ...visa, last4: null, expiry: null, label: 'Company card' }, { ...mc, last4: null, expiry: null, label: '', brand: 'unknown' }]} />);
    expect(screen.getAllByText('Company card').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Saved card').length).toBeGreaterThan(0);
  });

  it('makes another method the default and shows the list the server answered', async () => {
    const user = userEvent.setup();
    answer = [{ ...visa, isDefault: false }, { ...mc, isDefault: true }];
    renderWithProviders(<PaymentMethodList initial={[visa, mc]} />);
    await user.click(screen.getByRole('button', { name: /Make default/ }));
    await waitFor(() => expect(calls).toEqual([{ url: '/api/account/payment-methods/pm-2/default', method: 'POST' }]));
    await waitFor(() => expect(within(screen.getAllByRole('listitem')[1] as HTMLElement).getByText('Default')).toBeInTheDocument());
    expect(within(screen.getAllByRole('listitem')[0] as HTMLElement).queryByText('Default')).not.toBeInTheDocument();
  });

  it('Default method removed: no Default tag remains', async () => {
    const user = userEvent.setup();
    answer = [{ ...mc, isDefault: false }];
    renderWithProviders(<PaymentMethodList initial={[visa, mc]} />);
    await user.click(within(screen.getAllByRole('listitem')[0] as HTMLElement).getByRole('button', { name: /^Remove/ }));
    expect(await screen.findByText('Remove this card?')).toBeInTheDocument();
    expect(screen.getByText('No default will remain. Your next checkout will ask you to choose a payment method.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls).toEqual([{ url: '/api/account/payment-methods/pm-1', method: 'DELETE' }]));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
  });

  it('does not warn when a non-default method is removed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodList initial={[visa, mc]} />);
    await user.click(within(screen.getAllByRole('listitem')[1] as HTMLElement).getByRole('button', { name: /^Remove/ }));
    expect(screen.queryByText(/No default will remain/)).not.toBeInTheDocument();
  });

  it('No methods saved: plain statement with a link to My bundle, not an empty table', () => {
    renderWithProviders(<PaymentMethodList initial={[]} />);
    expect(screen.getByText('No saved payment methods')).toBeInTheDocument();
    expect(screen.getByText("You haven't saved a card yet. You can save one when you pay for your next order.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to My bundle' })).toHaveAttribute('href', '/en-US/bundle');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
