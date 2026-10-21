'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import type { CartLine } from '@/lib/types';
import { storeName, useIntervalLabel } from './use-cart-ui';

/**
 * The per-line fulfilment mark (D-033): icon and text, never colour alone, on every line inside its cluster.
 * `drawer` reads like a sentence ("Collect at Malva SoHo", "Ship to me", "Delivers every 2 weeks"); `page` is the short
 * badge ("Collect · Malva SoHo", "Ships to you", "Every 2 weeks").
 */
export default function FulfilmentBadge({ line, variant }: { line: CartLine; variant: 'drawer' | 'page' }) {
  const t = useTranslations('cart.line');
  const interval = useIntervalLabel();
  const label = line.recurrence ? interval(line.recurrence.schedule) : '';
  const lower = label ? label.charAt(0).toLowerCase() + label.slice(1) : '';

  let text: string;
  if (line.fulfilment === 'collect') {
    text = variant === 'drawer' ? t('fulfil.collect', { store: storeName(line) }) : t('badge.collect', { store: storeName(line) });
  } else if (line.fulfilment === 'subscribe') {
    text = variant === 'drawer' ? t('fulfil.subscribe', { interval: lower }) : label || t('badge.ship');
  } else {
    text = variant === 'drawer' ? t('fulfil.delivery') : t('badge.ship');
  }
  const icon = line.fulfilment === 'collect' ? 'store' : line.fulfilment === 'subscribe' ? 'repeat' : 'truck';
  return (
    <span
      data-testid="fulfilment-badge"
      data-fulfilment={line.fulfilment}
      className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${line.fulfilment === 'collect' ? 'text-teal-text' : 'text-ink-3'}`}
    >
      <Icon name={icon} size={14} />
      {text}
    </span>
  );
}
