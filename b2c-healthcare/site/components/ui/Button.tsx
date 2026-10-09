import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { Link } from '@/i18n/routing';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'outline' | 'navy';
export type ButtonSize = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap border-thick font-display text-sm font-medium cursor-pointer transition-colors';
const VARIANTS: Record<ButtonVariant, string> = {
  // Label is navy-900 on the azure fill (white is 2.6:1); the hover label has its own token.
  primary:
    'border-action bg-action text-action-label hover:border-action-hover hover:bg-action-hover hover:text-action-label-hover',
  outline: 'border-action bg-surface text-brand-700 hover:bg-brand-50 hover:text-brand-800',
  navy: 'border-navy-700 bg-navy-700 text-text-on-brand hover:bg-navy-800 hover:text-text-on-brand',
};
const SIZES: Record<ButtonSize, string> = {
  md: 'rounded-md px-5.5 py-3',
  sm: 'rounded-sm px-3.5 py-2',
};
const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-45';

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}

export function buttonClasses({ variant = 'primary', size = 'md', full }: StyleProps, extra?: string): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], full && 'w-full', DISABLED, extra);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  /** Shows a pending state: the button is disabled and announced as busy. */
  busy?: boolean;
}

/** A real `button`. `busy` disables it (no double submit) and sets aria-busy. */
export function Button({ variant, size, full, busy, disabled, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, full }, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-variant={variant ?? 'primary'}
      {...rest}
    />
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** A locale-aware link that looks like a button (navigation, so a real `a`). */
export function ButtonLink({ variant, size, full, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, full }, className)} data-variant={variant ?? 'primary'} {...rest} />;
}
