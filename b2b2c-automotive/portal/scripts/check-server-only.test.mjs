import { describe, expect, it } from 'vitest';
import { checkServerOnly } from './check-server-only.mjs';
import { tmp } from './test-utils.mjs';

describe('Server-only boundary', () => {
  it('Passes on the placeholder', () => {
    const root = tmp({
      'lib/ct/index.ts': "import 'server-only';\nexport {};",
      'lib/ct/a.test.ts': 'no guard in tests',
      'lib/session.ts': "// session\nimport 'server-only';",
      'lib/contentools/origin.ts': 'export const o = 1;',
      'lib/utils.ts': 'export {};',
    });
    expect(checkServerOnly(root)).toEqual([]);
  });
  it('lib/ct file without server-only fails', () => {
    const root = tmp({ 'lib/ct/client.ts': 'export {};', 'lib/ct/deep/x.ts': "import 'server-only';", 'lib/session-cookie.ts': 'export {};', 'lib/contentools/jwt.ts': 'export {};' });
    expect(checkServerOnly(root).sort()).toEqual([
      "lib/contentools/jwt.ts must start with import 'server-only'",
      "lib/ct/client.ts must start with import 'server-only'",
      "lib/session-cookie.ts must start with import 'server-only'",
    ]);
  });
  it('Pure modules are exempt but nothing else is', () => {
    const root = tmp({
      'lib/session-core.ts': 'export const pure = 1;',
      'lib/locale-redirect.ts': 'export const pure = 2;',
      'lib/session.ts': 'export {};',
      'lib/session-extra.ts': 'export {};',
      'lib/ct/helper.ts': 'export {};',
    });
    expect(checkServerOnly(root).sort()).toEqual([
      "lib/ct/helper.ts must start with import 'server-only'",
      "lib/session-extra.ts must start with import 'server-only'",
      "lib/session.ts must start with import 'server-only'",
    ]);
  });
  it('Server-only boundary fails when a client file imports lib/ct', () => {
    const root = tmp({
      'lib/ct/index.ts': "import 'server-only';",
      'components/Bad.tsx': "import { x } from '@/lib/ct/client';\nexport const B = () => null;",
      'app/Leaf.tsx': "'use client';\nimport type { S } from '@/lib/session';\nexport {};",
      'app/ServerOk.tsx': "import { x } from '@/lib/ct/client';\nexport {};",
    });
    const problems = checkServerOnly(root).join('\n');
    expect(problems).toMatch(/components\/Bad\.tsx is client code/);
    expect(problems).toMatch(/app\/Leaf\.tsx is client code/);
    expect(problems).not.toMatch(/ServerOk/);
  });
});
