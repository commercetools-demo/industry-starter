'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';

const BUTTON =
  'transition-press flex h-[38px] w-[38px] items-center justify-center rounded-pill border-0 bg-transparent text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40';

/**
 * Cart quantity stepper. The floor is 1: at 1 the minus is `aria-disabled` and does nothing (removal is only the Remove
 * button, spec "Quantity floor"). While a request is pending both buttons are `aria-disabled`, so a double click sends
 * one request. The value is announced politely.
 */
export default function QuantityStepper({
  value, max, name, pending, onChange,
}: {
  value: number;
  max: number;
  /** Product name for the group label. */
  name: string;
  pending: boolean;
  onChange: (quantity: number) => void;
}) {
  const t = useTranslations('cart.line.qty');
  const atFloor = value <= 1;
  const atCeiling = value >= max;
  return (
    <div role="group" aria-label={t('label', { name })} className="inline-flex items-center rounded-pill border border-line-2 bg-surface">
      <button
        type="button"
        className={BUTTON}
        aria-label={t('decrease')}
        aria-disabled={atFloor || pending}
        onClick={() => {
          if (!atFloor && !pending) onChange(value - 1);
        }}
      >
        <Icon name="minus" size={14} />
      </button>
      <output aria-live="polite" aria-label={t('value', { count: value })} className="min-w-8 text-center font-mono text-[14px] font-medium">
        {value}
      </output>
      <button
        type="button"
        className={BUTTON}
        aria-label={t('increase')}
        aria-disabled={atCeiling || pending}
        onClick={() => {
          if (!atCeiling && !pending) onChange(value + 1);
        }}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}
