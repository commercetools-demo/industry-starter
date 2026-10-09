'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import type { PaymentMode } from '@/lib/types';

export interface PlaceOrderButtonProps {
  mode: PaymentMode;
  /** The order cannot be placed yet (no address, nothing deliverable, unavailable lines). */
  disabled: boolean;
  /** A payment or placement is in flight: disabled and announced as busy. */
  busy: boolean;
  onActivate: () => void;
  /** False when nothing is left for the card: the click creates the order directly, Checkout is not involved. */
  needsCard?: boolean;
}

/**
 * Full-width action button. Busy means disabled and `aria-busy`, so a second activation cannot happen from the keyboard or
 * the mouse. With the real Checkout it reads "Continue to payment": it runs the pre-checkout gate and the Checkout flow
 * (which has its own pay button) then opens in the payment card. Without a card amount, or in the demo, it reads
 * "Place order" and finishes in one step.
 */
export function PlaceOrderButton({ mode, disabled, busy, onActivate, needsCard = true }: PlaceOrderButtonProps) {
  const t = useTranslations('checkout.summary');
  return (
    <Button
      full
      busy={busy}
      disabled={disabled}
      onClick={onActivate}
      data-place-order
    >
      {busy ? t('placing') : mode === 'psp' && needsCard ? t('continueToPayment') : t('placeOrder')}
    </Button>
  );
}
