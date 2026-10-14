import { describe, expect, it } from 'vitest';
import { TOKENS_SOURCE } from './app.config.mjs';
import { readApp as read } from './test-utils.mjs';
import { diffTokens, normalise } from './tokens-source.mjs';

describe('Tokens in sync', () => {
  it('Tokens in sync', () => {
    expect(diffTokens(read('app/tokens.css'), read(TOKENS_SOURCE))).toEqual([]);
  });
  it('Tokens drift names the line', () => {
    const drifted = read('app/tokens.css').replace('--color-bg-brand: #303030;', '--color-bg-brand: #313131;');
    const problems = diffTokens(drifted, read(TOKENS_SOURCE)).join('\n');
    expect(problems).toContain('--color-bg-brand');
    expect(problems).toMatch(/^- line \d+/m);
    expect(problems).toMatch(/^\+ line \d+/m);
  });
  it('Google import is removed locally', () => {
    expect(read('app/tokens.css')).not.toContain('fonts.googleapis.com');
    expect(read(TOKENS_SOURCE)).toContain('fonts.googleapis.com');
  });
  it('normalise strips only the Google import and keeps one trailing newline', () => {
    expect(normalise('/* c */\n@import url("https://fonts.googleapis.com/css2?x");\n:root{}\n\n\n')).toBe('/* c */\n:root{}\n');
  });
});
