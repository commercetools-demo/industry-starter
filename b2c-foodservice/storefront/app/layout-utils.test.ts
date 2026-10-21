import { describe, expect, it } from 'vitest';
import { readCss, rootTokens, ruleBody, themeTokens } from '@/test/css';

const tokensCss = readCss('app/tokens.css');
const tokens = rootTokens(tokensCss);
const theme = themeTokens(tokensCss);
const motion = readCss('app/motion.css');

describe('Shape, spacing and motion', () => {
  it('Radii are pill, 10, 16, 24 and 32', () => {
    expect(tokens['--radius-pill']).toBe('999px');
    expect(tokens['--radius-field']).toBe('10px');
    expect(tokens['--radius-card']).toBe('16px');
    expect(tokens['--radius-panel']).toBe('24px');
    expect(tokens['--radius-hero']).toBe('32px');
  });

  it('Durations are 120, 200 and 320 ms', () => {
    expect(tokens['--dur-press']).toBe('120ms');
    expect(tokens['--dur-state']).toBe('200ms');
    expect(tokens['--dur-drawer']).toBe('320ms');
    expect(ruleBody(motion, /@utility transition-press\s*\{/)).toContain('var(--dur-press)');
    expect(ruleBody(motion, /@utility transition-state\s*\{/)).toContain('var(--dur-state)');
    expect(ruleBody(motion, /@utility transition-drawer\s*\{/)).toContain('var(--dur-drawer)');
  });

  it('Spacing keeps the Tailwind 4px step', () => {
    expect(theme).not.toHaveProperty(['--spacing']);
  });

  it('Content never hidden at rest: the entrance keyframes are transform-only and wrapped in prefers-reduced-motion no-preference', () => {
    const keyframes = ruleBody(motion, /@keyframes fadeUp\s*\{/) as string;
    expect(keyframes).toContain('translateY(10px)');
    expect(keyframes).not.toMatch(/opacity|visibility/);
    const util = ruleBody(motion, /@utility fade-up\s*\{/) as string;
    const guarded = ruleBody(util, /@media \(prefers-reduced-motion: no-preference\)\s*\{/) as string;
    expect(guarded).toContain('animation: fadeUp');
    expect(util.replace(guarded, '')).not.toContain('animation');
  });

  it('Reduced motion removes animation durations', () => {
    const body = ruleBody(motion, /@media \(prefers-reduced-motion: reduce\)\s*\{/) as string;
    expect(body).toContain('animation-duration: 0.01ms !important');
    expect(body).toContain('transition-duration: 0.01ms !important');
  });
});

describe('Breakpoints', () => {
  it('Phone: breakpoints are defined at 520, 700, 820, 900 and 1080 px', () => {
    expect(theme['--breakpoint-*']).toBe('initial');
    expect(theme['--breakpoint-xs']).toBe('520px');
    expect(theme['--breakpoint-narrow']).toBe('700px');
    expect(theme['--breakpoint-mobile']).toBe('820px');
    expect(theme['--breakpoint-stack']).toBe('900px');
    expect(theme['--breakpoint-grid3']).toBe('1080px');
  });

  it('Phone: grid-products is 4, then 3 below 1080 and 2 below 820 columns', () => {
    const body = ruleBody(motion, /@utility grid-products\s*\{/) as string;
    expect(body).toMatch(/grid-template-columns: repeat\(4,/);
    expect(ruleBody(body, /@media \(width < 1080px\)\s*\{/)).toMatch(/repeat\(3,/);
    const small = ruleBody(body, /@media \(width < 820px\)\s*\{/) as string;
    expect(small).toMatch(/repeat\(2,/);
    expect(small).toContain('gap: 20px 16px');
    expect(body).toContain('gap: 28px 24px');
  });

  it('Phone: wrap padding is 32px and 20px under 820px', () => {
    const body = ruleBody(motion, /@utility wrap\s*\{/) as string;
    expect(body).toContain('max-width: var(--maxw)');
    expect(body).toContain('padding-inline: 32px');
    expect(ruleBody(body, /@media \(width < 820px\)\s*\{/)).toContain('padding-inline: 20px');
  });
});
