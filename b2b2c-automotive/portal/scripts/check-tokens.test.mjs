/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkTokens, lintSource, tokenMap } from './check-tokens.mjs';
import { appRoot, readApp, tmp } from './test-utils.mjs';

const tokens = tokenMap(readApp('app/tokens.css'));
const lint = (text, file = 'components/X.tsx') => lintSource(file, text, tokens).join('\n');

describe('No raw values', () => {
  it('No raw values: hex', () => {
    expect(lint('const s = { color: "#303030" };')).toMatch(/raw colour #303030; use var\(--color-[a-z-]+\)/);
    expect(lint('.a { background: #ffffff; }', 'components/x.css')).toContain('use var(--color-');
  });
  it('No raw values: hex names the nearest semantic token', () => {
    expect(lint('.a { color: #f7f7f7; }', 'components/x.css')).toContain('var(--color-bg-page)');
  });
  it('No raw values: colour function', () => {
    expect(lint('.a { color: rgb(0 0 0); }', 'components/x.css')).toMatch(/raw colour function rgb\(\)/);
  });
  it('No raw values: font name', () => {
    expect(lint('.a { font-family: "Poppins", sans-serif; }', 'components/x.css')).toContain('font "Poppins" is not allowed here; use var(--font-sans)');
    expect(lint('const s = { fontFamily: "Georgia" };')).toContain('font "Georgia"');
    expect(lint('.a { font-family: var(--font-sans); }', 'components/x.css')).toBe('');
    expect(lint('.a { font-family: inherit; }', 'components/x.css')).toBe('');
  });
  it('No raw values: non-Inter font in the portal is rejected even when quoted in a stack', () => {
    expect(lint('.a { font-family: Inter, Arial; }', 'components/x.css')).toContain('"Inter"');
  });
  it('No raw values: px size', () => {
    expect(lint('.a { font-size: 14px; }', 'components/x.css')).toContain('raw size 14px; use var(--text-body-2)');
    expect(lint('.a { padding: 16px; }', 'components/x.css')).toContain('var(--space-400)');
    expect(lint('.a { border-radius: 12px; }', 'components/x.css')).toContain('var(--radius-300)');
  });
  it('Hairline 1px is allowed', () => {
    expect(lint('.a { border: 1px solid var(--color-border); }', 'components/x.css')).toBe('');
  });
  it('px inside a media query is allowed', () => {
    expect(lint('@media (min-width: 1024px) { .a { color: var(--color-text); } }', 'components/x.css')).toBe('');
    expect(lint('@container (min-width: 600px) { .a { color: var(--color-text); } }', 'components/x.css')).toBe('');
  });
  it('sizes attribute px values are allowed', () => {
    expect(lint('<img sizes="(min-width: 600px) 600px, 100vw" />')).toBe('');
  });
  it('Arbitrary Tailwind value is rejected', () => {
    expect(lint('<div className="bg-[#fff] p-[14px]" />')).toMatch(/arbitrary colour \[#fff\]/);
    expect(lint('<div className="p-[14px]" />')).toMatch(/arbitrary size \[14px\]/);
    expect(lint('<div className="font-[Poppins]" />')).toMatch(/arbitrary font utility/);
  });
  it('Default palette class is rejected', () => {
    expect(lint('<div className="bg-white text-slate-700" />')).toMatch(/default palette class bg-white/);
    expect(lint('<div className="text-slate-700" />')).toMatch(/default palette class text-slate-700/);
    expect(lint('<div className="bg-gray-500" />')).toMatch(/not a kit step/);
  });
  it('Kit colour classes and token utilities are allowed', () => {
    expect(lint('<div className="bg-gray-4 text-blue-12 bg-black-alpha-5 bg-bg-surface text-text p-400 rounded-300" />')).toBe('');
  });
  it('Unknown variable is rejected', () => {
    expect(lint('.a { color: var(--color-nope); }', 'components/x.css')).toContain('unknown variable --color-nope');
    expect(lint('.a { color: var(--color-text); font-family: var(--font-inter); }', 'components/x.css')).toBe('');
  });
  it('Variables declared in the same file are allowed', () => {
    expect(lint('.a { --local: 1; margin: var(--local); }', 'components/x.css')).toBe('');
  });
  it('Test files and token files are exempt', () => {
    expect(lint('const c = "#fff";', 'components/X.test.tsx')).toBe('');
    expect(lintSource('app/tokens.css', '.a{color:#fff}', tokens)).toEqual([]);
  });
});

describe('Repo level', () => {
  it('Tokens in sync and Theme block is current through checkTokens on the real app', () => {
    expect(checkTokens(appRoot)).toEqual([]);
  });
  it('Dark top bar', () => {
    const root = tmp();
    mkdirSync(path.join(root, 'app'), { recursive: true });
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    cpSync(path.join(appRoot, 'app', 'tokens.css'), path.join(root, 'app', 'tokens.css'));
    const css = readApp('app/tokens.css').replace('--color-border-exclude: #303030;', '--color-border-exclude: #303030;\n  --color-bg-topbar: #000000;');
    writeFileSync(path.join(root, 'app', 'tokens.css'), css);
    const problems = checkTokens(root).join('\n');
    expect(problems).toMatch(/must not define --color-bg-topbar/);
  });
  it('Tokens drift is reported by checkTokens', () => {
    const root = tmp();
    mkdirSync(path.join(root, 'app'), { recursive: true });
    writeFileSync(path.join(root, 'app', 'tokens.css'), readApp('app/tokens.css').replace('--color-bg-brand: #303030;', '--color-bg-brand: #313131;'));
    // The sync check resolves the source relative to the root, which does not exist for a temp dir.
    expect(checkTokens(root).join('\n')).toMatch(/design source \.\.\/design\/export\/tokens\.admin\.css is missing/);
    expect(existsSync(path.join(root, 'app', 'tokens.css'))).toBe(true);
  });
});
