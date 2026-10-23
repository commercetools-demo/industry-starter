import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'ink' | 'accent' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  ink: 'bg-ink text-surface hover:bg-ink/90',
  accent: 'bg-accent text-surface hover:bg-accent-press',
  ghost: 'bg-transparent text-ink border-line-2 hover:border-ink',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'px-[26px] py-[14px] text-[14px]',
  lg: 'px-[30px] py-[17px] text-[15px]',
};

/** Class string shared by Button, ButtonLink and any element that must look like a button. */
export function buttonClasses({
  variant = 'ink',
  size = 'md',
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}): string {
  return cn(
    'transition-press inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-pill border border-transparent font-display font-semibold tracking-[0.01em] active:scale-[0.985] aria-disabled:pointer-events-none aria-disabled:opacity-40 disabled:pointer-events-none disabled:opacity-40',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
  );
}

export default function Button({
  variant,
  size,
  block,
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses({ variant, size, block }), className)}
      {...props}
    >
      {children}
    </button>
  );
}
