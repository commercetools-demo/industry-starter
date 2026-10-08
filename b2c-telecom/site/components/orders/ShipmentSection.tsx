import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Tag, type TagTone } from '@/components/ui/Tag';
import { formatDate } from '@/lib/account/format';
import type { Locale, Order, OrderDelivery, OrderParcel } from '@/lib/types';

const STATES = ['Pending', 'Ready', 'Shipped', 'Partial', 'Delivered', 'Delayed', 'Backorder', 'Canceled'] as const;
type ShipmentStateKey = (typeof STATES)[number];
const isState = (value: string | null): value is ShipmentStateKey => (STATES as readonly string[]).includes(value ?? '');
const TONE: Record<ShipmentStateKey, TagTone> = { Pending: 'neutral', Ready: 'pink', Shipped: 'pink', Partial: 'pink', Delivered: 'brand', Delayed: 'danger', Backorder: 'neutral', Canceled: 'neutral' };

const H2 = 'm-0 font-display text-2xl font-bold tracking-ui';

/** Whether the order has anything that ships (a device or equipment line). Plans and add-ons are digital. */
export function hasPhysicalLines(order: Pick<Order, 'lines'>): boolean {
  return order.lines.some((line) => line.kind === 'device' || line.kind === 'equipment' || line.acquisition !== null);
}

function Items({ items }: { items: OrderDelivery['items'] }): ReactElement {
  const t = useTranslations('orders.shipments');
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-md">
      {items.map((item) => (
        <li key={item.lineItemId}>{t('item', { quantity: item.quantity, name: item.name })}</li>
      ))}
    </ul>
  );
}

function Parcel({ parcel, index, total }: { parcel: OrderParcel; index: number; total: number }): ReactElement {
  const t = useTranslations('orders.shipments');
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-5" data-testid="parcel">
      <p className="m-0 font-display text-md font-semibold">{t('parcel', { m: index + 1, k: total })}</p>
      {parcel.carrier ? (
        <p className="m-0 text-md">
          <span className="text-text-muted">{t('carrier')}: </span>
          {parcel.carrier}
        </p>
      ) : null}
      <p className="m-0 text-md">
        {parcel.trackingId ? (
          <>
            <span className="text-text-muted">{t('tracking')}: </span>
            <span className="select-all font-display font-semibold tracking-ui">{parcel.trackingId}</span>
          </>
        ) : (
          <span className="text-text-muted">{t('trackingMissing')}</span>
        )}
      </p>
      {parcel.items.length > 0 ? <Items items={parcel.items} /> : null}
    </li>
  );
}

/**
 * Where the physical items of the order are: the order's shipment state, then one card per shipment with one row per parcel, its carrier,
 * its tracking reference (plain text, there is no carrier integration) and the items of that parcel. Never one merged status line.
 */
export function ShipmentSection({ order }: { order: Order }): ReactElement | null {
  const t = useTranslations('orders.shipments');
  const locale = useLocale() as Locale;
  if (!hasPhysicalLines(order) && order.deliveries.length === 0) return null;
  const state = isState(order.shipmentState) ? order.shipmentState : null;

  return (
    <section aria-labelledby="order-shipments" className="flex flex-col gap-5" data-print="hide">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="order-shipments" className={H2}>
          {t('title')}
        </h2>
        {state ? <Tag tone={TONE[state]}>{t(`state.${state}`)}</Tag> : null}
      </div>
      {order.deliveries.length === 0 ? (
        <p className="m-0 text-md">{t('none')}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-5 p-0">
          {order.deliveries.map((delivery, index) => (
            <li key={delivery.id} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-7" data-testid="delivery">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="m-0 font-display text-lg font-semibold">{t('shipment', { n: index + 1, total: order.deliveries.length })}</h3>
                <span className="text-sm text-text-muted">{t('created', { date: formatDate(delivery.createdAt, locale) })}</span>
              </div>
              {delivery.parcels.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {delivery.parcels.map((parcel, parcelIndex) => (
                    <Parcel key={parcel.id} parcel={parcel} index={parcelIndex} total={delivery.parcels.length} />
                  ))}
                </ul>
              ) : null}
              {delivery.parcels.every((parcel) => parcel.items.length === 0) ? <Items items={delivery.items} /> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
