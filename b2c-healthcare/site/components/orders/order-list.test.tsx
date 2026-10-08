import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderView } from '@/lib/order-types';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';
import { OrderList } from './OrderList';

const order = (over: Partial<OrderView> = {}): OrderView => ({
  id: 'o1',
  orderNumber: 'MLV-000042',
  status: 'received',
  shipmentState: null,
  createdAt: '2026-10-08T10:00:00Z',
  lines: [{ name: 'Atorvastatin 20 mg', quantity: 1 }],
  deliverTo: null,
  sameDay: false,
  total: { centAmount: 1875, currencyCode: 'USD', fractionDigits: 2 },
  refund: 'none',
  cancellable: true,
  ...over,
});

const findNotice = () => waitFor(() => {
  const el = document.querySelector<HTMLElement>('[data-reorder-result]');
  if (!el) throw new Error('no notice');
  return el;
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let reorderAnswer: Response;
beforeEach(() => {
  reorderAnswer = json({ added: ['Atorvastatin 20 mg'], notAdded: [] });
  vi.stubGlobal('fetch', vi.fn(async () => reorderAnswer));
});
afterEach(() => vi.unstubAllGlobals());

describe('order-history: the list', () => {
  it('Own orders only: one card per order with number, medication names, total and a Track button, in the given (newest first) order', () => {
    renderWithProviders(<OrderList orders={[order({ id: 'o2', orderNumber: 'MLV-000043', lines: [{ name: 'Metformin 500 mg', quantity: 1 }] }), order()]} />);
    const cards = screen.getAllByRole('article');
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['MLV-000043', 'MLV-000042']);
    expect(within(cards[1]!).getByText('Atorvastatin 20 mg')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('$18.75')).toBeInTheDocument();
    expect(within(cards[1]!).getByRole('link', { name: 'Track' })).toHaveAttribute('href', '/en-US/order/o1');
  });

  it('shows only medication names, never prescription numbers', () => {
    renderWithProviders(<OrderList orders={[order()]} />);
    expect(screen.queryByText(/RX-/)).not.toBeInTheDocument();
  });

  it('empty: "No orders yet." with an Order from a prescription action', () => {
    renderWithProviders(<OrderList orders={[]} />);
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Order from a prescription' })).toHaveAttribute('href', '/en-US/prescriptions');
  });

  it('a failed read says so, not "no orders"', () => {
    renderWithProviders(<OrderList orders={null} />);
    expect(screen.getByText(/We could not load your orders/)).toBeInTheDocument();
    expect(screen.queryByText('No orders yet.')).not.toBeInTheDocument();
  });

  it('a cancelled order is labelled cancelled, not hidden', () => {
    renderWithProviders(<OrderList orders={[order({ status: 'cancelled' })]} />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});

describe('order-history: Reorder with an unavailable item', () => {
  it('names what was added and what was not, with the reason', async () => {
    reorderAnswer = json({ added: ['Atorvastatin 20 mg'], notAdded: [{ name: 'Metformin 500 mg', reason: 'NO_REFILLS' }] });
    renderWithProviders(<OrderList orders={[order()]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reorder' }));
    const notice = await findNotice();
    expect(notice).toHaveTextContent('Added to your cart: Atorvastatin 20 mg.');
    expect(notice).toHaveTextContent('Not added: Metformin 500 mg (no refills left).');
    expect(within(notice).getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/en-US/cart');
    expect(fetch).toHaveBeenCalledWith('/api/orders/o1/reorder', expect.objectContaining({ method: 'POST' }));
  });

  it('nothing could be added: says so and names every line', async () => {
    reorderAnswer = json({ added: [], notAdded: [{ name: 'Metformin 500 mg', reason: 'EXPIRED' }] });
    renderWithProviders(<OrderList orders={[order()]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reorder' }));
    const notice = await findNotice();
    expect(notice).toHaveTextContent('None of these medications can be added right now.');
    expect(notice).toHaveTextContent('Metformin 500 mg (prescription expired)');
    expect(within(notice).queryByRole('link', { name: 'View cart' })).not.toBeInTheDocument();
  });

  it('a failed request is reported', async () => {
    reorderAnswer = json({ error: 'x' }, 500);
    renderWithProviders(<OrderList orders={[order()]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reorder' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('We could not reorder.'));
  });
});
