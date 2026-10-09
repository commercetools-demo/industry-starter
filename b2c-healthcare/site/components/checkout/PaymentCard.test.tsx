import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { PaymentCard, type PaymentCardProps } from './PaymentCard';

const sdk = vi.hoisted(() => ({ checkoutFlow: vi.fn(), paymentFlow: vi.fn() }));
vi.mock('@commercetools/checkout-browser-sdk', () => sdk);

const SESSION = { sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' };
const props = (over: Partial<PaymentCardProps> = {}): PaymentCardProps => ({
  mode: 'psp', ready: true, session: SESSION, onEvent: vi.fn(), simulateDecline: false, onSimulateDeclineChange: vi.fn(), ...over,
});
const noCardFields = () => {
  expect(document.querySelectorAll('input[autocomplete^="cc-"], input[name*="card" i], input[name*="cvc" i], input[name*="cvv" i]')).toHaveLength(0);
};

beforeEach(() => {
  sdk.checkoutFlow.mockReset();
  sdk.paymentFlow.mockReset();
});

describe('design-checkout: Payment through the full Checkout flow', () => {
  it('Payment card: once the gate passed it hosts the FULL Checkout flow (mount point and session) and renders no card inputs', async () => {
    renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalledTimes(1));
    expect(sdk.checkoutFlow).toHaveBeenCalledWith(expect.objectContaining({ projectKey: 'proj', region: 'us-central1.gcp', sessionId: 'sess-1', locale: 'en-US' }));
    // Not payment-only mode any more: Checkout creates the order.
    expect(sdk.paymentFlow).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ctc]')).not.toBeNull();
    noCardFields();
    expect(document.querySelectorAll('[data-checkout-card="payment"] input')).toHaveLength(0);
  });

  it('before the gate has passed there is no session: the card says how to continue and mounts nothing', () => {
    renderWithProviders(<PaymentCard {...props({ session: null })} />);
    expect(sdk.checkoutFlow).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ctc]')).toBeNull();
    expect(screen.getByText(/Continue to payment/)).toBeInTheDocument();
  });

  it('a new session (the cart changed and the gate ran again) mounts the flow again', async () => {
    const { rerender } = renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalledTimes(1));
    rerender(<PaymentCard {...props({ session: { ...SESSION, sessionId: 'sess-2' } })} />);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalledTimes(2));
    expect(sdk.checkoutFlow.mock.calls[1][0]).toMatchObject({ sessionId: 'sess-2' });
  });

  it('does not start before the address and delivery method are on the cart', () => {
    renderWithProviders(<PaymentCard {...props({ ready: false })} />);
    expect(sdk.checkoutFlow).not.toHaveBeenCalled();
    expect(screen.getByText('Save your delivery address to continue to payment.')).toBeInTheDocument();
  });

  it('checkout_completed reports the order Checkout created (its id) to the page; started, cancelled and payment_failed too', async () => {
    const onEvent = vi.fn();
    renderWithProviders(<PaymentCard {...props({ onEvent })} />);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    const config = sdk.checkoutFlow.mock.calls[0][0] as { onInfo: (m: { code: string; payload?: unknown }) => void; onError: (m: { code: string }) => void };
    config.onInfo({ code: 'payment_started' });
    config.onInfo({ code: 'checkout_completed', payload: { order: { id: 'ord-9' } } });
    config.onInfo({ code: 'payment_cancelled' });
    config.onError({ code: 'payment_failed' });
    expect(onEvent.mock.calls).toEqual([['started'], ['completed', 'ord-9'], ['cancelled'], ['failed']]);
  });

  it('a completion message without an order id still reports completion (the page then goes to /order)', async () => {
    const onEvent = vi.fn();
    renderWithProviders(<PaymentCard {...props({ onEvent })} />);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    (sdk.checkoutFlow.mock.calls[0][0] as { onInfo: (m: { code: string }) => void }).onInfo({ code: 'checkout_completed' });
    expect(onEvent).toHaveBeenCalledWith('completed', undefined);
  });

  it('Declined payment: the page message shows inline in the card', () => {
    renderWithProviders(<PaymentCard {...props({ message: 'Your payment was declined. No order was placed and your cart is kept. Try another payment method.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Your payment was declined');
  });

  it('a failing SDK shows the load failure, not a blank card', async () => {
    sdk.checkoutFlow.mockImplementation(() => {
      throw new Error('boom');
    });
    renderWithProviders(<PaymentCard {...props()} />);
    expect(await screen.findByText('The payment form could not be loaded. Please try again.')).toBeInTheDocument();
  });

  it('demo mode shows the DEMO banner, never calls the SDK, and has no card fields', () => {
    renderWithProviders(<PaymentCard {...props({ mode: 'demo', session: null })} />);
    expect(screen.getByText('DEMO payment (no PSP configured)')).toBeInTheDocument();
    expect(sdk.checkoutFlow).not.toHaveBeenCalled();
    noCardFields();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('psp mode never shows the demo banner', async () => {
    renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(screen.queryByText(/DEMO payment/)).toBeNull();
  });

  it('the demo decline checkbox reports its state', async () => {
    const user = userEvent.setup();
    const onSimulateDeclineChange = vi.fn();
    renderWithProviders(<PaymentCard {...props({ mode: 'demo', session: null, onSimulateDeclineChange })} />);
    await user.click(screen.getByRole('checkbox', { name: 'Simulate a declined payment' }));
    expect(onSimulateDeclineChange).toHaveBeenCalledWith(true);
  });
});
