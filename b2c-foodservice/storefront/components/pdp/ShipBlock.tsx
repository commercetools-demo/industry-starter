'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePdp } from '@/components/pdp/pdp-state';
import { useNow } from '@/components/pdp/use-now';
import Icon from '@/components/ui/Icon';
import { deliveryEstimate } from '@/lib/product/delivery';
import { DELIVERY_CUTOFF_HOUR, SHIP_DAYS_MAX, SHIP_DAYS_MIN } from '@/lib/shop-config';
import { marketForLocale } from '@/lib/utils';

/**
 * Ship block (workstream H, 3.8): the delivery estimate ("Order in the next 3 hours for delivery by Monday"), the same
 * for every address because there is no per-address estimate before a cart exists (Q-H-02). When the variant is out of
 * stock online the block says so, with the restock figure the inventory record carries.
 */
export default function ShipBlock() {
  const t = useTranslations('pdp');
  const locale = useLocale();
  const { data, preview } = usePdp();
  const now = useNow();
  const stock = preview.stock;

  let body: string | null = null;
  if (data.inventoryFailed) {
    body = t('error.stockUnknown');
  } else if (stock.online <= 0) {
    const detail =
      stock.restockableInDays !== undefined
        ? t('ship.backInDays', { n: stock.restockableInDays })
        : stock.expectedDelivery
          ? t('ship.expected', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(stock.expectedDelivery)) })
          : null;
    body = detail ? `${t('ship.outOnline')}. ${detail}` : t('ship.outOnline');
  } else if (now) {
    const est = deliveryEstimate(now, {
      cutoffHour: DELIVERY_CUTOFF_HOUR,
      timeZone: marketForLocale(locale).timeZone,
      minDays: SHIP_DAYS_MIN,
      maxDays: SHIP_DAYS_MAX,
    });
    const day = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(est.latest);
    body = est.beforeCutoff ? t('ship.before', { hours: est.hoursLeft, day }) : t('ship.after', { day });
  }

  return (
    <div className="flex items-start gap-2.5 rounded-card border border-line bg-surface px-4 py-3.5" data-testid="ship-block">
      <Icon name="truck" size={18} className="mt-px shrink-0 text-ink-2" />
      <p className="m-0 min-h-[1.4em] text-[13.5px] leading-snug text-ink">{body}</p>
    </div>
  );
}
