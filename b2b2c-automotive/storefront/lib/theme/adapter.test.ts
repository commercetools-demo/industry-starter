// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildThemeCss, buildThemeVars, parseTheme } from './adapter';
import { MALVA_DEFAULT_THEME } from './default-theme';

const green = { ...MALVA_DEFAULT_THEME, colorPrimary: '#1f6f43', colorPrimaryHover: '#185a37' };
const hostile = {
  colorPrimary: ';}</style><script>alert(1)</script>',
  fontFamily: 'x;}</style>',
  colorAccent: 'url(javascript:alert(1))',
  borderRadius: '8px;}',
  fontHeading: 'y;}</style><script>',
  colorSurface: 'expression(alert(1))',
  cardShadow: '0 0 1px red;}',
  buttonStyle: '</style>',
};

describe('One theme per reseller store: defaults', () => {
  it('Default theme emits an empty block', () => {
    expect(buildThemeCss(MALVA_DEFAULT_THEME)).toBe('');
    expect(buildThemeVars(MALVA_DEFAULT_THEME)).toEqual({});
  });
  it('No theme saved', () => {
    expect(buildThemeCss(null)).toBe(buildThemeCss(MALVA_DEFAULT_THEME));
    expect(buildThemeCss(null)).toBe('');
  });
  it('Non-object input returns defaults', () => {
    for (const input of ['string', 42, [], [1, 2], undefined, true]) {
      expect(parseTheme(input)).toEqual(MALVA_DEFAULT_THEME);
      expect(buildThemeCss(input)).toBe('');
    }
  });
  it('Partial documents are completed', () => {
    const theme = parseTheme({ colorPrimary: '#1f6f43' });
    expect(theme.colorPrimary).toBe('#1f6f43');
    expect(theme.colorBackground).toBe(MALVA_DEFAULT_THEME.colorBackground);
    expect(theme.borderRadius).toBe('md');
    // the maroon hover must not leak into a green brand
    expect(theme.colorPrimaryHover).not.toBe(MALVA_DEFAULT_THEME.colorPrimaryHover);
    const vars = buildThemeVars({ colorPrimary: '#1f6f43' });
    expect(vars['--color-brand-700']).toBe('#1f6f43');
    expect(vars['--color-accent-500']).toBeUndefined();
    expect(vars['--radius-md']).toBeUndefined();
  });
});

describe('Storefront renders only from semantic automotive tokens', () => {
  it('Token change reaches every surface', () => {
    const vars = buildThemeVars(green);
    expect(vars['--color-brand-700']).toBe('#1f6f43');
    expect(vars['--color-brand-600']).toBe('#185a37');
    expect(vars['--color-action']).toBe('var(--color-brand-700)');
    expect(vars['--color-text-on-brand']).toBeUndefined();
    expect(vars['--color-accent-500']).toBeUndefined();
    // every semantic token of tokens.css that follows the brand ramp is re-declared by the adapter
    const tokens = readFileSync(path.resolve(import.meta.dirname, '../../app/tokens.css'), 'utf8');
    const brandDerived = [...tokens.matchAll(/^\s*(--[\w-]+)\s*:\s*var\(--color-brand-[\w-]+\)/gm)].map((m) => m[1]);
    expect(brandDerived.length).toBeGreaterThan(8);
    for (const name of brandDerived) expect(vars, `${name} is derived from brand in tokens.css`).toHaveProperty(name);
    const accentDerived = [...tokens.matchAll(/^\s*(--[\w-]+)\s*:\s*var\(--color-accent-[\w-]+\)/gm)].map((m) => m[1]);
    const accentVars = buildThemeVars({ ...MALVA_DEFAULT_THEME, colorAccent: '#2a6fdb' });
    for (const name of accentDerived) expect(accentVars, `${name} is derived from accent in tokens.css`).toHaveProperty(name);
  });
  it('Selector is :root:root', () => {
    const css = buildThemeCss(green);
    expect(css.startsWith(':root:root{--color-brand-50:')).toBe(true);
    expect(css.endsWith('}')).toBe(true);
    expect(css).toContain('--color-brand-700:#1f6f43');
  });
  it('Radius scale none and full', () => {
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, borderRadius: 'none' })).toMatchObject({ '--radius-xs': '0px', '--radius-md': '0px', '--radius-pill': '0px' });
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, borderRadius: 'full' })).toMatchObject({ '--radius-sm': '999px', '--radius-pill': '999px', '--radius-xl': '24px' });
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, borderRadius: 'lg' })['--radius-md']).toBe('10px');
  });
  it('Secondary button styles', () => {
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, buttonStyle: 'outline' })).toMatchObject({
      '--btn-secondary-bg': 'transparent',
      '--btn-secondary-border': 'var(--color-action)',
      '--btn-secondary-fg': 'var(--color-action)',
    });
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, buttonStyle: 'ghost' })).toMatchObject({
      '--btn-secondary-bg': 'transparent',
      '--btn-secondary-border': 'transparent',
      '--btn-secondary-fg': 'var(--color-action)',
    });
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, buttonStyle: 'solid' })).toEqual({});
  });
  it('Primary button tokens are untouched by buttonStyle', () => {
    const pick = (v: Record<string, string>) => Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith('--color-action') || k === '--color-text-on-brand'));
    for (const style of ['solid', 'outline', 'ghost']) {
      expect(pick(buildThemeVars({ ...green, buttonStyle: style }))).toEqual(pick(buildThemeVars(green)));
    }
  });
  it('Card shadow and shadow style', () => {
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, cardShadow: 'lg' })['--shadow-card']).toBe('0 8px 24px rgba(0,0,0,.12)');
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, cardShadow: 'md', shadowStyle: 'none' })['--shadow-card']).toBe('none');
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, cardShadow: 'md', shadowStyle: 'soft' })['--shadow-card']).toBe('0 4px 12px rgba(0,0,0,.08)');
  });
  it('Border strong is the border colour, darker', () => {
    const vars = buildThemeVars({ ...MALVA_DEFAULT_THEME, colorBorder: '#d0d0d0' });
    expect(vars['--color-border']).toBe('#d0d0d0');
    expect(vars['--color-border-strong']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--color-border-strong']).not.toBe('#d0d0d0');
  });
});

