import { screen } from '@testing-library/react';
import { mapOrder } from '@/lib/mappers/order';
import type { OrderConfirmationView } from '@/lib/types';
import { orderA } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';
import { OrderConfirmation } from './OrderConfirmation';

const NOW = new Date('2026-04-01T10:00:00Z');

function view(patch: Partial<OrderConfirmationView> = {}, orderPatch: { orderState?: string } = {}): OrderConfirmationView {
  const order = { ...mapOrder(orderA(), 'en-US'), orderNumber: 'MLV-7K3F9QXD', serviceStartDate: '2026-04-07', ...orderPatch };
  return { order, full: true, owner: true, email: 'alex@example.com', isGuest: false, paymentState: 'Paid', ...patch };
}

describe('OrderConfirmation', () => {
  it('Order placed: reference, captured totals and next steps come from the order', () => {
    const v = view();
    renderWithProviders(<OrderConfirmation view={v} now={NOW} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Order placed.' })).toBeInTheDocument();
    expect(screen.getByText('Order placed')).toBeInTheDocument(); // the tag
    expect(screen.getByText(/Your order number is MLV-7K3F9QXD\. We've received your order and your payment\./)).toBeInTheDocument();
    expect(screen.getByText('Payment: paid')).toBeInTheDocument();
    // the lines and totals are the order's recorded prices
    expect(screen.getAllByText('Cable 500', { exact: false })[0]).toBeInTheDocument();
    expect(screen.getAllByText('Due at order')[0]).toBeInTheDocument();
    expect(screen.getByText('Your service starts on Apr 7, 2026.')).toBeInTheDocument();
    expect(screen.getByText(/You can cancel until Apr 7, 2026\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Questions? Contact support' })).toHaveAttribute('href', '/en-US/support');
    expect(screen.getByRole('button', { name: 'Print receipt' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/en-US/account/orders/MLV-7K3F9QXD');
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/en-US/shop/phone-plans');
    expect(screen.getByRole('link', { name: 'Go to order history' })).toHaveAttribute('href', '/en-US/account/orders');
  });

  it('a confirmed order says confirmed; a cancelled order has no success banner and no cancel sentence', () => {
    const { unmount } = renderWithProviders(<OrderConfirmation view={view({}, { orderState: 'Confirmed' })} now={NOW} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Order confirmed.' })).toBeInTheDocument();
    unmount();
    renderWithProviders(<OrderConfirmation view={view({}, { orderState: 'Cancelled' })} now={NOW} />);
    expect(screen.getByRole('heading', { level: 2, name: 'This order was cancelled.' })).toBeInTheDocument();
    expect(screen.queryByText('Order placed.')).not.toBeInTheDocument();
    expect(screen.queryByText(/You can cancel until/)).not.toBeInTheDocument();
  });

  it('the cancel sentence disappears once the service has started', () => {
    renderWithProviders(<OrderConfirmation view={view()} now={new Date('2026-04-07T00:00:00Z')} />);
    expect(screen.queryByText(/You can cancel until/)).not.toBeInTheDocument();
  });

  it('a guest who placed the order is told to keep the number and offered an account, with no order links', () => {
    renderWithProviders(<OrderConfirmation view={view({ owner: false, isGuest: true })} now={NOW} />);
    expect(screen.getByText(/Keep your order number MLV-7K3F9QXD\. Order tracking needs an account\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/en-US/register');
    expect(screen.queryByRole('link', { name: 'View order' })).not.toBeInTheDocument();
  });

  it('the limited view shows reference, state, lines and totals only: no address, email, payment or account links', () => {
    renderWithProviders(<OrderConfirmation view={view({ full: false, owner: false, email: null })} now={NOW} />);
    expect(screen.getByText(/Sign in as the buyer to see the full order/)).toBeInTheDocument();
    expect(screen.queryByText(/Service address/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirmation for/)).not.toBeInTheDocument();
    expect(screen.queryByText('Payment: paid')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to order history' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print receipt' })).not.toBeInTheDocument();
  });

  it('de-DE: German banner and next steps', () => {
    renderWithProviders(<OrderConfirmation view={view()} now={NOW} />, { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 2, name: 'Bestellung aufgegeben.' })).toBeInTheDocument();
    expect(screen.getByText('Ihr Anschluss startet am 07.04.2026.')).toBeInTheDocument();
  });
});
