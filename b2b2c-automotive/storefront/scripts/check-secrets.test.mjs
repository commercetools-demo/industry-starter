// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENV_VARS } from './app.config.mjs';
import { checkSecrets, documentedScopes, listedScopes } from './check-secrets.mjs';
import { tmpApp } from './test-utils.mjs';

const EXAMPLE = `${ENV_VARS.filter((v) => v !== 'CTP_SCOPES').map((v) => `# comment\n${v}=\n`).join('')}# view_stores : resolve the store\n# manage_orders : place orders\nCTP_SCOPES=\n`;

describe('Environment and least privilege', () => {
  it('passes with a complete .env.example and nothing tracked', () => {
    expect(checkSecrets(tmpApp({ '.env.example': EXAMPLE }), ['app/page.tsx', '.env.example'])).toEqual([]);
  });
  it('the real .env.example passes', () => {
    expect(checkSecrets(process.cwd(), [])).toEqual([]);
    expect(readFileSync('.env.example', 'utf8')).toMatch(/^CTP_SCOPES=$/m);
  });
  it('Undocumented scope', () => {
    const root = tmpApp({ '.env.example': EXAMPLE, '.env.local': 'CTP_SCOPES="view_stores view_secret_thing"\n' });
    expect(checkSecrets(root, []).join('\n')).toMatch(/scope view_secret_thing is used but has no/);
  });
  it('Undocumented scope in the example value itself', () => {
    const root = tmpApp({ '.env.example': EXAMPLE.replace('CTP_SCOPES=', 'CTP_SCOPES=manage_everything') });
    expect(checkSecrets(root, []).join('\n')).toMatch(/manage_everything/);
  });
  it('Scope with an empty reason', () => {
    const root = tmpApp({ '.env.example': `${EXAMPLE}# view_types :\n` });
    expect(checkSecrets(root, []).join('\n')).toMatch(/scope view_types has an empty reason/);
  });
  it('Public prefix on a secret', () => {
    const root = tmpApp({ '.env.example': EXAMPLE, 'lib/x.ts': 'const k = process.env.NEXT_PUBLIC_CTP_CLIENT_SECRET;', 'lib/y.ts': 'process.env.NEXT_PUBLIC_SOME_TOKEN' });
    expect(checkSecrets(root, []).filter((p) => p.includes('NEXT_PUBLIC_'))).toHaveLength(2);
  });
  it('Tracked env file', () => {
    const problems = checkSecrets(tmpApp({ '.env.example': EXAMPLE }), ['.env', '.env.local', '.next/cache/x', '.env.example']);
    expect(problems).toEqual(['.env is tracked by git', '.env.local is tracked by git', '.next/cache/x is tracked by git']);
  });
  it('Missing variable in .env.example', () => {
    expect(checkSecrets(tmpApp({}), [])).toEqual(['.env.example is missing']);
    const root = tmpApp({ '.env.example': EXAMPLE.replace('SESSION_SECRET=\n', 'SESSION_SECRET=abc\n') });
    expect(checkSecrets(root, []).join('')).toMatch(/must list SESSION_SECRET=/);
  });
  it('parses scope lines and listed scopes', () => {
    expect(documentedScopes('#   view_a   : reason a\n# note without colon\n').get('view_a')).toBe('reason a');
    expect(listedScopes('CTP_SCOPES=a b,c\nOTHER=x\n')).toEqual(['a', 'b', 'c']);
  });
});
