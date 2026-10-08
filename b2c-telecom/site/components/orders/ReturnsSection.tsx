import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/account/format';
import type { Locale, Order } from '@/lib/types';

const GOODS = ['Advised', 'Returned', 'BackInStock', 'Unusable'] as const;
const REFUND = ['NonRefundable', 'Initial', 'Refunded', 'NotRefunded'] as const;
const isGoods = (value: string): value is (typeof GOODS)[number] => (GOODS as readonly string[]).includes(value);
const isRefund = (value: string): value is (typeof REFUND)[number] => (REFUND as readonly string[]).includes(value);

function Line({ label, value, known }: { label: string; value: string; known: boolean }): ReactElement {
  return (
    <p className="m-0 flex flex-wrap gap-x-2 text-md">
      <span className="font-display font-semibold">{label}:</span>
      <span className={known ? undefined : 'text-text-muted'}>{value}</span>
    </p>
  );
}

/**
 * Returns of the order. For every item the GOODS (has the device come back?) and the REFUND (has money been returned?) are two separate
 * labelled lines: they move independently on the platform, so they are never merged into one status. Unknown values are shown as they are.
 */
export function ReturnsSection({ order }: { order: Order }): ReactElement | null {
  const t = useTranslations('orders.returns');
  const locale = useLocale() as Locale;
  if (order.returns.length === 0) return null;
  return (
    <section aria-labelledby="order-returns" className="flex flex-col gap-5" data-print="hide">
      <h2 id="order-returns" className="m-0 font-display text-2xl font-bold tracking-ui">
        {t('title')}
      </h2>
      {order.returns.map((request, index) => (
        <div key={request.items[0]?.id ?? index} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-7" data-testid="return">
          {request.returnDate ? <p className="m-0 text-sm text-text-muted">{t('requested', { date: formatDate(request.returnDate, locale) })}</p> : null}
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {request.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1" data-testid="return-item">
                <p className="m-0 font-display text-md font-semibold">{t('item', { quantity: item.quantity, name: item.name })}</p>
                <Line label={t('goods')} value={isGoods(item.shipmentState) ? t(`goodsState.${item.shipmentState}`) : item.shipmentState} known={isGoods(item.shipmentState)} />
                <Line label={t('refund')} value={isRefund(item.paymentState) ? t(`refundState.${item.paymentState}`) : item.paymentState} known={isRefund(item.paymentState)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
