'use client';

import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import type { OrderState, OrderView } from '@/lib/types';
import OrderStatusTrack from './OrderStatusTrack';

/**
 * The collection card (one per store): where, when, who, and what to bring. The tracker sits in the first card (the order state
 * is the order's, not the store's). There is no email and no text message (D-032): the card says to keep the order number and to
 * check this page or the account for status.
 */
export default function CollectionCard({ collect, state, showTrack }: { collect: OrderView['collect'][number]; state: OrderState | null; showTrack: boolean }) {
  const t = useTranslations('order.collect');
  return (
    <Card as="section" aria-labelledby={`collect-${collect.storeKey}`} data-testid="collection-card">
      <div className="flex items-start gap-3">
        <span className="text-accent">
          <Icon name="store" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`collect-${collect.storeKey}`} className="m-0 font-display text-[17px] font-semibold">
            {t('title', { store: collect.storeName })}
          </h2>
          <p className="m-0 mt-0.5 text-[13.5px] text-ink-3">{collect.address}</p>
          <p className="m-0 mt-0.5 text-[13.5px] text-ink-3">
            {[collect.hours ? t('hours', { hours: collect.hours }) : null, collect.phone].filter(Boolean).join(' · ')}
          </p>
          {collect.readyMinutes ? <p className="m-0 mt-1 text-[13.5px] font-medium text-teal-text">{t('ready', { minutes: collect.readyMinutes })}</p> : null}
          {collect.pickupName ? <p className="m-0 mt-1 text-[13.5px] text-ink-2">{t('pickupName', { name: collect.pickupName })}</p> : null}
        </div>
      </div>
      {showTrack && state ? (
        <div className="mt-5">
          <OrderStatusTrack state={state} />
        </div>
      ) : null}
      <p className="m-0 mt-4 text-[13.5px] text-ink-2">{t('bring')}</p>
      <p className="m-0 mt-1 text-[13px] text-ink-3">{t('keepNumber')}</p>
      <p className="m-0 mt-1 text-[13px] text-ink-3">{t('checkLater')}</p>
    </Card>
  );
}
