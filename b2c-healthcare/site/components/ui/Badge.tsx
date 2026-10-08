import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export type BadgeVariant = 'ok' | 'wait' | 'info' | 'no' | 'neutral';

// Text uses the -700 tokens (AA on the -50 fill); the 500 status colours fail on it.
const VARIANTS: Record<BadgeVariant, string> = {
  ok: 'bg-success-50 text-success-700',
  wait: 'bg-warning-50 text-warning-700',
  info: 'bg-info-50 text-info-700',
  no: 'bg-danger-50 text-danger-700',
  neutral: 'bg-neutral-50 text-neutral-600',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      data-variant={variant}
      className={cx('inline-block rounded-sm px-2.5 py-0.75 font-meta text-xs font-bold', VARIANTS[variant], className)}
      {...rest}
    />
  );
}
