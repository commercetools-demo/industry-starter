/**
 * Hosted Checkout theme (workstream K, 3.9). The values are read from our design tokens at run time (`getComputedStyle` of the
 * document element), so a token change reaches the widget and no colour or font literal lives in code. The variable names are the
 * ones Checkout documents (the Checkout "Customize the style" page); any other variable is ignored by the widget.
 */
const MAP: Record<string, string> = {
  '--font-family': '--font-body',
  '--button': '--ink',
  '--button-outline': '--ink',
  '--button-hover': '--accent-press',
  '--button-text': '--surface',
  '--button-disabled': '--line-2',
  '--button-disabled-text': '--ink-3',
  '--input-field-focus': '--accent',
  '--checkbox': '--accent',
  '--radio': '--accent',
  '--spinner': '--accent',
};

/** The SDK `styles` object. Variables that resolve to nothing are left out, so the widget keeps its own default. */
export function readCheckoutTheme(root: Element = document.documentElement): Record<string, string> {
  const computed = getComputedStyle(root);
  const out: Record<string, string> = {};
  for (const [sdkName, token] of Object.entries(MAP)) {
    const value = computed.getPropertyValue(token).trim();
    if (value) out[sdkName] = value;
  }
  return out;
}

export const THEME_TOKENS = Object.values(MAP);
