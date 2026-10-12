// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure: maps the store's COMPUTED theme tokens to the `styles` option of the hosted Checkout (O D4). The SDK accepts only the variables
// listed in "Customize the style of Checkout" (font family and ten colours); it needs concrete values, so the caller reads them with
// `getComputedStyle(document.documentElement)` at runtime, which carries the reseller's theme. No colour or font appears in this file.

/** SDK variable -> store token it is taken from. */
export const CHECKOUT_STYLE_TOKENS = {
  '--button': '--color-action',
  '--button-outline': '--color-action',
  '--button-hover': '--color-action-hover',
  '--button-text': '--color-text-on-brand',
  '--button-disabled': '--color-border-strong',
  '--button-disabled-text': '--color-text-subtle',
  '--input-field-focus': '--color-focus',
  '--checkbox': '--color-action',
  '--radio': '--color-action',
  '--spinner': '--color-action',
} as const;

export type CheckoutStyles = Partial<Record<keyof typeof CHECKOUT_STYLE_TOKENS | '--font-family', string>>;

/** `readToken('--color-action')` returns the computed value (empty when the token is not defined). Missing tokens are left out. */
export function buildCheckoutStyles(readToken: (name: string) => string): CheckoutStyles {
  const styles: CheckoutStyles = {};
  for (const [variable, token] of Object.entries(CHECKOUT_STYLE_TOKENS)) {
    const value = readToken(token).trim();
    if (value) styles[variable as keyof typeof CHECKOUT_STYLE_TOKENS] = value;
  }
  // The SDK takes ONE font family: the first of the `--font-ui` stack, quotes removed.
  const family = readToken('--font-ui').split(',')[0]?.replace(/["']/g, '').trim();
  if (family) styles['--font-family'] = family;
  return styles;
}
