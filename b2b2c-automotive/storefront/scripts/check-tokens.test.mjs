// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkTokens, lintSource, tokenMap } from './check-tokens.mjs';
import { tmpApp } from './test-utils.mjs';

const tokens = tokenMap(readFileSync('app/tokens.css', 'utf8'));
const lint = (file, text) => lintSource(file, text, tokens).join('\n');

describe('Styling from the automotive tokens: No raw values', () => {
  it('No raw values: hex', () => {
    const p = lint('components/a.tsx', "export const s = { color: '#821810' };");
    expect(p).toMatch(/raw colour #821810; use var\(--color-brand-700\)/);
  });
  it('No raw values: hex in CSS, rgb function', () => {
    expect(lint('app/x.css', '.a { background: #fcefee; }')).toMatch(/use var\(--color-brand-50\)/);
    expect(lint('app/x.css', '.a { color: rgb(130, 24, 16); }')).toMatch(/use var\(--color-brand-700\)/);
  });
  it('anchors and ids that look like hex are not colours', () => {
    expect(lint('components/a.tsx', 'export const a = <a href="#add">x</a>;')).toBe('');
  });
  it('No raw values: font name', () => {
    expect(lint('app/x.css', ".a { font-family: 'Poppins', sans-serif; }")).toMatch(/font "Poppins" is not allowed here; use var\(--font-display\)/);
    expect(lint('components/a.tsx', "export const s = { fontFamily: 'Archivo, sans-serif' };")).toMatch(/use var\(--font-utility\)/);
    expect(lint('app/x.css', '.a { font-family: var(--font-ui); }')).toBe('');
    expect(lint('components/a.tsx', 'export const c = "font-[Georgia]";')).toMatch(/arbitrary font class/);
  });
  it('No raw values: px size', () => {
    expect(lint('app/x.css', '.a { font-size: 14px; }')).toMatch(/raw size 14px; use var\(--text-sm\)/);
    expect(lint('app/x.css', '.a { padding: 24px; }')).toMatch(/use var\(--space-5\)/);
    expect(lint('app/x.css', '.a { border-radius: 5px; }')).toMatch(/use var\(--radius-md\)/);
    expect(lint('app/x.css', '.a { margin: 13px; }')).toMatch(/var\(--space-\d\) or/);
  });
  it('Hairline 1px is allowed', () => {
    expect(lint('app/x.css', '.a { border: 1px solid var(--color-border); }')).toBe('');
  });
  it('px inside a media query is allowed', () => {
    expect(lint('app/x.css', '@media (min-width: 768px) {\n .a { display: none; }\n}')).toBe('');
  });
  it('sizes attribute is allowed', () => {
    expect(lint('components/a.tsx', 'export const i = <img sizes="(min-width: 768px) 50vw, 100vw" alt="" />;')).toBe('');
  });
  it('Arbitrary Tailwind value is rejected', () => {
    expect(lint('components/a.tsx', 'export const c = "bg-[#fff] p-[13px]";')).toMatch(/arbitrary Tailwind value/);
  });
  it('Default palette class is rejected', () => {
    expect(lint('components/a.tsx', 'export const c = "bg-red-500 text-white";')).toMatch(/class bg-red-500 is not a token/);
    expect(lint('components/a.tsx', 'export const c = "text-white";')).toMatch(/class text-white/);
    expect(lint('components/a.tsx', 'export const c = "bg-neutral-100 text-text border-border";')).toBe('');
  });
  it('Unknown variable is rejected', () => {
    expect(lint('app/x.css', '.a { color: var(--color-nope); }')).toMatch(/unknown variable --color-nope/);
    expect(lint('app/x.css', '.a { color: var(--font-poppins); }')).toBe('');
    expect(lintSource('app/x.css', '.a { color: var(--store-x); }', tokens, ['--store-x']).join('')).toBe('');
  });
  it('Placeholder palette is rejected', () => {
    expect(lint('components/a.tsx', 'export const c = "bg-cream text-charcoal";')).toMatch(/placeholder palette class bg-cream/);
    const root = tmpApp({});
    mkdirSync(path.join(root, 'app'));
    writeFileSync(path.join(root, 'app/tokens.css'), readFileSync('app/tokens.css', 'utf8').replace('--color-brand-50:', '--color-cream:'));
    cpSync('app/globals.css', path.join(root, 'app/globals.css'));
    expect(checkTokens(root).join('\n')).toMatch(/placeholder palette token --color-cream/);
  });
  it('comments and the tokens file are not linted', () => {
    expect(lint('app/x.css', '/* old: #821810 and 14px */\n.a { color: var(--color-text); }')).toBe('');
    expect(lint('components/a.tsx', '// color: #821810\nexport const a = 1;')).toBe('');
    expect(lint('app/tokens.css', ':root { --a: #fff; }')).toBe('');
  });
});

describe('Styling from the automotive tokens: repo checks', () => {
  it('Tokens in sync and Theme block is current, on the real app', () => {
    expect(checkTokens(process.cwd())).toEqual([]);
  });
  it('Tokens drift is reported with the diff', () => {
    const root = tmpApp({});
    mkdirSync(path.join(root, 'app'));
    writeFileSync(path.join(root, 'app/tokens.css'), readFileSync('app/tokens.css', 'utf8').replace('--color-brand-700: #821810', '--color-brand-700: #821811'));
    cpSync('app/globals.css', path.join(root, 'app/globals.css'));
    const p = checkTokens(root, path.resolve('../design/export/tokens.automotive.css')).join('\n');
    expect(p).toMatch(/differs from the design source/);
    expect(p).toMatch(/--color-brand-700/);
  });
  it('a stale theme block is reported', () => {
    const root = tmpApp({});
    mkdirSync(path.join(root, 'app'));
    cpSync('app/tokens.css', path.join(root, 'app/tokens.css'));
    writeFileSync(path.join(root, 'app/globals.css'), readFileSync('app/globals.css', 'utf8').replace('  --color-brand-700: var(--color-brand-700);\n', ''));
    expect(checkTokens(root, path.resolve('../design/export/tokens.automotive.css')).join('\n')).toMatch(/theme.*stale/);
  });
});