describe('Locked tokens and unsupported theme fields', () => {
  it('Reseller picks a glass preset', () => {
    const base = buildThemeCss(green);
    const withGlass = buildThemeCss({ ...green, shadowStyle: 'neumorphic', surfaceBlur: 'lg', backgroundStyle: 'noise', headerStyle: 'transparent', surfaceOpacity: 0.4, colorSurfaceGlass: '#ffffff80', animationStyle: 'bounce', spacingScale: 2, letterSpacing: 'wider', textTransform: 'uppercase', borderWidth: '2', fontWeightHeading: '900' });
    expect(withGlass).toBe(base);
  });
  it('Fit colours do not follow the theme', () => {
    const css = buildThemeCss({ ...green, colorDestructive: '#ff8800', colorDestructiveForeground: '#000000' });
    expect(css).not.toMatch(/danger|fit|destructive/);
  });
  it('Locked tokens are never emitted', () => {
    const everything = { ...green, colorAccent: '#2a6fdb', colorSecondary: '#101828', colorBorder: '#d0d0d0', borderRadius: 'full', buttonStyle: 'ghost', cardShadow: 'lg', fontFamily: 'Inter', fontHeading: 'Archivo' };
    for (const key of Object.keys(buildThemeVars(everything))) {
      expect(key).not.toMatch(/^--(color-(success|danger|warning|info|neutral)|space-|content-width|container-width)/);
    }
  });
});

describe('External theme values are sanitised and applied at first paint', () => {
  it('Hostile value', () => {
    const css = buildThemeCss(hostile);
    for (const bad of ['<', '>', ';}', 'url(', 'javascript', '</style', 'script', 'alert', 'expression']) expect(css).not.toContain(bad);
    expect(css).toBe(buildThemeCss(MALVA_DEFAULT_THEME));
  });
  it('Hostile value inside an otherwise valid theme leaves the valid part intact', () => {
    const css = buildThemeCss({ ...green, colorAccent: 'url(javascript:alert(1))', fontFamily: 'x;}' });
    expect(css).toBe(buildThemeCss(green));
    expect(css).toContain('--color-brand-700:#1f6f43');
  });
  it('Unknown family', () => {
    const vars = buildThemeVars({ ...MALVA_DEFAULT_THEME, fontFamily: 'Comic Sans MS, cursive' });
    expect(vars['--font-body']).toBe('system-ui, sans-serif');
    expect(JSON.stringify(vars)).not.toContain('Comic');
  });
  it('Allowed family maps to variable', () => {
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, fontHeading: 'Archivo' })['--font-display']).toBe('var(--font-archivo), system-ui, sans-serif');
    expect(buildThemeVars({ ...MALVA_DEFAULT_THEME, fontFamily: 'Inter' })['--font-ui']).toBe('var(--font-inter), system-ui, sans-serif');
  });
});
