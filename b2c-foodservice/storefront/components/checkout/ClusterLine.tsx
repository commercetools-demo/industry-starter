'use client';

import { useTranslations } from 'next-intl';
import LineImage from '@/components/cart/LineImage';
import { storeName, useIntervalLabel, useMoney } from '@/components/cart/use-cart-ui';
import Icon from '@/components/ui/Icon';
import type { CartLine } from '@/lib/types';

/**
 * The per-line fulfilment marker (D-033): icon and words, never colour alone. A line never appears outside its cluster, and the
 * marker repeats the cluster's promise on the line itself ("Collect at Malva SoHo", "Delivery", "Every 2 weeks").
 */
export function LineMarker({ line }: { line: CartLine }) {
  const t = useTranslations('checkout.cluster');
  const interval = useIntervalLabel();
  const text =
    line.fulfilment === 'collect'
      ? t('lineCollect', { store: storeName(line) })
      : line.fulfilment === 'subscribe' && line.recurrence
        ? interval(line.recurrence.schedule)
        : t('lineDelivery');
  const icon = line.fulfilment === 'collect' ? 'store' : line.fulfilment === 'subscribe' ? 'repeat' : 'truck';
  return (
    <span
      data-testid="fulfilment-marker"
      data-fulfilment={line.fulfilment}
      className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${line.fulfilment === 'collect' ? 'text-teal-text' : 'text-ink-3'}`}
    >
      <Icon name={icon} size={14} />
      {text}
    </span>
  );
}

/** One line inside a cluster on the Review stage. */
export default function ClusterLine({ line }: { line: CartLine }) {
  const t = useTranslations('checkout.summary');
  const money = useMoney();
  return (
    <li data-line-id={line.id} className="flex items-start gap-3.5 border-t border-line py-3.5 first:border-t-0">
      <LineImage {...(line.imageUrl ? { url: line.imageUrl } : {})} alt={line.imageAlt} width={48} height={58} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[14px] font-semibold text-ink">{line.name}</p>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-3">
          {[line.variantSummary, t('quantity', { quantity: line.quantity })].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-1">
          <LineMarker line={line} />
        </div>
      </div>
      <span className="shrink-0 text-[14px] font-semibold text-ink">{money(line.total)}</span>
    </li>
  );
}
