'use client';

import { useTranslations } from 'next-intl';
import Icon from './Icon';

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Accessible name of the group, for example the product name. */
  label: string;
  disabled?: boolean;
}

const BUTTON =
  'transition-press flex h-[38px] w-[38px] items-center justify-center rounded-pill border-0 bg-transparent text-ink disabled:cursor-not-allowed disabled:opacity-40';

export default function Stepper({ value, min = 1, max = 99, onChange, label, disabled = false }: StepperProps) {
  const t = useTranslations('ui.stepper');
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-pill border border-line-2 bg-surface">
      <button
        type="button"
        className={BUTTON}
        aria-label={t('decrease')}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon name="minus" size={16} />
      </button>
      <span aria-live="polite" className="min-w-8 text-center font-mono text-[14px] font-medium">
        {value}
      </span>
      <button
        type="button"
        className={BUTTON}
        aria-label={t('increase')}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
