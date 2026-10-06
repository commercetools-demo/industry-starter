'use client';

import { Heart } from 'lucide-react';
import { Icon } from './Icon';
import { cx } from './cx';

type HeartButtonProps = {
  pressed: boolean;
  onToggle: () => void;
  /** Accessible name, e.g. "Save to list". */
  label: string;
  disabled?: boolean;
  className?: string;
};

/** Save toggle: outline when off, filled `currentColor` in the accent when pressed. */
export function HeartButton({ pressed, onToggle, label, disabled, className }: HeartButtonProps) {
  return (
    <button
      type="button"
      className={cx('btn btn-icon bg-bg', pressed && 'text-accent', className)}
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
    >
      <Icon icon={Heart} size={17} fill={pressed ? 'currentColor' : 'none'} />
    </button>
  );
}
