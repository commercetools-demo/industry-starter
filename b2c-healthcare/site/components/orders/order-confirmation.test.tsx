import { describe, expect, it, vi } from 'vitest';
import type { OrderStatus, OrderView } from '@/lib/order-types';
import { renderWithProviders, screen, within } from '@/test/utils';
import { OrderConfirmation } from './OrderConfirmation';
import { OrderTimeline } from './OrderTimeline';

vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const order = (over: Partial<OrderView> = {}): OrderView => ({
  id: 'o1',
  orderNumber: 'MLV-000042',
  status: 'received',
  shipmentState: null,
  createdAt: '2026-10-08T10:00:00Z',
  lines: [
    { name: 'Atorvastatin 20 mg', quantity: 1 },
    { name: 'Metformin 500 mg', quantity: 2 },
  ],
  deliverTo: '1 Main St, Albany, NY 12207',
  sameDay: false,
  total: { centAmount: 1875, currencyCode: 'USD', fractionDigits: 2 },
  refund: 'none',
  cancellable: true,
  ...over,
});

const doneSteps = () =>
  within(screen.getByRole('list', { name: 'Order progress' }))
    .getAllByRole('listitem')
    .filter((li) => li.getAttribute('data-done') === 'true')
    .map((li) => li.textContent?.replace(/\(.*\)$/, '').trim());

describe('design-checkout: Order confirmation and tracking', () => {
  it('Content: badge, headline, rows, estimate, four-step timeline and both buttons', () => {
    renderWithProviders(<OrderConfirmation order={order()} />);
    expect(screen.getByText('Order placed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Your medication is on its way.' })).toBeInTheDocument();
    expect(screen.getByText('MLV-000042')).toBeInTheDocument();
    expect(screen.getByText('Atorvastatin 20 mg, Metformin 500 mg')).toBeInTheDocument();
    expect(screen.getByText('1 Main St, Albany, NY 12207')).toBeInTheDocument();
    expect(screen.getByText('1–2 business days')).toBeInTheDocument();
    expect(screen.getByText('$18.75')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Order progress' })).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/en-US/account/orders');
    expect(screen.getByRole('link', { name: 'Search another RX' })).toHaveAttribute('href', '/en-US/prescriptions');
  });

  it('same-day orders say "Today by 8 pm"', () => {
    renderWithProviders(<OrderConfirmation order={order({ sameDay: true })} />);
    expect(screen.getByText('Today by 8 pm')).toBeInTheDocument();
  });
});

describe('design-checkout: Timeline follows real status', () => {
  it.each<[OrderStatus, string[]]>([
    ['received', ['Order received']],
    ['pharmacist-review', ['Order received', 'Pharmacist review']],
    ['packed-shipped', ['Order received', 'Pharmacist review', 'Packed and shipped']],
    ['delivered', ['Order received', 'Pharmacist review', 'Packed and shipped', 'Delivered']],
  ])('%s marks the reached steps done', (status, done) => {
    renderWithProviders(<OrderTimeline status={status} />);
    expect(doneSteps()).toEqual(done);
  });

  it('cancelled: states it, with no pending steps after it', () => {
    renderWithProviders(<OrderTimeline status="cancelled" />);
    const items = within(screen.getByRole('list', { name: 'Order progress' })).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(['Order received', 'Cancelled']);
  });
});

describe('order-confirmation-page: Order placed (true state)', () => {
  it('a cancelled order never says "Order placed" and shows no estimate or cancel button', () => {
    renderWithProviders(<OrderConfirmation order={order({ status: 'cancelled', cancellable: false })} />);
    expect(screen.queryByText('Order placed')).not.toBeInTheDocument();
    expect(screen.getByText('Order cancelled')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This order was cancelled.');
    expect(screen.queryByText('Estimate')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });
});

describe('post-purchase-order-management: presentation', () => {
  it('Shipment state visible: the shipment row shows the order shipment state', () => {
    renderWithProviders(<OrderConfirmation order={order({ status: 'packed-shipped', shipmentState: 'Shipped', cancellable: false })} />);
    expect(screen.getByText('Shipped')).toBeInTheDocument();
  });

  it('Partial shipment: the order says it is partly shipped, not simply "shipped"', () => {
    renderWithProviders(<OrderConfirmation order={order({ status: 'packed-shipped', shipmentState: 'Partial', cancellable: false })} />);
    expect(screen.getByText(/Partly shipped/)).toBeInTheDocument();
  });

  it('Refund state visible: a cancelled order shows "Refund requested", then "Refunded"', () => {
    const { rerender } = renderWithProviders(<OrderConfirmation order={order({ status: 'cancelled', refund: 'requested', cancellable: false })} />);
    expect(screen.getByText(/Refund requested/)).toBeInTheDocument();
    rerender(<OrderConfirmation order={order({ status: 'cancelled', refund: 'refunded', cancellable: false })} />);
    expect(screen.getByText('Refunded')).toBeInTheDocument();
  });

  it('the cancel button is offered only while the order can still be cancelled', () => {
    const { rerender } = renderWithProviders(<OrderConfirmation order={order()} />);
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    rerender(<OrderConfirmation order={order({ status: 'packed-shipped', cancellable: false })} />);
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('a delivered order says dispensed medicines cannot be returned', () => {
    renderWithProviders(<OrderConfirmation order={order({ status: 'delivered', cancellable: false })} />);
    expect(screen.getByText('Medicines that have been dispensed cannot be returned.')).toBeInTheDocument();
    expect(screen.queryByText('Estimate')).not.toBeInTheDocument();
  });
});
