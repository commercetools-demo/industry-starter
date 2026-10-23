import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export default function Chip({ active = false, className, type = 'button', ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        'transition-state whitespace-nowrap rounded-pill border px-4 py-[9px] text-[13px] font-medium',
        active ? 'border-ink bg-ink text-surface' : 'border-line-2 bg-surface text-ink hover:border-ink',
        className,
      )}
      {...props}
    />
  );
}
