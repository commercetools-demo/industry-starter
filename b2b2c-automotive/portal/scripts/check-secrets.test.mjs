import { describe, expect, it } from 'vitest';
import { SECRET_VARS } from './app.config.mjs';
import { checkSecrets } from './check-secrets.mjs';
import { readApp, tmp } from './test-utils.mjs';

const example = SECRET_VARS.map((v) => `# comment\n${v}=\n`).join('') + '# view_stores : read the stores\nCTP_SCOPES=\n';
const scoped = (extra = '') => example.replace('# view_stores : read the stores\nCTP_SCOPES=\n', `# view_stores : read the stores\n${extra}CTP_SCOPES=\n`);

describe('Environment and least privilege', () => {
  it('passes with an empty-valued .env.example and nothing tracked', () => {
    expect(checkSecrets(tmp({ '.env.example': example }), ['app/page.tsx', '.env.example'])).toEqual([]);
  });
  it('Undocumented scope', () => {
    const root = tmp({ '.env.example': example, 'lib/ct/x.ts': "export const s = 'manage_products';" });
    expect(checkSecrets(root, []).join('\n')).toMatch(/scope manage_products is not documented/);
  });
  it('Scope with an empty reason', () => {
    const root = tmp({ '.env.example': scoped('# view_types :\n') });
    expect(checkSecrets(root, []).join('\n')).toMatch(/scope view_types has an empty reason/);
  });
  it('Scope without a colon has no reason', () => {
    const root = tmp({ '.env.example': scoped('# view_types\n') });
    expect(checkSecrets(root, []).join('\n')).toMatch(/scope view_types has an empty reason/);
  });
  it('Public prefix on a secret', () => {
    const root = tmp({
      '.env.example': example,
      'lib/x.ts': 'const k = process.env.NEXT_PUBLIC_CTP_CLIENT_SECRET;',
      'lib/y.ts': 'process.env.NEXT_PUBLIC_SOME_TOKEN',
    });
    expect(checkSecrets(root, []).filter((p) => p.includes('NEXT_PUBLIC_'))).toHaveLength(2);
  });
  it('Tracked env file', () => {
    const problems = checkSecrets(tmp({ '.env.example': example }), ['.env', '.env.local', 'portal/.env.production', '.next/cache/x', '.env.example']);
    expect(problems).toEqual(['.env is tracked by git', '.env.local is tracked by git', 'portal/.env.production is tracked by git', '.next/cache/x is tracked by git']);
  });
  it('Missing variable in .env.example', () => {
    expect(checkSecrets(tmp({}), [])).toEqual(['.env.example is missing']);
    expect(checkSecrets(tmp({ '.env.example': example.replace('SESSION_SECRET=\n', 'SESSION_SECRET=abc\n') }), []).join('')).toMatch(/must list SESSION_SECRET=/);
  });
  it('The real .env.example names the three credential sets', () => {
    const text = readApp('.env.example');
    for (const v of ['CTP_CLIENT_ID', 'CTP_ADMIN_CLIENT_ID', 'CTP_PROVISION_CLIENT_ID', 'SESSION_SECRET', 'CONTENTOOLS_ORIGIN']) expect(text).toMatch(new RegExp(`^${v}=$`, 'm'));
  });
});
