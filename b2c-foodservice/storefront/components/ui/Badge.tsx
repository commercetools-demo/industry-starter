import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'ink' | 'accent';
}

export default function Badge({ variant = 'ink', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-surface',
        variant === 'ink' ? 'bg-ink' : 'bg-accent',
        className,
      )}
      {...props}
    />
  );
}
