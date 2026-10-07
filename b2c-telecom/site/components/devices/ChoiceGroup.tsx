'use client';

import { useId, type ReactElement } from 'react';
import { cx } from '@/lib/cx';

export interface Choice {
  value: string;
  label: string;
  disabled?: boolean;
}

type ChoiceGroupProps = {
  /** Accessible name of the group (also the visible caption unless `hideLabel`). */
  label: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  /** Id of text that explains why a choice is disabled (read with the choices). */
  describedBy?: string;
};

/**
 * Pill choices as native radios: the browser gives the group semantics, the checked state and the arrow-key movement. Disabled
 * choices stay visible (never hidden); the caller shows the reason in text and passes its id as `describedBy`.
 */
export function ChoiceGroup({ label, choices, value, onChange, describedBy }: ChoiceGroupProps): ReactElement {
  const name = useId();
  return (
    <div className="flex flex-col gap-3">
      <span className="font-display text-sm font-semibold">{label}</span>
      <div role="radiogroup" aria-label={label} aria-describedby={describedBy} className="flex flex-wrap gap-3">
        {choices.map((choice) => (
          <label key={choice.value} className={cx('relative inline-flex', choice.disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
            <input type="radio" name={name} value={choice.value} checked={choice.value === value} disabled={choice.disabled} onChange={() => onChange(choice.value)} className="peer sr-only" />
            <span
              className={cx(
                'inline-flex min-h-11 items-center rounded-pill border-2 border-border bg-surface px-5 py-3 font-display text-sm font-semibold text-text',
                'peer-checked:border-action peer-checked:bg-pink-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action',
                choice.disabled && 'opacity-60 line-through',
              )}
            >
              {choice.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
