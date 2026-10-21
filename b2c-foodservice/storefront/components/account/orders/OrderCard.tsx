'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import OrderStatusPill from '@/components/account/orders/OrderStatusPill';
import LineImage from '@/components/cart/LineImage';
import Button from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { formatMoney } from '@/lib/utils';
import type { OrderListItem } from '@/lib/types';

/** Maps directions to the store's coordinates; `null` when the store has none. Pure, tested. */
export function directionsUrl(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export interface OrderCardProps {
  order: OrderListItem;
  /** Buy again; pending is shown while it runs. Offered on completed orders only. */
  onReorder?: (id: string) => void;
  reordering?: boolean;
}

export default function OrderCard({ order, onReorder, reordering = false }: OrderCardProps) {
  const t = useTranslations('account.orders');
  const locale = useLocale();
  const format = useFormatter();
  const ready = order.status === 'ready' && order.collect;
  const href = ready && order.collect ? directionsUrl(order.collect.lat, order.collect.lng) : null;
  const extra = order.itemCount - order.thumbs.length;

  return (
    <Card as="article" data-testid="order-card" aria-label={t('orderNumber', { number: order.orderNumber })} className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
            className="font-display text-[18px] font-bold text-ink underline-offset-2 hover:underline"
          >
            {order.orderNumber}
          </Link>
          <p className="m-0 mt-1 text-[12.5px] text-ink-3">
            {format.dateTime(new Date(order.createdAt), { dateStyle: 'medium' })} · {formatMoney(order.totalCents, order.currency, locale)}
            {' · '}
            {t('itemsCount', { count: order.itemCount })}
          </p>
        </div>
        <OrderStatusPill status={order.status} hasCollect={order.hasCollect} hasShip={order.hasShip} />
      </div>

      <ul className="m-0 mt-4 flex list-none items-center gap-2 p-0">
        {order.thumbs.map((th, i) => (
          <li key={`${th.name}-${i}`}>
            <LineImage url={th.imageUrl ?? undefined} alt={th.name} width={52} height={62} />
          </li>
        ))}
        {extra > 0 ? <li className="text-[13px] font-medium text-ink-3">{t('more', { count: extra })}</li> : null}
      </ul>

      {ready && order.collect ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-field bg-teal/15 p-3.5 text-[14px] text-teal-text" data-testid="ready-block">
          <Icon name="store" size={18} className="mt-0.5 shrink-0" />
          <p className="m-0">
            {order.collect.hours
              ? t('readyBlock', { store: order.collect.storeName, hours: order.collect.hours })
              : t('readyBlockNoHours', { store: order.collect.storeName })}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3 max-xs:[&>*]:w-full">
        <ButtonLink variant="ghost" href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}>
          {t('details')}
        </ButtonLink>
        {order.status === 'completed' && onReorder ? (
          <Button variant="ghost" loading={reordering} onClick={() => onReorder(order.id)}>
            {t('buyAgain')}
          </Button>
        ) : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: 'accent' })}
            data-testid="directions-link"
          >
            {t('directions')}
          </a>
        ) : null}
      </div>
    </Card>
  );
}
