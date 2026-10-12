// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkServerOnly } from './check-server-only.mjs';
import { tmpApp } from './test-utils.mjs';

describe('Directory structure: Server-only boundary', () => {
  it('Passes on the placeholder', () => {
    const root = tmpApp({ 'lib/ct/index.ts': "import 'server-only'; export {};", 'lib/contentools/origin.ts': 'export {};', 'lib/utils.ts': 'export {};' });
    expect(checkServerOnly(root)).toEqual([]);
  });
  it('lib/ct file without server-only fails', () => {
    const root = tmpApp({ 'lib/ct/client.ts': 'export {};', 'lib/session.ts': 'export {};', 'lib/contentools/puck.ts': 'export {};' });
    expect(checkServerOnly(root).sort()).toEqual([
      "lib/contentools/puck.ts must start with import 'server-only'",
      "lib/ct/client.ts must start with import 'server-only'",
      "lib/session.ts must start with import 'server-only'",
    ]);
  });
  it('Server-only boundary fails when a client file imports lib/ct', () => {
    const root = tmpApp({
      'lib/ct/index.ts': "import 'server-only'; export const a = 1;",
      'components/a.tsx': "import { a } from '@/lib/ct';\nexport const x = a;",
      'app/b.tsx': "'use client';\nimport type { S } from '@/lib/session';\nexport type T = S;",
      'app/server-page.tsx': "import { a } from '@/lib/ct';\nexport const y = a;",
    });
    const p = checkServerOnly(root).join('\n');
    expect(p).toMatch(/components\/a\.tsx/);
    expect(p).toMatch(/app\/b\.tsx/);
    expect(p).not.toMatch(/server-page/);
  });
});
