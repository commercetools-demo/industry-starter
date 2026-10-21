import { describe, expect, it } from 'vitest';
import { readCss, ruleBody } from '@/test/css';

const css = readCss('app/typography.css');
const util = (name: string) => {
  const body = ruleBody(css, new RegExp(`@utility ${name}\\s*\\{`));
  expect(body, name).not.toBeNull();
  return body as string;
};

describe('Typography', () => {
  it('Page title is Archivo 800 at 34 to 40px with -0.025em tracking', () => {
    const b = util('page-title');
    expect(b).toContain('font-family: var(--font-display)');
    expect(b).toContain('font-weight: 800');
    expect(b).toMatch(/font-size: clamp\(34px, [^,]+, 40px\)/);
    expect(b).toContain('letter-spacing: -0.025em');
  });

  it('Hero title scales with clamp(44px, 5.6vw, 82px)', () => {
    const b = util('hero-title');
    expect(b).toContain('clamp(44px, 5.6vw, 82px)');
    expect(b).toContain('font-weight: 800');
  });

  it('Eyebrow is 11px uppercase 0.18em weight 600', () => {
    const b = util('eyebrow');
    expect(b).toContain('font-size: 11px');
    expect(b).toContain('text-transform: uppercase');
    expect(b).toContain('letter-spacing: 0.18em');
    expect(b).toContain('font-weight: 600');
  });

  it('Wordmark is Archivo 800 with 0.16em spacing', () => {
    const b = util('wordmark');
    expect(b).toContain('font-family: var(--font-display)');
    expect(b).toContain('font-weight: 800');
    expect(b).toContain('letter-spacing: 0.16em');
  });

  it('Body is 15px with line-height 1.55', () => {
    const b = ruleBody(css, /^body\s*\{/m) as string;
    expect(b).toContain('font-size: 15px');
    expect(b).toContain('line-height: 1.55');
  });

  it('Every control shows a visible focus outline', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline: 2px solid var\(--accent\)/);
  });

  it('Layout loads Archivo, Roboto and Roboto Mono with their variables', () => {
    const src = readCss('app/layout.tsx');
    for (const v of ['--font-archivo', '--font-roboto', '--font-roboto-mono']) expect(src).toContain(v);
    for (const f of ['Archivo', 'Roboto', 'Roboto_Mono']) expect(src).toContain(f);
    expect(src).toContain('NextIntlClientProvider');
  });
});
