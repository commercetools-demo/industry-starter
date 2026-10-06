import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { OrderDetail } from './OrderDetail';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const order = (over: Partial<Order> = {}): Order => ({
  id: 'order-1',
  orderNumber: 'MLV-1001',
  createdAt: '2026-10-05T10:30:00.000Z',
  status: 'packing',
  statusRaw: 'Confirmed/Ready',
  lines: [
    {
      id: 'l1',
      name: 'Bananas',
      sku: 'BANANAS-500G',
      quantity: 2,
      unitPrice: { centAmount: 149, currencyCode: 'USD' },
      total: usd(298),
      increment: { value: 500, unit: 'g', label: '500 g' },
      approximateWeight: false,
      substitutionPreference: 'allow-similar',
    },
    {
      id: 'l2',
      name: 'Whole milk 1 L',
      sku: 'MILK-1L',
      image: 'https://picsum.photos/seed/milk/800/800',
      quantity: 1,
      unitPrice: { centAmount: 199, currencyCode: 'USD' },
      total: usd(199),
      increment: { value: 1, unit: 'l', label: '1 L' },
      approximateWeight: false,
      substitutionPreference: 'none',
    },
  ],
  subtotal: usd(497),
  shipping: usd(500),
  tax: usd(80),
  total: usd(997),
  isProvisional: false,
  shippingAddress: { firstName: 'Ada', lastName: 'Lovelace', streetName: 'Main St 1', postalCode: '73301', city: 'Austin', country: 'US' },
  slot: { id: '2026-10-13-10', start: '2026-10-13T10:00:00.000Z', end: '2026-10-13T12:00:00.000Z' },
  inventoryMode: 'None',
  version: 3,
  ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const stub = (body: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => json(body, status)));

afterEach(() => vi.unstubAllGlobals());

describe('OrderDetail', () => {
  it('heading, date, status tag and slot', async () => {
    stub({ order: order() });
    renderWithProviders(<OrderDetail orderId="order-1" />);
    expect(await screen.findByRole('heading', { level: 1, name: /Order MLV-1001/ })).toBeInTheDocument();
    expect(screen.getByText('Placed Oct 5, 2026')).toBeInTheDocument();
    expect(screen.getByText('Packing')).toHaveClass('tag-accent-2');
    expect(screen.getByTestId('order-slot')).toHaveTextContent('Delivery: Tue, Oct 13, 10:00–12:00');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/account/orders/order-1');
  });

  it('no slot: no delivery line', async () => {
    stub({ order: order({ slot: undefined }) });
    renderWithProviders(<OrderDetail orderId="order-1" />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByTestId('order-slot')).not.toBeInTheDocument();
  });

  it('lines table: name, increment label, quantity, unit price, line total and the preference text', async () => {
    stub({ order: order() });
    renderWithProviders(<OrderDetail orderId="order-1" />);
    await screen.findByRole('table', { name: 'Items in this order' });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const bananas = within(rows[0]);
    expect(bananas.getByText('Bananas')).toBeInTheDocument();
    expect(bananas.getByText('500 g')).toBeInTheDocument();
    expect(bananas.getByText('2')).toBeInTheDocument();
    expect(bananas.getByText('$1.49')).toBeInTheDocument();
    expect(bananas.getByText('$2.98')).toBeInTheDocument();
    expect(bananas.getByText('Allow similar')).toBeInTheDocument();
    expect(within(rows[1]).getByText('No substitution')).toBeInTheDocument();
    expect(within(rows[1]).getByText('$1.99 / l')).toBeInTheDocument();
  });

  it('totals: subtotal, delivery, tax and total; no provisional note and no final amount by default', async () => {
    stub({ order: order() });
    renderWithProviders(<OrderDetail orderId="order-1" />);
    const totals = await screen.findByText('Subtotal');
    const card = totals.closest('.card') as HTMLElement;
    expect(within(card).getByText('$4.97')).toBeInTheDocument();
    expect(within(card).getByText('$5.00')).toBeInTheDocument();
    expect(within(card).getByText('$0.80')).toBeInTheDocument();
    expect(within(card).getByText('Total')).toBeInTheDocument();
    expect(within(card).getByText('$9.97')).toBeInTheDocument();
    expect(screen.queryByTestId('provisional-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('final-amount')).not.toBeInTheDocument();
    expect(screen.queryByText('Total (provisional)')).not.toBeInTheDocument();
  });

  it('free delivery shows Included', async () => {
    stub({ order: order({ shipping: usd(0) }) });
    renderWithProviders(<OrderDetail orderId="order-1" />);
    expect(await screen.findByText('Included')).toBeInTheDocument();
  });

  it('Provisional order: notice and provisional total label, still no final amount', async () => {
    stub({ order: order({ isProvisional: true }) });
    renderWithProviders(<OrderDetail orderId="order-1" />);
    expect(await screen.findByTestId('provisional-note')).toBeInTheDocument();
    expect(screen.getByText('Total (provisional)')).toBeInTheDocument();
    expect(screen.queryByTestId('final-amount')).not.toBeInTheDocument();
  });

  it('Final amount recorded: shows the final amount and the difference next to the provisional total', async () => {
    stub({ order: order({ isProvisional: true, finalTotal: usd(1027) }) });
    renderWithProviders(<OrderDetail orderId="order-1" />);
    const final = await screen.findByTestId('final-amount');
    expect(final).toHaveTextContent('Final amount $10.27');
    expect(final).toHaveTextContent('+$0.30');
  });

  it('shipping address card', async () => {
    stub({ order: order() });
    renderWithProviders(<OrderDetail orderId="order-1" />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Delivery address')).toBeInTheDocument();
    expect(screen.getByText('73301 Austin')).toBeInTheDocument();
  });

  it("Another customer's order: not-found UI with a link back, no order data", async () => {
    stub({ error: 'ORDER_NOT_FOUND' }, 404);
    renderWithProviders(<OrderDetail orderId="theirs" />);
    expect(await screen.findByTestId('order-not-found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'We could not find that order' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All orders' })).toHaveAttribute('href', '/en-US/account/orders');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('server error: retry message, not the not-found page', async () => {
    stub({ error: 'ORDERS_ERROR' }, 500);
    renderWithProviders(<OrderDetail orderId="o1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this');
    expect(screen.queryByTestId('order-not-found')).not.toBeInTheDocument();
  });

  it('Extension slot for substitutions renders nothing', async () => {
    stub({ order: order() });
    const { container } = renderWithProviders(<OrderDetail orderId="order-1" />);
    await screen.findByRole('heading', { level: 1 });
    expect(container.querySelector('[data-testid="order-substitutions"]')).toBeNull();
  });

  it('German locale: labels and preference text are translated', async () => {
    stub({ order: order() });
    renderWithProviders(<OrderDetail orderId="order-1" />, { locale: 'de-DE' });
    expect(await screen.findByRole('heading', { level: 1, name: /Bestellung MLV-1001/ })).toBeInTheDocument();
    expect(screen.getByText('Ähnliches erlaubt')).toBeInTheDocument();
  });

  it('Proposal exists: the notice shows above the table and a declined line is tagged "Removal requested"', async () => {
    const proposals = {
      proposals: [
        { editId: 'e1', originalLineItemId: 'l2', originalName: 'Whole milk 1 L', substituteSku: 'OAT', substituteName: 'Oat drink', priceDifference: usd(50), newTotal: usd(1047), editable: true },
      ],
      removalRequested: ['l1'],
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(String(url).endsWith('/proposals') ? proposals : { order: order() })));
    renderWithProviders(<OrderDetail orderId="order-1" />);
    expect(await screen.findByText(/Proposed: Oat drink \(\+\$0\.50\)/)).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    await within(rows[0]).findByText('Removal requested');
    expect(within(rows[1]).queryByText('Removal requested')).not.toBeInTheDocument();
  });
});
