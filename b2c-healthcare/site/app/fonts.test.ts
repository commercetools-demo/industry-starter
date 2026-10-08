import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appDir = import.meta.dirname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('fonts', () => {
  it('Fonts without a flash of wrong type: no runtime Google Fonts reference under app/', () => {
    // Built from parts so this test file does not match itself.
    const needle = ['fonts', 'googleapis', 'com'].join('.');
    const hits = walk(appDir)
      .filter((p) => /\.(css|tsx?|mjs)$/.test(p))
      .filter((p) => readFileSync(p, 'utf8').includes(needle));
    expect(hits).toEqual([]);
  });

  it('Fonts without a flash of wrong type: layout loads Poppins, Lato, Roboto through next/font with swap', () => {
    const layout = readFileSync(join(appDir, 'layout.tsx'), 'utf8');
    expect(layout).toContain('from "next/font/google"');
    for (const family of ['Poppins', 'Lato', 'Roboto']) expect(layout).toContain(`${family}({`);
    expect(layout.match(/display: "swap"/g)).toHaveLength(3);
    expect(layout).toContain('weight: ["400", "500", "600", "700"]');
    expect(layout).toContain('weight: ["400", "700"]');
    expect(layout).toContain('weight: ["400", "500"]');
  });

  it('Fonts without a flash of wrong type: --font-display/meta/body resolve to the loaded fonts', () => {
    const layout = readFileSync(join(appDir, 'layout.tsx'), 'utf8');
    const tokens = readFileSync(join(appDir, 'tokens.css'), 'utf8');
    const ext = tokens.split('==== storefront extensions ====')[1];
    for (const [token, variable] of [
      ['--font-display', '--font-poppins'],
      ['--font-meta', '--font-lato'],
      ['--font-body', '--font-roboto'],
    ]) {
      expect(layout).toContain(`variable: "${variable}"`);
      expect(ext).toContain(`${token}: var(${variable})`);
    }
  });
});
