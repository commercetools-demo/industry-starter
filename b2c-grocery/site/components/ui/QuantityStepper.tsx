'use client';

import { Minus, Plus } from 'lucide-react';
import { Icon } from './Icon';
import { cx } from './cx';

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  /** Accessible name of the whole control, e.g. "Quantity". */
  label?: string;
  disabled?: boolean;
  className?: string;
};

/** Pill with - / + buttons. Never emits a value outside [min, max]; the buttons disable at the limits. */
export function QuantityStepper({ value, min = 1, max, onChange, decreaseLabel, increaseLabel, label, disabled, className }: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  return (
    <div role="group" aria-label={label} className={cx('inline-flex items-center rounded-full border border-divider', className)}>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={decreaseLabel}
        disabled={disabled || atMin}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon icon={Minus} size={14} />
      </button>
      <output aria-live="polite" className="min-w-[26px] text-center text-sm">
        {value}
      </output>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={increaseLabel}
        disabled={disabled || atMax}
        onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}
      >
        <Icon icon={Plus} size={14} />
      </button>
    </div>
  );
}
