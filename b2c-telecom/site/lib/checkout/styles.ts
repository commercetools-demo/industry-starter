// Maps the site's design tokens to the only variables the hosted Checkout accepts (docs: checkout/custom-style). The widget runs in its own
// frame, so it cannot read our CSS: the VALUES are resolved from the live tokens here. Any other variable would be ignored by the widget.

/** SDK variable to the token it takes its value from. */
export const CHECKOUT_STYLE_TOKENS: Record<string, string> = {
  '--font-family': '--font-body',
  '--button': '--color-action',
  '--button-outline': '--color-action',
  '--button-hover': '--color-action-hover',
  '--button-text': '--color-text-on-pink',
  '--button-disabled': '--color-neutral-300',
  '--button-disabled-text': '--color-neutral-600',
  '--input-field-focus': '--color-action',
  '--checkbox': '--color-action',
  '--radio': '--color-action',
  '--spinner': '--color-action',
};

const readFromDocument = (token: string): string => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(token).trim());

/** The `styles` object of `paymentFlow` / `checkoutFlow`; a token that does not resolve is left out (the widget keeps its default). */
export function checkoutStyles(read: (token: string) => string = readFromDocument): Record<string, string> {
  const styles: Record<string, string> = {};
  for (const [variable, token] of Object.entries(CHECKOUT_STYLE_TOKENS)) {
    const value = read(token);
    if (value) styles[variable] = value;
  }
  return styles;
}
