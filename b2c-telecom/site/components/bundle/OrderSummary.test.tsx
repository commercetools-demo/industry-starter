import { screen, within } from '@testing-library/react';
import { addonLine, feeLine, makeCart, phoneLine, planLine, usd } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { OrderSummary } from './OrderSummary';

describe('OrderSummary', () => {
  it('shows every row from cart.summary: plans, add-ons, monthly, one-time fees and due today', () => {
    const cart = makeCart({ lines: [planLine(), addonLine(), feeLine()] });
    renderWithProviders(<OrderSummary cart={cart} signedIn />);
    const summary = screen.getByRole('complementary', { name: 'Order summary' });
    expect(within(summary).getByText('Plans').nextSibling).toHaveTextContent('$59.99');
    expect(within(summary).getByText('Add-ons').nextSibling).toHaveTextContent('$9.99');
    expect(within(summary).getByText('Monthly').nextSibling).toHaveTextContent('$69.98');
    expect(within(summary).getByText('One-time fees').nextSibling).toHaveTextContent('$25.00');
    expect(within(summary).getByText('Due today').nextSibling).toHaveTextContent('$94.98');
    expect(within(summary).getByText(/Taxes are calculated at checkout/)).toBeInTheDocument();
  });

  it('hides the rows that are zero: no devices, no discounts, no taxes, no one-time fees', () => {
    renderWithProviders(<OrderSummary cart={makeCart({ lines: [phoneLine()] })} signedIn />);
    for (const label of ['Devices', 'Discounts', 'Taxes', 'One-time fees', 'Add-ons']) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it('a discount is a negative row and taxes appear once the engine has them', () => {
    const cart = makeCart({ summary: { discountTotal: usd(1000), tax: usd(190) } });
    renderWithProviders(<OrderSummary cart={cart} signedIn />);
    expect(screen.getByText('Discounts').nextSibling).toHaveTextContent('-$10.00');
    expect(screen.getByText('Taxes').nextSibling).toHaveTextContent('$1.90');
  });

  it('Below minimum order value: shortfall stated and the route to checkout is not offered', () => {
    const cart = makeCart({ lines: [phoneLine({ total: usd(2500), unitPrice: usd(2500) })], canCheckout: false, checkoutBlockedBy: ['MINIMUM_ORDER'] });
    renderWithProviders(<OrderSummary cart={cart} signedIn />);
    expect(screen.getByText('Add $5.00 more to reach the $30.00 minimum order.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Check out' })).not.toBeInTheDocument();
    const blocked = screen.getByText('Resolve the items above to continue');
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
  });

  it('a signed-in buyer sees only "Check out"; an anonymous visitor also sees the login link', () => {
    const cart = makeCart();
    const { unmount } = renderWithProviders(<OrderSummary cart={cart} signedIn />);
    expect(screen.getByRole('link', { name: 'Check out' })).toHaveAttribute('href', '/en-US/bundle/checkout');
    expect(screen.queryByRole('link', { name: 'Log in to check out with your account' })).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<OrderSummary cart={cart} signedIn={false} />);
    expect(screen.getByRole('link', { name: 'Check out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in to check out with your account' })).toHaveAttribute('href', '/en-US/login?next=%2Fbundle');
  });

  it('de-DE amounts and copy', () => {
    const cart = makeCart({ lines: [phoneLine({ total: usd(2500) })], canCheckout: false, checkoutBlockedBy: ['MINIMUM_ORDER'] });
    renderWithProviders(<OrderSummary cart={cart} signedIn />, { locale: 'de-DE' });
    expect(screen.getByRole('complementary', { name: 'Bestellübersicht' })).toBeInTheDocument();
    expect(screen.getByText(/Fügen Sie .* hinzu, um den Mindestbestellwert von .* zu erreichen\./)).toBeInTheDocument();
  });
});
