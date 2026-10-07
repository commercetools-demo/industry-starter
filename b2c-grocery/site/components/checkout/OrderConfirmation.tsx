'use client';

import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { orderLabel } from '@/components/account/format';
import { ProvisionalNotice } from '@/components/cart/ProvisionalNotice';
import { dayLabel, windowLabel } from '@/components/cart/SlotPicker';
import { Blob } from '@/components/ui/Blob';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { Order } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/**
 * Centred confirmation column (design `done`). `firstName` is the signed-in customer's, else the name entered at the
 * hosted checkout. Only signed-in owners get "Track this order"; a guest sees the order number instead.
 */
export function OrderConfirmation({ order, firstName, canTrack }: { order: Order; firstName?: string; canTrack: boolean }) {
  const t = useTranslations('checkout.confirmation');
  const locale = useLocale();
  const number = orderLabel(order);
  const total = formatMoney(order.total.centAmount, order.total.currencyCode, locale);
  return (
    <div className="page px-(--space-4) py-[calc(var(--space-8)*1.2)] tablet:px-(--space-8)">
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-(--space-3) text-center">
        <div className="relative h-[96px] w-[96px]">
          <Blob className="h-full w-full" />
          <Icon icon={Check} size={40} className="absolute inset-0 m-auto text-accent-2-800" />
        </div>
        <h6 className="text-accent-700" data-testid="confirmation-kicker">
          {t('kicker', { number })}
        </h6>
        <h1 className="m-0 text-[52px]">{firstName ? t('title', { name: firstName }) : t('titleNoName')}</h1>
        <p className="m-0 text-[17px]">{t('body')}</p>
        {order.slot ? (
          <p className="m-0 text-[15px]" data-testid="confirmation-slot">
            {t('delivery', { day: dayLabel(order.slot.start.slice(0, 10), locale), time: windowLabel(order.slot) })}
          </p>
        ) : null}
        <p className="m-0 text-[15px]" data-testid="confirmation-total">
          {order.isProvisional ? t('totalProvisional', { amount: total }) : t('total', { amount: total })}
        </p>
        {order.isProvisional ? <ProvisionalNotice variant="inline" /> : null}
        {canTrack ? null : (
          <p className="m-0 text-[15px]" data-testid="guest-number">
            {t('guestNumber', { number })}
          </p>
        )}
        <div className="mt-(--space-3) flex flex-wrap justify-center gap-(--space-3)">
          {canTrack ? <Button href={`/account/orders/${order.id}`}>{t('track')}</Button> : null}
          <Button href="/" variant={canTrack ? 'secondary' : 'primary'}>
            {t('shop')}
          </Button>
        </div>
      </div>
    </div>
  );
}
