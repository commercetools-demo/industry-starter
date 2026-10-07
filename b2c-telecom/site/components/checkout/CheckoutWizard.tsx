'use client';

import { useCallback, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { useCheckout } from '@/hooks/useCheckout';
import { useRouter } from '@/i18n/routing';
import { stepsFor } from '@/lib/checkout/steps';
import type { CheckoutSessionInfo, CheckoutState, CheckoutStep } from '@/lib/types';
import { CheckoutStepper } from './CheckoutStepper';
import { CheckoutSummary } from './CheckoutSummary';
import { ContactStep } from './ContactStep';
import { DeliveryStep } from './DeliveryStep';
import { PaymentStep } from './PaymentStep';
import { ReviewStep } from './ReviewStep';
import { ServiceAddressStep } from './ServiceAddressStep';

type Props = {
  /** The cart state the server page read (the SWR fallback). */
  initial: CheckoutState;
  /** The step of the URL, already guarded by the page (a step beyond the first incomplete one never arrives here). */
  step: CheckoutStep;
};

/**
 * The checkout: five steps on one page, the step in the URL, ALL data on the commercetools cart (the client keeps only drafts of the
 * form fields). The payment step is shown only after "Continue to payment" succeeded; it is never a landing step.
 */
export function CheckoutWizard({ initial, step }: Props): ReactElement {
  const t = useTranslations('checkout');
  const router = useRouter();
  const checkout = useCheckout(initial);
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [payment, setPayment] = useState<{ info: CheckoutSessionInfo; totalCents: number } | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const steps = stepsFor(checkout.state);
  const current: CheckoutStep = payment ? 'payment' : step;
  const go = useCallback((target: CheckoutStep): void => router.push(`/bundle/checkout?step=${target}`), [router]);
  const next = useCallback((): void => {
    const target = steps[steps.indexOf(step) + 1];
    if (target) go(target);
  }, [steps, step, go]);

  const backToReview = useCallback(
    (reason?: 'cancelled'): void => {
      setPayment(null);
      setCancelled(reason === 'cancelled');
      if (step !== 'review') go('review');
    },
    [go, step],
  );

  return (
    <div className="flex flex-col gap-8">
      <CheckoutStepper steps={steps} current={current} />
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        <div className="md:order-2">
          <CheckoutSummary review={checkout.review} />
        </div>
        <div className="min-w-0 flex-1 md:order-1">
          {cancelled && !payment ? (
            <p role="status" className="mb-6 mt-0 rounded-lg border border-border bg-brand-100 p-4 text-md">
              {t('cancelled')}
            </p>
          ) : null}
          {payment ? (
            <PaymentStep
              key={payment.info.sessionId ?? payment.info.orderNumber}
              checkout={checkout}
              info={payment.info}
              baselineTotalCents={payment.totalCents}
              onRestart={async () => {
                const info = await checkout.startPayment(payment.totalCents);
                setPayment({ info, totalCents: payment.totalCents });
              }}
              onBackToReview={backToReview}
            />
          ) : step === 'contact' ? (
            <ContactStep checkout={checkout} phone={phone} onPhone={setPhone} onDone={next} />
          ) : step === 'address' ? (
            <ServiceAddressStep checkout={checkout} phone={phone} onDone={next} />
          ) : step === 'delivery' ? (
            <DeliveryStep checkout={checkout} onDone={next} />
          ) : (
            <ReviewStep
              checkout={checkout}
              onPayment={(info, totalCents) => {
                setCancelled(false);
                setPayment({ info, totalCents });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
