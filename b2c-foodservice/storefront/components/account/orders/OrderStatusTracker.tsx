import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { OrderStateKey } from '@/lib/types';

const STEPS: OrderStateKey[] = ['ordered', 'preparing', 'ready-for-collection', 'collected'];

/** Four-step tracker of the collection states (`mcf-order-*`). A missing state counts as `ordered`. */
export default function OrderStatusTracker({ state }: { state: OrderStateKey | null }) {
  const t = useTranslations('account.orders.pill');
  const tt = useTranslations('account.orders.detail');
  const current = Math.max(0, state ? STEPS.indexOf(state) : 0);
  const labels: Record<OrderStateKey, string> = {
    ordered: t('ordered'),
    preparing: t('preparing'),
    'ready-for-collection': t('ready'),
    collected: t('collected'),
  };
  return (
    <ol aria-label={tt('tracker')} className="m-0 flex list-none p-0" data-testid="order-tracker">
      {STEPS.map((step, i) => {
        const done = i < current || (i === current && step === 'collected');
        const active = i === current && !done;
        return (
          <li
            key={step}
            data-state={done ? 'done' : active ? 'active' : 'todo'}
            aria-current={active ? 'step' : undefined}
            className="relative flex flex-1 flex-col items-center gap-2 text-center"
          >
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={cn('absolute right-1/2 top-[14px] h-0.5 w-full', i <= current ? 'bg-teal' : 'bg-line-2')}
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 flex h-[30px] w-[30px] items-center justify-center rounded-pill border-2',
                done ? 'border-teal bg-teal text-surface' : active ? 'border-teal bg-surface text-teal-text' : 'border-line-2 bg-surface text-ink-3',
              )}
            >
              {done ? <Icon name="check" size={16} /> : <span className="text-[12px] font-semibold">{i + 1}</span>}
            </span>
            <span className={cn('text-[11.5px] font-semibold', active || done ? 'text-ink' : 'text-ink-3')}>{labels[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
