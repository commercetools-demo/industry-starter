import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { FOCUS_RING, FOCUS_RING_ON_BRAND } from './focus';
import { SpinnerIcon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost';

type CommonProps = {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  pressed?: boolean;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
};

type ButtonAsButton = CommonProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;
type ButtonAsLink = CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'>;
export type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-action text-text-on-pink hover:bg-action-hover',
  secondary: 'border-2 border-action bg-transparent text-action hover:bg-pink-50',
  dark: 'bg-brand-950 text-text-on-pink',
  ghost: 'text-text-link underline-offset-4 hover:underline',
};

const SIZE = { md: 'min-h-11 px-6', sm: 'min-h-9 px-4' } as const;

/** Pill button (or link) in four variants. `pressed` is the toggle CTA ("Choose plan" / "Selected"). */
export function Button(props: ButtonProps): ReactElement {
  const { variant = 'primary', size = 'md', pressed, loading, block, children, ...rest } = props;
  const filledPressed = pressed === true && variant === 'secondary';
  const classes = cx(
    'inline-flex items-center justify-center gap-3 rounded-pill font-cta text-md font-extrabold no-underline',
    SIZE[size],
    filledPressed ? VARIANT.primary : VARIANT[variant],
    variant === 'dark' ? FOCUS_RING_ON_BRAND : FOCUS_RING,
    block && 'w-full',
    'disabled:cursor-not-allowed disabled:opacity-50',
  );
  const content = (
    <>
      {loading ? <SpinnerIcon className="motion-safe:animate-spin" /> : null}
      {children}
    </>
  );

  if (typeof props.href === 'string') {
    const { className, ...anchor } = rest as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>;
    return (
      <Link {...anchor} href={props.href} className={cx(classes, className)} aria-pressed={pressed} aria-busy={loading || undefined}>
        {content}
      </Link>
    );
  }
  const { className, type = 'button', disabled, ...button } = rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;
  return (
    <button
      {...button}
      type={type}
      className={cx(classes, className)}
      disabled={disabled || loading}
      aria-pressed={pressed}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}
