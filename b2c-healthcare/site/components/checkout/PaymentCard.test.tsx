import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { PaymentCard, type PaymentCardProps } from './PaymentCard';

const sdk = vi.hoisted(() => ({ paymentFlow: vi.fn() }));
vi.mock('@commercetools/checkout-browser-sdk', () => sdk);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const props = (over: Partial<PaymentCardProps> = {}): PaymentCardProps => ({
  mode: 'psp', ready: true, cartKey: 'c1:1875', onEvent: vi.fn(), simulateDecline: false, onSimulateDeclineChange: vi.fn(), ...over,
});
const noCardFields = () => {
  expect(document.querySelectorAll('input[autocomplete^="cc-"], input[name*="card" i], input[name*="cvc" i], input[name*="cvv" i]')).toHaveLength(0);
};

beforeEach(() => {
  sdk.paymentFlow.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => json({ sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp', paymentMode: 'psp' })));
});
afterEach(() => vi.unstubAllGlobals());

describe('design-checkout: Payment through the payment widget (Q-04)', () => {
  it('Payment card: it hosts the Checkout payment component (mount point and session) and renders no card inputs', async () => {
    renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalledTimes(1));
    expect(sdk.paymentFlow).toHaveBeenCalledWith(expect.objectContaining({ projectKey: 'proj', region: 'us-central1.gcp', sessionId: 'sess-1', locale: 'en-US' }));
    expect(document.querySelector('[data-ctc]')).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/checkout/session', { method: 'POST' });
    noCardFields();
    // Nothing is prefilled: the card has no text inputs at all.
    expect(document.querySelectorAll('[data-checkout-card="payment"] input')).toHaveLength(0);
  });

  it('Payment card: a new session is created when the cart total changes (the amount is the cart\'s, re-read)', async () => {
    const { rerender } = renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalledTimes(1));
    rerender(<PaymentCard {...props({ cartKey: 'c1:2375' })} />);
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalledTimes(2));
  });

  it('does not start before the address and delivery method are on the cart', () => {
    renderWithProviders(<PaymentCard {...props({ ready: false })} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Save your delivery address to continue to payment.')).toBeInTheDocument();
  });

  it('Declined payment: the widget error payment_failed is reported to the page; completed and started too', async () => {
    const onEvent = vi.fn();
    renderWithProviders(<PaymentCard {...props({ onEvent })} />);
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    const config = sdk.paymentFlow.mock.calls[0][0] as { onInfo: (m: { code: string }) => void; onError: (m: { code: string }) => void };
    config.onInfo({ code: 'payment_started' });
    config.onInfo({ code: 'payment_completed' });
    config.onInfo({ code: 'payment_cancelled' });
    config.onError({ code: 'payment_failed' });
    expect(onEvent.mock.calls.map((c) => c[0])).toEqual(['started', 'completed', 'cancelled', 'failed']);
  });

  it('Declined payment: the page message shows inline in the card', () => {
    renderWithProviders(<PaymentCard {...props({ message: 'Your payment was declined. No order was placed and your cart is kept. Try another payment method.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Your payment was declined');
  });

  it('503 from the session endpoint says payment is not available and offers a reload; no SDK call', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Payment is not available right now.' }, 503)));
    const user = userEvent.setup();
    renderWithProviders(<PaymentCard {...props()} />);
    expect(await screen.findByText(/Payment is not available right now. Your cart is kept/)).toBeInTheDocument();
    expect(sdk.paymentFlow).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Reload payment' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('a failing SDK shows the load failure, not a blank card', async () => {
    sdk.paymentFlow.mockImplementation(() => {
      throw new Error('boom');
    });
    renderWithProviders(<PaymentCard {...props()} />);
    expect(await screen.findByText('The payment form could not be loaded. Please try again.')).toBeInTheDocument();
  });

  it('demo mode shows the DEMO banner, never calls the SDK or the session endpoint, and has no card fields', () => {
    renderWithProviders(<PaymentCard {...props({ mode: 'demo' })} />);
    expect(screen.getByText('DEMO payment (no PSP configured)')).toBeInTheDocument();
    expect(sdk.paymentFlow).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    noCardFields();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('psp mode never shows the demo banner', async () => {
    renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    expect(screen.queryByText(/DEMO payment/)).toBeNull();
  });

  it('the demo decline checkbox reports its state', async () => {
    const user = userEvent.setup();
    const onSimulateDeclineChange = vi.fn();
    renderWithProviders(<PaymentCard {...props({ mode: 'demo', onSimulateDeclineChange })} />);
    await user.click(screen.getByRole('checkbox', { name: 'Simulate a declined payment' }));
    expect(onSimulateDeclineChange).toHaveBeenCalledWith(true);
  });
});
