import { describe, expect, it } from 'vitest';
import { checkContrast, evaluate, loadReport, parseColour, ratio, resolveModes, themeBlocks } from './contrast-report.mjs';
import { appRoot, readApp, tmp } from './test-utils.mjs';

describe('contrast pairs', () => {
  it('every pair in contrast-pairs.json meets its threshold in light and dark (listed exceptions aside)', () => {
    expect(checkContrast(appRoot)).toEqual([]);
  });

  it('the report covers both modes and lists every exception with a reason', () => {
    const rows = loadReport(appRoot);
    expect(new Set(rows.map((r) => r.mode))).toEqual(new Set(['light', 'dark']));
    for (const r of rows.filter((x) => !x.pass)) expect(r.exception, `${r.fg} on ${r.bg}`).toBeTruthy();
  });

  it('computes the WCAG ratio (black on white is 21, grey 767676 on white is 4.54)', () => {
    expect(ratio(parseColour('#000000'), parseColour('#ffffff'))).toBeCloseTo(21, 5);
    expect(ratio(parseColour('#767676'), parseColour('#ffffff'))).toBeCloseTo(4.54, 2);
  });

  it('fails a text pair below 4.5 and passes a large or ui pair at 3', () => {
    const css = ':root { --color-bg-page: #ffffff; --a: var(--b); --b: #949494; } [data-theme="dark"] { --b: #ffffff; }';
    const maps = resolveModes([css]);
    const [light, dark] = evaluate([{ fg: '--a', bg: '--color-bg-page', size: 'normal' }], maps);
    expect(light.pass).toBe(false);
    expect(dark.mode).toBe('dark');
    const [large] = evaluate([{ fg: '--a', bg: '--color-bg-page', size: 'large', where: 'light' }], maps);
    expect(large.pass).toBe(true);
  });

  it('lays a translucent background over the page colour before measuring', () => {
    const maps = resolveModes([':root { --color-bg-page: #ffffff; --bg: #00000080; --fg: #ffffff; }']);
    const [row] = evaluate([{ fg: '--fg', bg: '--bg', size: 'normal', where: 'light' }], maps);
    expect(row.ratio).toBeGreaterThan(3.9);
    expect(row.ratio).toBeLessThan(4.1);
  });

  it('follows the cascade: a later :root block overrides an earlier dark block in dark unless the dark selector is repeated', () => {
    const base = ':root { --color-bg-page: #ffffff; --a: #000000; } [data-theme="dark"] { --color-bg-page: #000000; --a: #ffffff; }';
    const leaky = resolveModes([base, ':root { --a: #111111; }']);
    expect(leaky.dark.get('--a')).toBe('#111111');
    const fixed = resolveModes([base, ':root { --a: #111111; } [data-theme="dark"] { --a: #eeeeee; }']);
    expect(fixed.dark.get('--a')).toBe('#eeeeee');
    expect(fixed.light.get('--a')).toBe('#111111');
    const [, dark] = evaluate([{ fg: '--a', bg: '--color-bg-page', size: 'normal' }], leaky);
    expect(dark.pass).toBe(false);
  });

  it('the AA layer restates every token it overrides in dark', () => {
    const maps = resolveModes([readApp('app/tokens.css'), readApp('app/globals.css')]);
    const layer = themeBlocks(readApp('app/globals.css'));
    const light = [...layer.filter((b) => b.mode === 'light').flatMap((b) => [...b.body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))].filter((n) => n.startsWith('--color-'));
    const dark = new Set(layer.filter((b) => b.mode === 'dark').flatMap((b) => [...b.body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])));
    expect(light.length).toBeGreaterThan(0);
    for (const name of light) expect(dark.has(name), `${name} missing from the dark block`).toBe(true);
    expect(maps.dark.get('--color-text-subdued')).not.toBe(maps.light.get('--color-text-subdued'));
  });

  it('exits non-zero through checkContrast when a pair fails', () => {
    const root = tmp({
      'app/tokens.css': ':root { --color-bg-page: #ffffff; --color-text: #cccccc; }',
      'app/globals.css': '',
      'scripts/contrast-pairs.json': JSON.stringify([{ fg: '--color-text', bg: '--color-bg-page', size: 'normal', where: 'light' }]),
    });
    expect(checkContrast(root).join('')).toMatch(/FAIL\s+light.*--color-text on --color-bg-page/);
  });
});
