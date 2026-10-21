'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { SHIP_DAYS_MAX, SHIP_DAYS_MIN } from '@/lib/shop-config';
import type { Cart, CartGroup } from '@/lib/types';
import { useMoney } from './use-cart-ui';

/**
 * Heading of one fulfilment cluster (D-033): "Collect · {store}" with address and readiness, "Shipping to you" with the
 * market's free-shipping threshold and the delivery days, "Subscriptions". `compact` is the drawer's smaller heading
 * (no sub-line, no Change store); the page shows the full one.
 */
export default function GroupHeading({
  group, freeShipping, compact, onChangeStore, level = 3,
}: {
  group: CartGroup;
  freeShipping: Cart['freeShipping'];
  compact?: boolean;
  onChangeStore?: () => void;
  /** Heading level: 3 under the drawer title, 2 under the page title. */
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const t = useTranslations('cart.group');
  const tSub = useTranslations('subscription');
  const money = useMoney();
  const store = group.store;

  const title =
    group.kind === 'collect' ? t('collect', { store: store?.name ?? '' }) : group.kind === 'delivery' ? t('ship') : t('subscribe');
  const icon = group.kind === 'collect' ? 'store' : group.kind === 'delivery' ? 'truck' : 'repeat';

  let line: string | null = null;
  if (!compact) {
    if (group.kind === 'collect' && store) {
      line = t('collectLine', { address: `${store.addressLine}, ${store.city}`, minutes: store.collectionMinutes });
    } else if (group.kind === 'delivery') {
      line = freeShipping.threshold
        ? t('shipLine', { threshold: money(freeShipping.threshold), minDays: SHIP_DAYS_MIN, maxDays: SHIP_DAYS_MAX })
        : t('shipLineNoThreshold', { minDays: SHIP_DAYS_MIN, maxDays: SHIP_DAYS_MAX });
    } else if (group.kind === 'subscribe') {
      line = t('subscribeLine');
    }
  }

  return (
    <div className={compact ? 'mb-1 mt-4 flex items-center gap-2' : 'mb-1 flex flex-wrap items-start gap-x-3 gap-y-1'}>
      <span className={group.kind === 'collect' ? 'text-accent' : 'text-ink-2'}>
        <Icon name={icon} size={compact ? 16 : 20} />
      </span>
      <div className="min-w-0 flex-1">
        <Heading className={`m-0 font-display font-semibold ${compact ? 'text-[13px] uppercase tracking-[0.04em] text-ink-2' : 'text-[17px]'}`}>
          {title}
        </Heading>
        {line ? <p className="m-0 mt-0.5 text-[13px] text-ink-3">{line}</p> : null}
        {!compact && group.kind === 'subscribe' ? (
          <p className="m-0 mt-0.5 text-[13px] text-ink-3" data-testid="subscription-price-lock">
            {tSub('priceLock')} {tSub('cart.shippingNote')}
          </p>
        ) : null}
      </div>
      {!compact && group.kind === 'collect' && onChangeStore ? (
        <button
          type="button"
          onClick={onChangeStore}
          className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-ink underline underline-offset-2"
        >
          {t('changeStore')}
        </button>
      ) : null}
    </div>
  );
}
