import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const globals = readFileSync(resolve(__dirname, 'globals.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('Keyboard focus', () => {
  it('Keyboard focus: :focus-visible outlines every interactive element with the focus-ring token', () => {
    const css = stripComments(globals);
    const rule = /([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    const selectors = rule?.[1] ?? '';
    for (const el of ['a', 'button', 'input', 'select', 'textarea', '[tabindex]']) {
      expect(selectors).toContain(`${el}:focus-visible`);
    }
    expect(rule?.[2]).toMatch(/outline:\s*var\(--focus-ring\)/);
  });

  it('Keyboard focus: the focus ring is a brand token', () => {
    expect(tokens).toMatch(/--focus-ring:\s*2px solid var\(--color-brand-\d+\)/);
  });

  it('Keyboard focus: globals.css never removes an outline without a replacement', () => {
    const css = stripComments(globals);
    const blocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)];
    for (const [, selector, body] of blocks) {
      if (/outline(-style)?\s*:\s*(0|none)\b/.test(body)) {
        // allowed only when the same rule gives a visible replacement
        expect(body, selector.trim()).toMatch(/box-shadow\s*:|border\s*:|outline\s*:\s*var\(--focus-ring\)/);
      }
    }
    expect(css).not.toMatch(/outline\s*:\s*(0|none)\b/);
  });
});
