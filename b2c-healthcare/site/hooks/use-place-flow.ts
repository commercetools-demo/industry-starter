'use client';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { usePaymentActions } from '@/hooks/use-checkout';
import type { PaymentEvent } from '@/components/checkout/PaymentCard';
import type { Money, PaymentMode, PaymentSessionInfo, PlaceOrderFailure } from '@/lib/types';

/** What went wrong, for the inline message. `DECLINED` is the payment itself; the rest are gate / finalize codes. */
export type PlaceProblem = PlaceOrderFailure | 'DECLINED' | 'UNAVAILABLE' | 'FAILED';

/** Problems after which the page re-reads the cart (the summary may no longer be what the buyer saw). */
const REFRESH_AFTER: ReadonlySet<PlaceProblem> = new Set(['TOTALS_MOVED', 'LINES_UNAVAILABLE', 'NO_DELIVERY_METHOD', 'ADDRESS_MISSING', 'EMPTY_CART', 'DISPENSE_REFUSED', 'COVER_UNRESOLVED', 'FUNDING_CHANGED']);

export interface PlaceFlowInput {
  cart: { total: Money };
  /** Changes whenever the cart total, the delivery or the card amount changes: a prepared session is dropped and the gate runs again. */
  cartKey: string;
  mode: PaymentMode;
  simulateDecline: boolean;
  /** Re-read the checkout state from the server. */
  refresh: () => void;
}

/**
 * The pay sequence in the full-Checkout design (D-034). The button runs the gate (`/api/checkout/prepare`); what it answers
 * decides the rest:
 *  - `checkout`: the session is handed to the payment card, which mounts the commercetools Checkout flow. Checkout
 *    authorizes the card and CREATES the order; its `checkout_completed` message carries the order id and
 *    `onPaymentEvent('completed', id)` asks the server to finalize that order (`/api/checkout/complete`);
 *  - `demo`: the dev-only demo provider stands in for Checkout (authorize, create the order) and then the same completion
 *    call runs;
 *  - `order`: nothing was left for the card, the server made and finalized the order: go to it.
 * One flight at a time. A declined payment creates no order and keeps the cart. When the completion call gets no usable
 * answer the order already exists, so the buyer goes to its page (which finalizes lazily), never to "try again".
 */
export function usePlaceFlow({ cart, cartKey, mode, simulateDecline, refresh }: PlaceFlowInput) {
  const router = useRouter();
  const { prepare, complete, demoAuthorize } = usePaymentActions();
  const flying = useRef(false);
  const completing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<PlaceProblem | null>(null);
  const [held, setHeld] = useState<{ key: string; session: PaymentSessionInfo } | null>(null);
  const session = held && held.key === cartKey ? held.session : null;

  const fail = useCallback(
    (code: PlaceProblem) => {
      flying.current = false;
      completing.current = false;
      setBusy(false);
      setProblem(code);
      if (REFRESH_AFTER.has(code)) refresh();
    },
    [refresh],
  );

  /** Checkout made the order: the server finalizes it, then the buyer sees it. */
  const finish = useCallback(
    async (orderId: string | undefined) => {
      if (completing.current) return;
      completing.current = true;
      setBusy(true);
      if (!orderId) {
        router.push('/order');
        return;
      }
      const result = await complete(orderId);
      if (result.ok) router.push(`/order/${encodeURIComponent(result.orderId)}`);
      else if (result.code === 'DISPENSE_REFUSED') fail('DISPENSE_REFUSED');
      // The order exists whatever happened to the answer: its page finalizes lazily and says what is true.
      else router.push(`/order/${encodeURIComponent(orderId)}`);
    },
    [complete, router, fail],
  );

  /** Click on the pay button: run the gate, then mount Checkout (psp), simulate it (demo) or go to the finished order. */
  const activate = useCallback(async () => {
    if (flying.current) return;
    flying.current = true;
    setBusy(true);
    setProblem(null);
    const gate = await prepare(cart);
    if (!gate.ok) return fail(gate.code);
    const { result } = gate;
    if (result.kind === 'order') {
      router.push(`/order/${encodeURIComponent(result.orderId)}`);
      return;
    }
    if (result.kind === 'checkout') {
      setHeld({ key: cartKey, session: result.session });
      flying.current = false;
      setBusy(false);
      return;
    }
    const demo = await demoAuthorize(simulateDecline);
    if (demo.status === 'authorized') await finish(demo.orderId);
    else fail(demo.status === 'declined' ? 'DECLINED' : 'FAILED');
  }, [prepare, cart, cartKey, router, fail, demoAuthorize, simulateDecline, finish]);

  const onPaymentEvent = useCallback(
    (event: PaymentEvent, orderId?: string) => {
      if (event === 'started') {
        flying.current = true;
        setBusy(true);
        setProblem(null);
      } else if (event === 'completed') void finish(orderId);
      else if (event === 'failed') fail('DECLINED');
      else {
        flying.current = false;
        setBusy(false);
      }
    },
    [finish, fail],
  );

  return { busy, problem, activate, onPaymentEvent, session, mode };
}
