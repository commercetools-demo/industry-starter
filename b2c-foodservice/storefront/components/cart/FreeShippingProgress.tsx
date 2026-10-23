'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import type { Cart } from '@/lib/types';
import { useMoney } from './use-cart-ui';

/**
 * Free-shipping progress (drawer, shared with the page). The threshold comes from the market's shipping rate, never a
 * constant, and only lines that ship count (Q-I-03). Hidden when the market has no threshold or the bag has no shippable
 * line. At or above the threshold: a teal check and "You've unlocked free shipping".
 */
export default function FreeShippingProgress({ freeShipping }: { freeShipping: Cart['freeShipping'] }) {
  const t = useTranslations('cart.progress');
  const money = useMoney();
  const { threshold, remaining, reached } = freeShipping;
  if (!threshold || (!reached && !remaining)) return null;

  if (reached) {
    return (
      <p role="status" className="m-0 flex items-center gap-2 rounded-field bg-canvas-2 px-3.5 py-3 text-[13px] font-semibold text-teal-text">
        <Icon name="check" size={16} />
        {t('unlocked')}
      </p>
    );
  }
  const left = remaining!.centAmount;
  const pct = Math.min(100, Math.max(0, Math.round(((threshold.centAmount - left) / threshold.centAmount) * 100)));
  return (
    <div className="rounded-field bg-canvas-2 px-3.5 py-3">
      <p className="m-0 mb-2 text-[12.5px] text-ink-2">{t('remaining', { amount: money(remaining!) })}</p>
      <div
        role="progressbar"
        aria-label={t('label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={t('remaining', { amount: money(remaining!) })}
        className="h-[5px] overflow-hidden rounded-pill bg-line"
      >
        <div className="transition-state h-full rounded-pill bg-teal" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
