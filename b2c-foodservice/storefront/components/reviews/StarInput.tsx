'use client';

import { useTranslations } from 'next-intl';
import { forwardRef, useRef, useState, type KeyboardEvent } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

export interface StarInputProps {
  value: number;
  onChange: (rating: number) => void;
  /** Id of the element that names the group (the visible "Your rating" label). */
  labelId: string;
  invalid?: boolean;
  /** Id of the error text, when shown. */
  describedBy?: string;
}

/**
 * Five star buttons as a `radiogroup`: roving tabindex (the selected star, else the first, is the tab stop), arrow keys
 * move and select, hover and focus preview the fill. Each target is 44 px.
 */
const StarInput = forwardRef<HTMLDivElement, StarInputProps>(function StarInput({ value, onChange, labelId, invalid, describedBy }, ref) {
  const t = useTranslations('reviews.form');
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;

  const choose = (n: number, focus: boolean) => {
    onChange(n);
    if (focus) buttons.current[n - 1]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, n: number) => {
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(5, n + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(1, n - 1)
      : e.key === 'Home' ? 1
      : e.key === 'End' ? 5
      : null;
    if (next === null) return;
    e.preventDefault();
    choose(next, true);
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="inline-flex"
      onMouseLeave={() => setPreview(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const tabStop = value ? n === value : n === 1;
        return (
          <button
            key={n}
            ref={(el) => {
              buttons.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('star', { n })}
            tabIndex={tabStop ? 0 : -1}
            onClick={() => choose(n, false)}
            onKeyDown={(e) => onKeyDown(e, n)}
            onMouseEnter={() => setPreview(n)}
            onFocus={() => setPreview(null)}
            className={cn(
              'inline-flex h-11 w-11 items-center justify-center rounded-pill bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              invalid && 'text-danger-text',
            )}
          >
            <Icon name="star" size={26} fill={n <= shown ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );
});

export default StarInput;
