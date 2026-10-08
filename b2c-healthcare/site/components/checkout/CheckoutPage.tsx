'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHead } from '@/components/ui/PageHead';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCheckout } from '@/hooks/use-checkout';
import { usePlaceFlow, type PlaceProblem } from '@/hooks/use-place-flow';
import type { CheckoutState } from '@/lib/types';
import { AddressCard } from './AddressCard';
import { DeliverySpeedCard } from './DeliverySpeedCard';
import { OrderSummary } from './OrderSummary';
import { PaymentCard } from './PaymentCard';
import { PlaceOrderButton } from './PlaceOrderButton';

const EMPTY_CART_FOR_FLOW = { version: 0, total: { centAmount: 0, currencyCode: '', fractionDigits: 2 } };

/**
 * The checkout page body (the signed-in check is the (protected) layout's, which shows "Sign in to check out.").
 * Three cards on the left (address, delivery speed, payment), the sticky summary on the right. All state is the
 * server's: the checkout state is read from `/api/checkout` and replaced by each change's answer; the order is
 * placed once, from the cart the server holds.
 */
export function CheckoutPage() {
  const t = useTranslations('checkout');
  const { data: state, error, isLoading, mutate, saveAddress, chooseMethod } = useCheckout();
  const [simulateDecline, setSimulateDecline] = useState(false);

  const flow = usePlaceFlow({
    cart: state?.cart ?? EMPTY_CART_FOR_FLOW,
    mode: state?.paymentMode ?? 'psp',
    simulateDecline,
    refresh: () => void mutate(),
  });

  return (
    <>
      <PageHead title={t('title')} />
      <div className="mx-auto max-w-content px-5 pb-12 nav:px-8">
        <div className="mt-8">
          {isLoading && state === undefined ? (
            <Card aria-busy="true" aria-label={t('loading')} className="grid gap-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
            </Card>
          ) : error && state === undefined ? (
            <Card className="grid justify-items-start gap-3" role="alert">
              <p className="font-medium text-danger-700">{t('loadFailed')}</p>
              <Button variant="outline" size="sm" onClick={() => void mutate()}>
                {t('retry')}
              </Button>
            </Card>
          ) : !state || state.cart.lineCount === 0 ? (
            <Card className="grid justify-items-start gap-4" data-checkout-empty>
              <p className="text-neutral-600">{t('empty')}</p>
              <ButtonLink href="/prescriptions">{t('findPrescription')}</ButtonLink>
            </Card>
          ) : (
            <CheckoutBody
              state={state}
              flow={flow}
              saveAddress={saveAddress}
              chooseMethod={chooseMethod}
              simulateDecline={simulateDecline}
              onSimulateDeclineChange={setSimulateDecline}
            />
          )}
        </div>
      </div>
    </>
  );
}

interface BodyProps {
  state: CheckoutState;
  flow: ReturnType<typeof usePlaceFlow>;
  saveAddress: ReturnType<typeof useCheckout>['saveAddress'];
  chooseMethod: ReturnType<typeof useCheckout>['chooseMethod'];
  simulateDecline: boolean;
  onSimulateDeclineChange: (value: boolean) => void;
}

function CheckoutBody({ state, flow, saveAddress, chooseMethod, simulateDecline, onSimulateDeclineChange }: BodyProps) {
  const t = useTranslations('checkout');
  const { cart, options, deliverable, paymentMode } = state;
  const hasAddress = cart.shippingAddress !== null;
  const unresolved = cart.unresolved === true;
  const ready = hasAddress && deliverable && cart.shippingMethodKey !== null && cart.unavailableCount === 0 && !unresolved;
  const blockedReason = !hasAddress
    ? t('summary.needAddress')
    : !deliverable
      ? t('summary.notDeliverable')
      : unresolved
        ? t('summary.coverUnresolved')
        : cart.unavailableCount > 0
          ? t('summary.notIncluded', { count: cart.unavailableCount })
          : null;

  const text = (problem: PlaceProblem): string =>
    problem === 'DECLINED' ? t('payment.declined') : problem === 'UNAVAILABLE' ? t('payment.unavailable') : problem === 'FAILED' ? t('place.generic') : t(`place.${problem}`);
  const paymentProblem = flow.problem === 'DECLINED' || flow.problem === 'UNAVAILABLE' ? text(flow.problem) : null;
  const placeProblem = flow.problem && !paymentProblem ? text(flow.problem) : null;

  return (
    <div className="grid items-start gap-6 nav:grid-cols-[1fr_23.75rem]">
      <div className="grid gap-6">
        <AddressCard cartAddress={cart.shippingAddress} onSave={saveAddress} undeliverable={hasAddress && !deliverable} />
        <DeliverySpeedCard options={options} selectedKey={cart.shippingMethodKey} hasAddress={hasAddress} onChoose={chooseMethod} />
        <PaymentCard
          mode={paymentMode}
          ready={ready}
          cartKey={`${cart.id}|${cart.total.centAmount}|${cart.shippingMethodKey ?? ''}`}
          message={paymentProblem}
          onEvent={flow.onPaymentEvent}
          simulateDecline={simulateDecline}
          onSimulateDeclineChange={onSimulateDeclineChange}
        />
      </div>
      <OrderSummary cart={cart}>
        {placeProblem ? (
          <p role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700" data-place-problem>
            {placeProblem}
          </p>
        ) : null}
        {blockedReason ? (
          <p className="text-sm text-danger-700" data-place-blocked>
            {blockedReason}
          </p>
        ) : null}
        <PlaceOrderButton mode={paymentMode} disabled={Boolean(blockedReason)} busy={flow.busy} onActivate={() => void flow.activate()} />
        {cart.unavailableCount > 0 ? (
          <ButtonLink href="/cart" variant="outline" full>
            {t('summary.backToCart')}
          </ButtonLink>
        ) : null}
      </OrderSummary>
    </div>
  );
}
