import { useFormatter, useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import type { OrderReturn } from '@/lib/types';

/** Returns of an order. Goods state and refund state are two separate chips, never merged into one status. */
export default function ReturnList({ returns }: { returns: OrderReturn[] }) {
  const t = useTranslations('account.orders.return');
  const format = useFormatter();
  if (returns.length === 0) return null;
  return (
    <ul className="m-0 grid list-none gap-3 p-0" data-testid="return-list">
      {returns.map((r) => (
        <li key={r.id}>
          <Card className="p-5" data-testid="return">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 font-display text-[15px] font-semibold text-ink">{t('title2')}</p>
              {r.createdAt ? <p className="m-0 text-[12.5px] text-ink-3">{format.dateTime(new Date(r.createdAt), { dateStyle: 'medium' })}</p> : null}
            </div>
            {r.trackingId ? <p className="m-0 mt-1 text-[12.5px] text-ink-3">{t('trackingId', { id: r.trackingId })}</p> : null}
            <ul className="m-0 mt-3 grid list-none gap-3 p-0">
              {r.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] text-ink">
                    {i.name} <span className="text-ink-3">× {i.quantity}</span>
                    {i.reason ? <span className="ml-2 text-[12.5px] text-ink-3">{i.reason}</span> : null}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Chip label={t('shipmentLabel')} text={t(`shipment.${i.shipmentState}`)} testId="return-goods-chip" />
                    <Chip
                      label={t('paymentLabel')}
                      text={t(`payment.${i.paymentState}`)}
                      testId="return-refund-chip"
                      done={i.paymentState === 'Refunded'}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Chip({ label, text, testId, done = false }: { label: string; text: string; testId: string; done?: boolean }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-semibold',
        done ? 'bg-teal/15 text-teal-text' : 'bg-canvas-2 text-ink-2',
      )}
    >
      <span className="font-normal text-ink-3">{label}</span>
      {text}
    </span>
  );
}
