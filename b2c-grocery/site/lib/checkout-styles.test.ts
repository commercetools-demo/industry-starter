import { describe, expect, it } from 'vitest';
import { checkoutStyles } from './checkout-styles';

describe('checkoutStyles', () => {
  it('resolves the documented variables from the design tokens', () => {
    const root = document.createElement('div');
    root.style.setProperty('--color-accent', '#c67139');
    root.style.setProperty('--color-bg', '#f5ead8');
    document.body.append(root);
    const styles = checkoutStyles(root);
    expect(styles['--button']).toBe('#c67139');
    expect(styles['--button-text']).toBe('#f5ead8');
    expect(styles['--font-family']).toBe('system-ui');
    expect(styles).not.toHaveProperty('--button-hover'); // token missing: skipped, not empty
    root.remove();
  });
});
