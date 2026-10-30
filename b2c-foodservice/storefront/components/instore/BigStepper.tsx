'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

const BUTTON =
  'transition-press flex h-14 w-14 shrink-0 items-center justify-center rounded-pill border-0 bg-transparent text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40';

/**
 * Quantity stepper with 56 px buttons (workstream R: a thumb in a store, one hand, a bag in the other). Buttons are
 * `aria-disabled` rather than `disabled`, so a shopper at the limit can still reach them and hear why nothing happens.
 */
export default function BigStepper({
  value, min = 1, max = 99, onChange, label, pending = false, className,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Accessible name of the group, for example "Quantity of Ember Ristretto". */
  label: string;
  pending?: boolean;
  className?: string;
}) {
  const t = useTranslations('ui.stepper');
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center rounded-pill border border-line-2 bg-surface', className)}>
      <button
        type="button"
        className={BUTTON}
        aria-label={t('decrease')}
        aria-disabled={atMin || pending}
        onClick={() => {
          if (!atMin && !pending) onChange(value - 1);
        }}
      >
        <Icon name="minus" size={22} />
      </button>
      <output aria-live="polite" className="min-w-10 text-center font-mono text-[20px] font-semibold">
        {value}
      </output>
      <button
        type="button"
        className={BUTTON}
        aria-label={t('increase')}
        aria-disabled={atMax || pending}
        onClick={() => {
          if (!atMax && !pending) onChange(value + 1);
        }}
      >
        <Icon name="plus" size={22} />
      </button>
    </div>
  );
}
