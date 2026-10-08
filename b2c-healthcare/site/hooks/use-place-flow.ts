'use client';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { usePaymentActions } from '@/hooks/use-checkout';
import type { PaymentEvent } from '@/components/checkout/PaymentCard';
import type { Money, PaymentMode, PlaceOrderFailure } from '@/lib/types';

/** What went wrong, for the inline message. `DECLINED` is the payment itself; the rest are place-order codes. */
export type PlaceProblem = PlaceOrderFailure | 'DECLINED' | 'UNAVAILABLE' | 'FAILED';

/** Problems after which the page re-reads the cart (the summary may no longer be what the buyer saw). */
const REFRESH_AFTER: ReadonlySet<PlaceProblem> = new Set(['TOTALS_MOVED', 'LINES_UNAVAILABLE', 'NO_DELIVERY_METHOD', 'ADDRESS_MISSING', 'EMPTY_CART', 'DISPENSE_REFUSED']);

export interface PlaceFlowInput {
  cart: { version: number; total: Money };
  mode: PaymentMode;
  simulateDecline: boolean;
  /** Re-read the checkout state from the server. */
  refresh: () => void;
}

/**
 * The payment-and-place sequence. Real path: the Place order button is the SDK's payment button; the widget
 * reports `started` / `completed` / `failed`, and `completed` asks the server to place the order (the server checks
 * the authorization itself). Demo path: the click records a (possibly declined) demo authorization, then places.
 *
 * One flight at a time: a second activation while one is running does nothing (the button is also busy), and the
 * server answers a repeated key with the first order. A declined payment places nothing and keeps the cart. Success
 * navigates to `/order/<id>` and leaves the button busy until the page changes.
 */
export function usePlaceFlow({ cart, mode, simulateDecline, refresh }: PlaceFlowInput) {
  const router = useRouter();
  const { placeOrder, demoAuthorize } = usePaymentActions();
  const flying = useRef(false);
  const placing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<PlaceProblem | null>(null);

  const fail = useCallback(
    (code: PlaceProblem) => {
      flying.current = false;
      placing.current = false;
      setBusy(false);
      setProblem(code);
      if (REFRESH_AFTER.has(code)) refresh();
    },
    [refresh],
  );

  const place = useCallback(async () => {
    if (placing.current) return;
    placing.current = true;
    const result = await placeOrder(cart);
    if (result.ok) router.push(`/order/${encodeURIComponent(result.orderId)}`);
    // No usable answer from the place request: the order may exist (workstream S, "placement outcome unknown").
    // `/order` states that and sends the buyer to the order list; it never says "placed".
    else if (result.code === 'FAILED') router.push('/order');
    else fail(result.code);
  }, [cart, placeOrder, router, fail]);

  /** Click on Place order. Only the demo path acts here; with the real widget the SDK owns the click. */
  const activate = useCallback(async () => {
    if (mode !== 'demo' || flying.current) return;
    flying.current = true;
    setBusy(true);
    setProblem(null);
    const authorization = await demoAuthorize(simulateDecline);
    if (authorization === 'authorized') await place();
    else fail(authorization === 'declined' ? 'DECLINED' : 'FAILED');
  }, [mode, simulateDecline, demoAuthorize, place, fail]);

  const onPaymentEvent = useCallback(
    (event: PaymentEvent) => {
      if (event === 'started') {
        flying.current = true;
        setBusy(true);
        setProblem(null);
      } else if (event === 'completed') void place();
      else if (event === 'failed') fail('DECLINED');
      else {
        flying.current = false;
        setBusy(false);
      }
    },
    [place, fail],
  );

  return { busy, problem, activate, onPaymentEvent };
}
