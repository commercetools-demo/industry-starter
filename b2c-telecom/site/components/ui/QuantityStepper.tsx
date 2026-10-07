'use client';

import type { ReactElement } from 'react';
import { cx } from '@/lib/cx';
import { FOCUS_RING } from './focus';

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: string;
  className?: string;
};

const STEP_BUTTON =
  'inline-flex size-11 items-center justify-center rounded-pill border-2 border-action bg-transparent font-cta text-lg font-extrabold text-action hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-50';

/** Round - / + buttons around a live value. All strings come from the caller (translated). */
export function QuantityStepper({ value, min = 1, max = 5, onChange, decreaseLabel, increaseLabel, valueLabel, className }: QuantityStepperProps): ReactElement {
  const clamp = (n: number): number => Math.min(max, Math.max(min, n));
  const current = clamp(value);
  const set = (next: number): void => {
    const clamped = clamp(next);
    if (clamped !== current) onChange(clamped);
  };
  return (
    <div role="group" aria-label={valueLabel} className={cx('inline-flex items-center gap-5', className)}>
      <button type="button" aria-label={decreaseLabel} disabled={current <= min} onClick={() => set(current - 1)} className={cx(STEP_BUTTON, FOCUS_RING)}>
        <span aria-hidden="true">−</span>
      </button>
      <span aria-live="polite" className="min-w-6 text-center font-display text-lg font-semibold">
        {current}
      </span>
      <button type="button" aria-label={increaseLabel} disabled={current >= max} onClick={() => set(current + 1)} className={cx(STEP_BUTTON, FOCUS_RING)}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
