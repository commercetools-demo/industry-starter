import { CHECKOUT_STYLE_TOKENS, checkoutStyles } from './styles';

// The variables the hosted Checkout accepts (docs: checkout/custom-style). Anything else is ignored by the widget.
const ALLOWED = ['--font-family', '--button', '--button-outline', '--button-hover', '--button-text', '--button-disabled', '--button-disabled-text', '--input-field-focus', '--checkbox', '--radio', '--spinner'];

describe('checkoutStyles', () => {
  it('only uses variables the Checkout documents', () => {
    for (const variable of Object.keys(CHECKOUT_STYLE_TOKENS)) expect(ALLOWED).toContain(variable);
  });
  it('takes every value from a design token, and leaves out what does not resolve', () => {
    const values: Record<string, string> = { '--color-action': 'rgb(1, 2, 3)', '--font-body': 'Roboto, sans-serif' };
    const styles = checkoutStyles((token) => values[token] ?? '');
    expect(styles['--button']).toBe('rgb(1, 2, 3)');
    expect(styles['--spinner']).toBe('rgb(1, 2, 3)');
    expect(styles['--font-family']).toBe('Roboto, sans-serif');
    expect(styles['--button-hover']).toBeUndefined();
  });
  it('is empty outside a browser document', () => {
    expect(checkoutStyles(() => '')).toEqual({});
  });
});
