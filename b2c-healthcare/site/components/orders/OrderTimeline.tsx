import { useTranslations } from 'next-intl';
import { StatusTimeline } from '@/components/ui/StatusTimeline';
import { ORDER_STEPS, type OrderStatus } from '@/lib/order-types';

/**
 * The four-step progress of an order, driven by its State (not static): a step is done once the order has
 * reached it. A cancelled order ends the list truthfully: Order received, then Cancelled in the danger colour,
 * and no later step is shown as pending.
 */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  const t = useTranslations('orders');
  if (status === 'cancelled') {
    return (
      <ol aria-label={t('progress')} data-order-timeline="cancelled" className="m-0 grid list-none gap-3.5 p-0">
        <li data-done="true" className="flex items-center gap-3 text-sm text-navy-900">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-success-500" />
          <span>{t('steps.received')}</span>
        </li>
        <li data-cancelled="true" aria-current="step" className="flex items-center gap-3 text-sm font-medium text-danger-700">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-danger-500" />
          <span>{t('steps.cancelled')}</span>
        </li>
      </ol>
    );
  }
  const reached = ORDER_STEPS.indexOf(status);
  return (
    <div data-order-timeline={status}>
      <StatusTimeline label={t('progress')} steps={ORDER_STEPS.map((step, index) => ({ label: t(`steps.${step}`), done: index <= reached }))} />
    </div>
  );
}
