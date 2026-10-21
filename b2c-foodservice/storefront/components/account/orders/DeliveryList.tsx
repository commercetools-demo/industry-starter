import { useFormatter, useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import type { OrderDelivery } from '@/lib/types';

/**
 * One block per delivery (a partial shipment has several). A delivery with no tracking number shows the placeholder, never
 * a dead link. The tracking link is only built for carriers the shop knows (`lib/account/tracking.ts`).
 */
export default function DeliveryList({ deliveries }: { deliveries: OrderDelivery[] }) {
  const t = useTranslations('account.orders.detail');
  const format = useFormatter();
  if (deliveries.length === 0) return null;
  return (
    <section aria-labelledby="deliveries-heading" className="mb-5">
      <h3 id="deliveries-heading" className="m-0 mb-3 font-display text-[17px] font-bold text-ink">
        {t('deliveries')}
      </h3>
      <ul className="m-0 grid list-none gap-3 p-0">
        {deliveries.map((d, i) => (
          <li key={d.id}>
            <Card data-testid="delivery" className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 font-display text-[15px] font-semibold text-ink">{t('parcel', { n: i + 1 })}</p>
                <p className="m-0 text-[12.5px] text-ink-3">{format.dateTime(new Date(d.createdAt), { dateStyle: 'medium' })}</p>
              </div>
              <ul className="m-0 mt-2 list-none p-0 text-[14px] text-ink-2">
                {d.items.map((item) => (
                  <li key={`${d.id}-${item.lineId}`}>
                    {item.name} <span className="text-ink-3">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-3 text-[13.5px]">
                {d.trackingId ? (
                  <>
                    {d.carrier ? <span className="text-ink-3">{d.carrier} · </span> : null}
                    {d.trackingUrl ? (
                      <a
                        href={d.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-ink underline underline-offset-2"
                      >
                        {t('tracking')}
                      </a>
                    ) : null}
                    <span className="ml-2 text-ink-3">{t('trackingId', { id: d.trackingId })}</span>
                  </>
                ) : (
                  <span className="text-ink-3">{t('noTracking')}</span>
                )}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
