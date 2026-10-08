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
const cart = { version: 4, total: { centAmount: 1875, currencyCode: 'USD', fractionDigits: 2 } };
const refresh = vi.fn();
let events: (event: PaymentEvent) => void = () => undefined;
let calls: { path: string; body?: unknown }[];
let authorizeAs: 'authorized' | 'declined';
let placeAnswer: { status: number; body: unknown };

function Harness({ mode, decline = false }: { mode: PaymentMode; decline?: boolean }) {
  const t = useTranslations('checkout');
  const flow = usePlaceFlow({ cart, mode, simulateDecline: decline, refresh });
  useEffect(() => {
    events = flow.onPaymentEvent;
  });
  return (
    <div>
      <PlaceOrderButton mode={mode} disabled={false} busy={flow.busy} onActivate={() => void flow.activate()} />
      {flow.problem ? <p role="alert">{flow.problem === 'DECLINED' ? t('payment.declined') : flow.problem === 'FAILED' ? t('place.generic') : t(`place.${flow.problem}` as 'place.generic')}</p> : null}
    </div>
  );
}

beforeEach(() => {
  Object.values(router).forEach((fn) => fn.mockReset());
  refresh.mockReset();
  calls = [];
  authorizeAs = 'authorized';
  placeAnswer = { status: 200, body: { orderId: 'ord-1', orderNumber: 'MLV-000001' } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (path === '/api/checkout/demo-authorize') return json({ status: authorizeAs });
      if (path === '/api/checkout/place') return json(placeAnswer.body, placeAnswer.status);
      return json({}, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const placeCalls = () => calls.filter((c) => c.path === '/api/checkout/place');

describe('design-checkout: Place order (Q-06)', () => {
  it('Success: places once with the amount shown and the cart version, then goes to /order/<id>', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order/ord-1'));
    expect(placeCalls()).toEqual([{ path: '/api/checkout/place', body: { expectedTotal: { centAmount: 1875, currencyCode: 'USD' }, cartVersion: 4 } }]);
  });

  it('Double submit: the button is busy and disabled while the request runs, and two activations place once', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    const button = screen.getByRole('button', { name: 'Place order' });
    await user.dblClick(button);
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(placeCalls()).toHaveLength(1);
    expect(calls.filter((c) => c.path === '/api/checkout/demo-authorize')).toHaveLength(1);
    const busy = screen.getByRole('button', { name: 'Placing your order' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });

  it('Declined payment: nothing is placed, the cart is kept and an inline message explains it; the button works again', async () => {
    authorizeAs = 'declined';
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" decline />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your payment was declined. No order was placed and your cart is kept.');
    expect(placeCalls()).toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('Totals moved after authorization: the server refusal is explained and the summary is re-read', async () => {
    placeAnswer = { status: 409, body: { code: 'TOTALS_MOVED', error: 'x' } };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The total changed after your payment was authorized');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('Placement fails at the last moment: a recoverable message, and activating again is allowed', async () => {
    placeAnswer = { status: 502, body: { code: 'PLACEMENT_FAILED', error: 'x' } };
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not place your order just now. Your payment was released and your cart is kept.');
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('an unreachable server gives the generic recoverable message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not place your order. Your cart is kept.');
  });

  it('order-confirmation-page: Placement outcome unknown: no answer from the place request goes to /order, not to an error that invites a second payment', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/checkout/demo-authorize') return json({ status: 'authorized' });
        throw new Error('connection reset');
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="demo" />);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order'));
  });

  it('with the real widget the button is the SDK payment button, a click places nothing by itself', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness mode="psp" />);
    const button = screen.getByRole('button', { name: 'Place order' });
    expect(button).toHaveAttribute('data-ctc-selector', 'paymentButton');
    await user.click(button);
    expect(calls).toHaveLength(0);
  });

  it('with the real widget: started makes the button busy, completed places once, failed shows the declined message', async () => {
    renderWithProviders(<Harness mode="psp" />);
    events('started');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Placing your order' })).toBeDisabled());
    events('completed');
    events('completed');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order/ord-1'));
    expect(placeCalls()).toHaveLength(1);
  });

  it('with the real widget: a failed payment places nothing', async () => {
    renderWithProviders(<Harness mode="psp" />);
    events('started');
    events('failed');
    expect(await screen.findByRole('alert')).toHaveTextContent('Your payment was declined');
    expect(placeCalls()).toHaveLength(0);
  });

  it('demo button has no SDK attribute', () => {
    renderWithProviders(<Harness mode="demo" />);
    expect(screen.getByRole('button', { name: 'Place order' })).not.toHaveAttribute('data-ctc-selector');
  });
});
