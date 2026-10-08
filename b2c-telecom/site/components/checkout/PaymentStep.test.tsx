import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutError } from '@/hooks/useCheckout';
import type { CheckoutSessionInfo } from '@/lib/types';
import { fakeCheckout, makeCart, planLine, feeLine, readyState, usd } from '@/test/fixtures/checkoutApi';
import { renderWithProviders } from '@/test/utils';

const sdk = vi.hoisted(() => ({ paymentFlow: vi.fn(), checkoutFlow: vi.fn() }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('@commercetools/checkout-browser-sdk', () => sdk);
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ replace: nav.replace, push: nav.push, refresh: vi.fn() }) }));

import { PaymentStep } from './PaymentStep';

const HOSTED: CheckoutSessionInfo = { mode: 'hosted', orderNumber: 'MLV-AAAAAAAA', sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp', flow: 'payment' };
const TOTAL = 8499;

type Opts = { onInfo: (m: unknown) => void; onWarn: (m: unknown) => void; onError: (m: unknown) => void } & Record<string, unknown>;
const lastOptions = (flow: 'paymentFlow' | 'checkoutFlow' = 'paymentFlow'): Opts => sdk[flow].mock.calls.at(-1)?.[0] as Opts;
const message = (code: string, order?: { id: string }) => ({ severity: 'INFO', code, message: 'm', payload: order ? { order } : {}, correlationId: 'c' });

function renderStep(info: CheckoutSessionInfo = HOSTED, over: Parameters<typeof fakeCheckout>[1] = {}, locale: 'en-US' | 'de-DE' = 'en-US') {
  const checkout = fakeCheckout(readyState(), over);
  const onRestart = vi.fn(async () => undefined);
  const onBackToReview = vi.fn();
  const view = renderWithProviders(<PaymentStep checkout={checkout} info={info} baselineTotalCents={TOTAL} onRestart={onRestart} onBackToReview={onBackToReview} />, { locale });
  return { checkout, onRestart, onBackToReview, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PaymentStep (hosted)', () => {
  it('starts the SDK exactly once with the session, the mapped locale, the token styles and an inline mount point', async () => {
    const { container } = renderStep();
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalledTimes(1));
    expect(sdk.checkoutFlow).not.toHaveBeenCalled();
    expect(container.querySelector('[data-ctc]')).not.toBeNull();
    const options = lastOptions();
    expect(options).toMatchObject({ projectKey: 'proj', region: 'us-central1.gcp', sessionId: 'sess-1', locale: 'en-US' });
    expect(options).not.toHaveProperty('skipPaymentSuccessPage');
    expect(typeof options.styles).toBe('object');
  });

  it('de-DE maps to the SDK locale de', async () => {
    renderStep(HOSTED, {}, 'de-DE');
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    expect(lastOptions().locale).toBe('de');
  });

  it('the checkout flow (configurable) skips the SDK result pages; payment flow does not', async () => {
    renderStep({ ...HOSTED, flow: 'checkout' });
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalledTimes(1));
    expect(lastOptions('checkoutFlow')).toMatchObject({ skipPaymentSuccessPage: true, skipPaymentErrorPage: true });
  });

  it('order created: the order is handed to complete once (both completion codes arrive) and the buyer goes to the confirmation', async () => {
    const { checkout } = renderStep();
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    const options = lastOptions();
    act(() => {
      options.onInfo(message('checkout_completed', { id: 'o-1' }));
      options.onInfo(message('order_created', { id: 'o-1' }));
    });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/order-confirmation/MLV-AAAAAAAA'));
    expect(checkout.completeOrder).toHaveBeenCalledTimes(1);
    expect(checkout.completeOrder).toHaveBeenCalledWith('o-1');
  });

  it('a failing complete says the payment went through and offers Try again; after three failures a link to the confirmation page', async () => {
    const completeOrder = vi.fn(async () => {
      throw new CheckoutError('CHECKOUT_UNAVAILABLE', 'x', 502);
    });
    renderStep(HOSTED, { completeOrder });
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    act(() => lastOptions().onInfo(message('checkout_completed', { id: 'o-1' })));
    expect(await screen.findByText("Your payment went through. We're finishing your order.")).toBeInTheDocument();
    for (let i = 0; i < 2; i += 1) {
      await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    }
    await waitFor(() => expect(completeOrder).toHaveBeenCalledTimes(3));
    expect(await screen.findByRole('link', { name: 'Open your order' })).toHaveAttribute('href', '/en-US/order-confirmation/MLV-AAAAAAAA');
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('payment failed: the banner shows, the widget stays, nothing navigates and nothing is created', async () => {
    const { container, checkout } = renderStep();
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    act(() => lastOptions().onError(message('payment_failed')));
    expect(await screen.findByText("Your payment didn't go through. Try again or use another card.")).toBeInTheDocument();
    expect(container.querySelector('[data-ctc]')).not.toBeNull();
    expect(checkout.completeOrder).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('cancelled: back to review with the notice requested', async () => {
    const { onBackToReview } = renderStep();
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    act(() => lastOptions().onInfo(message('checkout_cancelled')));
    expect(onBackToReview).toHaveBeenCalledWith('cancelled');
  });

  it('session expired: says so and Start payment again asks for a new session', async () => {
    const { onRestart, container } = renderStep();
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    act(() => lastOptions().onInfo(message('expired_session')));
    expect(await screen.findByText('Your payment session expired.')).toBeInTheDocument();
    expect(container.querySelector('[data-ctc]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Start payment again' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('a cart that is gone sends the buyer to My bundle', async () => {
    renderStep();
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    act(() => lastOptions().onInfo(message('cart_emptied_during_checkout')));
    expect(nav.replace).toHaveBeenCalledWith('/bundle');
  });

  it('Placement fails at the last moment: recoverable panel, retry reuses the same order number', async () => {
    const { checkout, onBackToReview, container } = renderStep();
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    act(() => lastOptions().onError(message('non_orderable_cart_error')));
    expect(await screen.findByRole('heading', { name: "We couldn't place your order" })).toBeInTheDocument();
    expect(screen.getByText(/Something changed in your bundle/)).toBeInTheDocument();
    expect(container.querySelector('[data-ctc]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to My bundle' })).toHaveAttribute('href', '/en-US/bundle');
    await userEvent.click(screen.getByRole('button', { name: 'Review my order' }));
    // the review re-reads the cart; the next "Continue to payment" starts a session for the SAME reserved number (server-enforced)
    expect(checkout.refresh).toHaveBeenCalled();
    await waitFor(() => expect(onBackToReview).toHaveBeenCalled());
  });

  it('Totals moved after authorization: widget unmounts and the buyer is asked to pay the new total again', async () => {
    const moved = readyState({ cart: makeCart({ lines: [planLine(), feeLine({ total: usd(3000), unitPrice: usd(3000), unitListPrice: usd(3000) })] }) });
    const { checkout, container, onBackToReview } = renderStep(HOSTED, { refresh: vi.fn(async () => moved) });
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    expect(container.querySelector('[data-ctc]')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(checkout.refresh).toHaveBeenCalled());
    expect(await screen.findByText('The total changed from $84.99 to $89.99. Review your order and pay again.')).toBeInTheDocument();
    expect(container.querySelector('[data-ctc]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Review again' }));
    await waitFor(() => expect(onBackToReview).toHaveBeenCalled());
  });

  it('an unchanged total on focus changes nothing', async () => {
    const { checkout, container } = renderStep();
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(checkout.refresh).toHaveBeenCalled());
    expect(container.querySelector('[data-ctc]')).not.toBeNull();
    expect(screen.queryByText(/The total changed/)).not.toBeInTheDocument();
  });
});

describe('PaymentStep (demo mode)', () => {
  const DEMO: CheckoutSessionInfo = { mode: 'demo', orderNumber: 'MLV-AAAAAAAA' };

  it('says the payment is simulated, never starts the SDK, and places the order with the total the buyer saw', async () => {
    const { checkout } = renderStep(DEMO);
    expect(screen.getByText('Demo mode: payment is simulated')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Place order (demo)' }));
    await waitFor(() => expect(checkout.demoPay).toHaveBeenCalledWith(TOTAL));
    expect(nav.replace).toHaveBeenCalledWith('/order-confirmation/MLV-AAAAAAAA');
    expect(sdk.paymentFlow).not.toHaveBeenCalled();
  });

  it('409 TOTAL_CHANGED from the server shows the same notice', async () => {
    const demoPay = vi.fn(async () => {
      throw new CheckoutError('TOTAL_CHANGED', 'x', 409, { total: usd(9999) });
    });
    renderStep(DEMO, { demoPay });
    await userEvent.click(screen.getByRole('button', { name: 'Place order (demo)' }));
    expect(await screen.findByText('The total changed from $84.99 to $99.99. Review your order and pay again.')).toBeInTheDocument();
  });

  it('a guest is sent to sign in', async () => {
    const demoPay = vi.fn(async () => {
      throw new CheckoutError('SIGN_IN_REQUIRED', 'x', 401);
    });
    renderStep(DEMO, { demoPay });
    await userEvent.click(screen.getByRole('button', { name: 'Place order (demo)' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/login?next=%2Fbundle%2Fcheckout%3Fstep%3Dreview'));
  });
});
