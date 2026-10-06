'use client';

import { useId } from 'react';
import { cx } from './cx';

export type SegmentedOption = { value: string; label: string; disabled?: boolean };

type SegmentedProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the group. */
  label: string;
  name?: string;
  className?: string;
};

/** Pill-shaped single choice built from real radios; the selected option fills with the accent. */
export function Segmented({ options, value, onChange, label, name, className }: SegmentedProps) {
  const generated = useId();
  const group = name ?? generated;
  return (
    <div role="radiogroup" aria-label={label} className={cx('seg', className)}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cx('seg-opt has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent', option.disabled && 'opacity-45 cursor-not-allowed')}
        >
          <input
            type="radio"
            name={group}
            value={option.value}
            checked={option.value === value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
