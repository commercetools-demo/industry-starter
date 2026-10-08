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
  /** False when nothing is left for the card: the click places the order directly, the SDK is not involved. */
  needsCard?: boolean;
}

/**
 * Full-width "Place order". Busy means disabled and `aria-busy`, so a second activation cannot happen from the
 * keyboard or the mouse. With the real payment widget this button is the SDK's custom payment button
 * (`data-ctc-selector="paymentButton"`): the SDK listens for its clicks and the widget's own button is hidden.
 */
export function PlaceOrderButton({ mode, disabled, busy, onActivate, needsCard = true }: PlaceOrderButtonProps) {
  const t = useTranslations('checkout.summary');
  return (
    <Button
      full
      busy={busy}
      disabled={disabled}
      onClick={onActivate}
      {...(mode === 'psp' && needsCard ? { 'data-ctc-selector': 'paymentButton' } : {})}
      data-place-order
    >
      {busy ? t('placing') : t('placeOrder')}
    </Button>
  );
}
