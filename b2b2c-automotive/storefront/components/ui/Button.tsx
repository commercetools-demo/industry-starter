// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'link';

// Tokens only. `min-h-7` is the 48 px spacing token (controls stay at least 44 px).
const BASE = 'inline-flex min-h-7 items-center justify-center gap-2 font-display text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60';
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'rounded-sm bg-action px-5 text-text-on-brand hover:bg-action-hover active:bg-action-active',
  secondary: 'rounded-sm border border-border-brand bg-surface px-5 text-action hover:bg-action-subtle',
  link: 'px-2 font-utility text-text-link underline-offset-2 hover:underline',
};

export const buttonClass = (variant: ButtonVariant = 'primary', extra = ''): string => `${BASE} ${VARIANTS[variant]} ${extra}`.trim();

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}
