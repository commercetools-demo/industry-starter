import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Tag, type TagTone } from '@/components/ui/Tag';
import type { OrderStatus } from '@/lib/types';

const TONE: Record<OrderStatus, TagTone> = { placed: 'pink', processing: 'pink', shipped: 'pink', delivered: 'brand', completed: 'brand', cancelled: 'neutral', unknown: 'neutral' };

/** The status as words (never colour alone). */
export function OrderStatusTag({ status }: { status: OrderStatus }): ReactElement {
  const t = useTranslations('account');
  return <Tag tone={TONE[status]}>{t(`status.${status}`)}</Tag>;
}
