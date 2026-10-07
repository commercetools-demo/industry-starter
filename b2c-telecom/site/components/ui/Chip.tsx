'use client';

import type { ReactElement, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { FOCUS_RING } from './focus';

type ChipProps = {
  selected: boolean;
  count?: number;
  onClick: () => void;
  className?: string;
  children: ReactNode;
};

/** Filter chip: a toggle button; `count` is right-aligned ("N plans"). */
export function Chip({ selected, count, onClick, className, children }: ChipProps): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-11 items-center gap-3 rounded-pill px-5 py-3 font-display text-sm font-semibold',
        selected ? 'bg-brand-950 text-text-on-pink' : 'bg-brand-100 text-brand-950 hover:bg-brand-200',
        FOCUS_RING,
        className,
      )}
    >
      <span>{children}</span>
      {count === undefined ? null : (
        <>
          {' '}
          <span className="ml-auto">{count}</span>
        </>
      )}
    </button>
  );
}
