import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlaceFlow } from '@/hooks/use-place-flow';
import type { PaymentMode } from '@/lib/types';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import type { PaymentEvent } from './PaymentCard';
import { PlaceOrderButton } from './PlaceOrderButton';

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => router }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const cart = { total: { centAmount: 1875, currencyCode: 'USD', fractionDigits: 2 } };
const SESSION = { sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' };
const refresh = vi.fn();
let events: (event: PaymentEvent, orderId?: string) => void = () => undefined;
let calls: { path: string; body?: unknown }[];
let prepareAnswer: { status: number; body: unknown };
let authorizeAs: { status: string; orderId?: string };
let completeAnswer: { status: number; body: unknown };

function Harness({ mode, decline = false, cartKey = 'k1' }: { mode: PaymentMode; decline?: boolean; cartKey?: string }) {
  const t = useTranslations('checkout');
  const flow = usePlaceFlow({ cart, cartKey, mode, simulateDecline: decline, refresh });
  useEffect(() => {
    events = flow.onPaymentEvent;
  });
  return (
    <div>
      <PlaceOrderButton mode={mode} disabled={false} busy={flow.busy} onActivate={() => void flow.activate()} />
      <p data-testid="session">{flow.session?.sessionId ?? 'none'}</p>
      {flow.problem ? <p role="alert">{flow.problem === 'DECLINED' ? t('payment.declined') : flow.problem === 'FAILED' ? t('place.generic') : flow.problem === 'UNAVAILABLE' ? t('payment.unavailable') : t(`place.${flow.problem}` as 'place.generic')}</p> : null}
    </div>
  );
}

beforeEach(() => {
  Object.values(router).forEach((fn) => fn.mockReset());
  refresh.mockReset();
  calls = [];
  prepareAnswer = { status: 200, body: { kind: 'demo', cardDue: 1875 } };
  authorizeAs = { status: 'authorized', orderId: 'ord-1' };
  completeAnswer = { status: 200, body: { orderId: 'ord-1', orderNumber: 'MLV-000001' } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (path === '/api/checkout/prepare') return json(prepareAnswer.body, prepareAnswer.status);
      if (path === '/api/checkout/demo-authorize') return json(authorizeAs);
      if (path === '/api/checkout/complete') return json(completeAnswer.body, completeAnswer.status);
      return json({}, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const callsTo = (path: string) => calls.filter((c) => c.path === path);

describe('design-checkout: Place order, the gate then Checkout then the callback', () => {
  it('Success in the demo build: the gate runs with the amount shown, the demo Checkout creates the order, the callback finalizes it, then /order/<id>', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order/ord-1'));
    expect(callsTo('/api/checkout/prepare')).toEqual([{ path: '/api/checkout/prepare', body: { expectedTotal: { centAmount: 1875, currencyCode: 'USD' } } }]);
    expect(callsTo('/api/checkout/complete')).toEqual([{ path: '/api/checkout/complete', body: { orderId: 'ord-1' } }]);
    expect(calls.map((c) => c.path)).toEqual(['/api/checkout/prepare', '/api/checkout/demo-authorize', '/api/checkout/complete']);
  });

  it('Double submit: the button is busy and disabled while the request runs, and two activations run the gate once', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.dblClick(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(callsTo('/api/checkout/prepare')).toHaveLength(1);
    expect(callsTo('/api/checkout/complete')).toHaveLength(1);
    const busy = screen.getByRole('button', { name: 'Placing your order' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });

  it('Declined payment: no order exists, the cart is kept and an inline message explains it; the button works again', async () => {
    authorizeAs = { status: 'declined' };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" decline />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your payment was declined. No order was placed and your cart is kept.');
    expect(callsTo('/api/checkout/complete')).toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('Totals moved: the gate refusal is explained and the summary is re-read; Checkout is not started', async () => {
    prepareAnswer = { status: 409, body: { code: 'TOTALS_MOVED', error: 'x' } };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The total changed, so payment was not started.');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(callsTo('/api/checkout/demo-authorize')).toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('the gate failing at the last moment is recoverable: nothing was charged and activating again is allowed', async () => {
    prepareAnswer = { status: 502, body: { code: 'PLACEMENT_FAILED', error: 'x' } };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not start your payment just now. Nothing was charged and your cart is kept.');
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('an unreachable server gives the generic recoverable message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not place your order. Your cart is kept.');
  });

  it('order-confirmation-page: Placement outcome unknown: the order exists but the callback got no answer, so the buyer goes to the order page (which finalizes lazily), not to a second payment', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/checkout/prepare') return json({ kind: 'demo', cardDue: 1875 });
        if (path === '/api/checkout/demo-authorize') return json({ status: 'authorized', orderId: 'ord-1' });
        throw new Error('connection reset');
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order/ord-1'));
  });

  it('the prescription refusing at the last moment (the order was cancelled) is explained, not redirected', async () => {
    completeAnswer = { status: 422, body: { code: 'DISPENSE_REFUSED', orderId: 'ord-1' } };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A prescription can no longer be filled');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('nothing for the card: the gate made and finalized the order itself, the buyer goes straight to it', async () => {
    prepareAnswer = { status: 200, body: { kind: 'order', orderId: 'ord-7', orderNumber: 'MLV-000007' } };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order/ord-7'));
    expect(callsTo('/api/checkout/complete')).toHaveLength(0);
  });

  it('with the real Checkout the button reads "Continue to payment", runs the gate and hands the session to the payment card; no order yet', async () => {
    prepareAnswer = { status: 200, body: { kind: 'checkout', cardDue: 1875, session: SESSION } };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="psp" />);
    expect(screen.getByTestId('session')).toHaveTextContent('none');
    const button = screen.getByRole('button', { name: 'Continue to payment' });
    expect(button).not.toHaveAttribute('data-ctc-selector');
    await user.click(button);
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('sess-1'));
    expect(calls.map((c) => c.path)).toEqual(['/api/checkout/prepare']);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('a prepared session is dropped when the cart changes (the gate must run again for the new amount)', async () => {
    prepareAnswer = { status: 200, body: { kind: 'checkout', cardDue: 1875, session: SESSION } };
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<Harness mode="psp" cartKey="k1" />);
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('sess-1'));
    rerender(<Harness mode="psp" cartKey="k2" />);
    expect(screen.getByTestId('session')).toHaveTextContent('none');
  });

  it('with the real Checkout: checkout_completed carries the order id, the callback runs once, then /order/<id>; failed shows the declined message', async () => {
    renderWithProviders(<Harness mode="psp" />);
    events('started');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Placing your order' })).toBeDisabled());
    events('completed', 'ord-1');
    events('completed', 'ord-1');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order/ord-1'));
    expect(callsTo('/api/checkout/complete')).toHaveLength(1);
  });

  it('with the real Checkout: a failed payment finalizes nothing', async () => {
    renderWithProviders(<Harness mode="psp" />);
    events('started');
    events('failed');
    expect(await screen.findByRole('alert')).toHaveTextContent('Your payment was declined');
    expect(callsTo('/api/checkout/complete')).toHaveLength(0);
  });

  it('a completion message without an order id goes to /order (the list finds the order)', async () => {
    renderWithProviders(<Harness mode="psp" />);
    events('completed');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order'));
  });

  it('payment not configured: the gate answers 503 and the page says so', async () => {
    prepareAnswer = { status: 503, body: { error: 'Payment is not available right now.' } };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="psp" />);
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Payment is not available right now.');
  });
});
