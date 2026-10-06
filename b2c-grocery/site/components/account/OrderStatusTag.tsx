import { useTranslations } from 'next-intl';
import { Tag } from '@/components/ui/Tag';
import type { OrderStatus } from '@/lib/types';
import { STATUS_TONE } from './format';

/** processing: accent; packing and on its way: accent-2; delivered, cancelled and unknown: neutral. */
export function OrderStatusTag({ status }: { status: OrderStatus }) {
  const t = useTranslations('account.status');
  return (
    <Tag tone={STATUS_TONE[status]} className="whitespace-nowrap">
      {t(status)}
    </Tag>
  );
}
