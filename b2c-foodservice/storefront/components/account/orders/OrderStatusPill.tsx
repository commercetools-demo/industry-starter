import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { pillKey } from '@/lib/account/order-status';
import { cn } from '@/lib/cn';
import type { OrderStatusKind } from '@/lib/types';

/**
 * Status pill: ready teal, completed grey, everything else violet. The text always says the status (colour is never the
 * only signal). Store icon for collect-only orders, truck otherwise.
 */
export default function OrderStatusPill({
  status,
  hasCollect,
  hasShip,
}: {
  status: OrderStatusKind;
  hasCollect: boolean;
  hasShip: boolean;
}) {
  const t = useTranslations('account.orders.pill');
  const key = pillKey(status, hasCollect, hasShip);
  return (
    <span
      data-testid="order-pill"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1.5 text-[12.5px] font-semibold',
        status === 'ready' && 'bg-teal/15 text-teal-text',
        status === 'completed' && 'bg-canvas-2 text-ink-2',
        status !== 'ready' && status !== 'completed' && 'bg-accent/10 text-accent-press',
      )}
    >
      <Icon name={hasCollect && !hasShip ? 'store' : 'truck'} size={13} />
      {t(key)}
    </span>
  );
}
