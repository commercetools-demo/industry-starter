import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import Icon, { type IconName } from './Icon';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; required because the control has no visible text. */
  label: string;
  icon: IconName;
  badgeCount?: number;
}

export default function IconButton({ label, icon, badgeCount, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={badgeCount !== undefined && badgeCount > 0 ? `${label} (${badgeCount})` : label}
      className={cn(
        'transition-state relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-0 bg-transparent text-ink hover:bg-ink/6 disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={20} />
      {badgeCount !== undefined && badgeCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-1 font-mono text-[10px] font-medium text-surface"
        >
          {badgeCount}
        </span>
      ) : null}
    </button>
  );
}
