/**
 * Style variables for the hosted checkout (`checkoutFlow({ styles })`). The hosted iframe cannot read our CSS, so the
 * values are resolved from the design tokens at run time (globals.css stays the only file with hex colours).
 * Only the variables documented at https://docs.commercetools.com/checkout/custom-style are honoured.
 */
const TOKENS = {
  '--button': '--color-accent',
  '--button-outline': '--color-accent',
  '--button-hover': '--color-accent-600',
  '--button-text': '--color-bg',
  '--button-disabled': '--color-neutral-300',
  '--button-disabled-text': '--color-neutral-600',
  '--input-field-focus': '--color-text',
  '--checkbox': '--color-accent',
  '--radio': '--color-accent',
  '--spinner': '--color-accent',
} as const;

/** System font stack: the hosted frame does not load our web fonts. */
const FONT_FAMILY = 'system-ui';

export function checkoutStyles(root: Element = document.documentElement): Record<string, string> {
  const computed = getComputedStyle(root);
  const styles: Record<string, string> = { '--font-family': FONT_FAMILY };
  for (const [variable, token] of Object.entries(TOKENS)) {
    const value = computed.getPropertyValue(token).trim();
    if (value) styles[variable] = value;
  }
  return styles;
}
