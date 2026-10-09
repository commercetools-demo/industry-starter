import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { Link } from '@/i18n/routing';

export type ButtonVariant = 'primary' | 'outline' | 'white' | 'outline-white';
const CLASS: Record<ButtonVariant, string> = { primary: 'btn', outline: 'btn o', white: 'btn w', 'outline-white': 'btn ow' };
const classes = (variant: ButtonVariant, small?: boolean, extra?: string) => [CLASS[variant], small ? 'sm' : '', extra ?? ''].filter(Boolean).join(' ');

export function Button({ variant = 'primary', small, className, type = 'button', ...props }: { variant?: ButtonVariant; small?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes(variant, small, className)} {...props} />;
}

/** A link that looks like a button. Uses the locale-aware Link. */
export function LinkButton({ variant = 'primary', small, className, ...props }: { variant?: ButtonVariant; small?: boolean } & ComponentProps<typeof Link>) {
  return <Link className={classes(variant, small, className)} {...props} />;
}
