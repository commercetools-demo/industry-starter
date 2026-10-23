'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import { useOrderStatus } from '@/hooks/useOrderStatus';
import { Link } from '@/i18n/routing';
import { accountHref } from '@/lib/routes';
import type { OrderView } from '@/lib/types';
import CollectionCard from './CollectionCard';
import OrderItems from './OrderItems';
import OrderSubscriptionCard from './OrderSubscriptionCard';
import ShippingNote from './ShippingNote';

/**
 * The confirmation (design-order-confirmation-page): rendered from the stored order, never from the cart. It claims no email and
 * no text message (D-032). The order is read again every 30 s while a collection is under way (the tracker follows the store).
 * `guest`: no signed-in customer, so the account offer is shown.
 */
export default function OrderConfirmation({ initial, guest }: { initial: OrderView; guest: boolean }) {
  const t = useTranslations('order');
  const { order } = useOrderStatus(initial.id, initial);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-20 pt-10">
      <div className="mb-8 text-center">
        <span aria-hidden="true" className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-pill bg-teal-strong text-surface">
          <Icon name="check" size={32} />
        </span>
        <h1 ref={heading} tabIndex={-1} className="m-0 font-display text-[32px] font-extrabold tracking-[-0.02em] outline-none">
          {t('confirmed')}
        </h1>
        <p className="m-0 mt-2 text-[14.5px] text-ink-2" data-testid="order-number-line">
          {t('numberLabel')} <span className="font-mono">{order.orderNumber}</span>
          {order.email ? ` · ${order.email}` : null}
        </p>
      </div>
      <div className="flex flex-col gap-[18px]">
        {order.collect.map((c, i) => (
          <CollectionCard key={c.storeKey} collect={c} state={order.state} showTrack={i === 0} />
        ))}
        {order.ship ? <ShippingNote ship={order.ship} deliveries={order.deliveries} /> : null}
        <OrderSubscriptionCard order={order} />
        <OrderItems order={order} />
        {order.linked.length > 0 ? (
          <Card as="section" aria-labelledby="order-linked-title" data-testid="linked-orders">
            <h2 id="order-linked-title" className="m-0 mb-2 font-display text-[17px] font-semibold">
              {t('linked.title')}
            </h2>
            <ul className="m-0 list-none p-0">
              {order.linked.map((l) => (
                <li key={l.id} className="py-0.5 text-[13.5px]">
                  <Link href={`/checkout/confirmation/${encodeURIComponent(l.id)}`} className="font-medium text-ink underline underline-offset-2">
                    {t('linked.order', { number: l.orderNumber })}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        {guest ? (
          <Card as="section" aria-labelledby="order-guest-title" data-testid="guest-offer">
            <h2 id="order-guest-title" className="m-0 font-display text-[17px] font-semibold">
              {t('guest.title')}
            </h2>
            <p className="m-0 mb-3 mt-1 text-[13.5px] text-ink-3">{t('guest.body')}</p>
            <ButtonLink href="/account/register" variant="accent">
              {t('guest.cta')}
            </ButtonLink>
          </Card>
        ) : null}
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href={accountHref()} size="lg">
          {t('viewAccount')}
        </ButtonLink>
        <ButtonLink href="/shop" variant="ghost" size="lg">
          {t('keepShopping')}
        </ButtonLink>
      </div>
    </div>
  );
}
