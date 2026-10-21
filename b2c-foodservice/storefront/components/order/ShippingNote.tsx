'use client';

import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import type { OrderView } from '@/lib/types';

/** The delivery card: method, estimate, address and, per parcel, the tracking number or "Tracking will appear here". */
export default function ShippingNote({ ship }: { ship: NonNullable<OrderView['ship']> }) {
  const t = useTranslations('order.ship');
  return (
    <Card as="section" aria-labelledby="order-ship-title" data-testid="shipping-card">
      <div className="flex items-start gap-3">
        <span className="text-ink-2">
          <Icon name="truck" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="order-ship-title" className="m-0 font-display text-[17px] font-semibold">
            {t('title')}
          </h2>
          <p className="m-0 mt-0.5 text-[13.5px] text-ink-2">{ship.methodName}</p>
          {ship.estimate ? <p className="m-0 mt-0.5 text-[13.5px] text-ink-3">{t('estimate', { window: ship.estimate })}</p> : null}
          {ship.address ? <p className="m-0 mt-0.5 text-[13.5px] text-ink-3">{t('to', { address: ship.address })}</p> : null}
        </div>
      </div>
      <ul className="m-0 mt-3 list-none p-0">
        {ship.deliveries.length === 0 ? (
          <li className="text-[13px] text-ink-3">{t('noTracking')}</li>
        ) : (
          ship.deliveries.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-2">
              {d.carrier ? <span>{d.carrier}</span> : null}
              {d.trackingId ? <span className="font-mono">{d.trackingId}</span> : <span className="text-ink-3">{t('noTracking')}</span>}
              {d.trackingUrl ? (
                <a href={d.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-2">
                  {t('track')}
                </a>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
