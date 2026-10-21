'use client';

import { useTranslations } from 'next-intl';
import { useMoney } from '@/components/cart/use-cart-ui';

/** The market line of the delivery cluster, from commercetools data: the free-delivery threshold and the delivery days text, when they exist. */
export default function DeliveryNote({ note, currency }: { note: { freeAboveCents: number | null; days: string | null }; currency: string }) {
  const t = useTranslations('checkout.delivery');
  const money = useMoney();
  const parts = [
    note.freeAboveCents ? t('freeOver', { threshold: money({ centAmount: note.freeAboveCents, currencyCode: currency }) }) : null,
    note.days ? t('days', { days: note.days }) : null,
  ].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return (
    <p data-testid="delivery-note" className="m-0 mb-2 text-[13px] text-ink-3">
      {parts.join(' · ')}
    </p>
  );
}
