// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });
const fixture = (name) => readFileSync(path.join('eslint', 'fixtures', name), 'utf8');

async function lint(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.severity === 2).map((m) => `${m.ruleId}: ${m.message}`);
}

describe('BFF boundary: Single client', () => {
  it('Single client', async () => {
    expect((await lint(fixture('single-client.bad.tsx'), 'lib/other.ts')).join('\n')).toMatch(/new ClientBuilder\(\) is only allowed in lib\/ct\/client\.ts/);
  });
  it('Single client allows lib/ct/client.ts', async () => {
    expect(await lint("import { ClientBuilder } from '@commercetools/ts-client';\nexport const b = new ClientBuilder();\n", 'lib/ct/client.ts')).toEqual([]);
  });
});

describe('BFF boundary: SDK outside lib/ct', () => {
  it('SDK outside lib/ct', async () => {
    expect((await lint(fixture('sdk-outside-lib.bad.tsx'), 'components/cart/Cart.tsx')).join('\n')).toMatch(/only allowed in lib\/ct/);
    expect((await lint(fixture('sdk-outside-lib.bad.tsx'), 'lib/utils.ts')).join('\n')).toMatch(/only allowed in lib\/ct/);
  });
  it('SDK is fine in lib/ct, and type imports in lib/mappers', async () => {
    expect(await lint(fixture('sdk-outside-lib.bad.tsx'), 'lib/ct/cart.ts')).toEqual([]);
    expect(await lint("import type { Product } from '@commercetools/platform-sdk';\nexport type P = Product;\n", 'lib/mappers/product.ts')).toEqual([]);
    expect((await lint("import { ClientBuilder } from '@commercetools/ts-client';\nexport const b = ClientBuilder;\n", 'lib/mappers/product.ts')).join('\n')).toMatch(/only allowed in lib\/ct/);
  });
});

describe('Client state: Hook-only fetching', () => {
  it('Hook-only fetching', async () => {
    const m = (await lint(fixture('hook-only-fetching.bad.tsx'), 'components/cart/Cart.tsx')).join('\n');
    expect(m.match(/use a hook/g)).toHaveLength(2);
    expect((await lint(fixture('hook-only-fetching.bad.tsx'), 'app/[locale]/page.tsx')).join('\n')).toMatch(/use a hook/);
  });
  it('fetch(/api) is allowed in hooks', async () => {
    expect(await lint(fixture('hook-only-fetching.bad.tsx'), 'hooks/useCart.ts')).toEqual([]);
  });
});

describe('Locale routing for two locales: Locale-aware navigation only', () => {
  it('Locale-aware navigation only', async () => {
    const m = (await lint(fixture('locale-navigation.bad.tsx'), 'components/layout/Nav.tsx')).join('\n');
    expect(m).toMatch(/Link from '@\/i18n\/routing'/);
    expect(m).toMatch(/redirect, useRouter and usePathname/);
    expect((await lint(fixture('locale-navigation.bad.tsx'), 'app/[locale]/x/page.tsx')).join('\n')).toMatch(/@\/i18n\/routing/);
  });
  it('notFound and useSearchParams stay allowed', async () => {
    expect(await lint("import { notFound, useSearchParams } from 'next/navigation';\nexport const x = [notFound, useSearchParams];\n", 'components/layout/Nav.tsx')).toEqual([]);
  });
});

describe('Contentools reads: createContext footgun', () => {
  it('createContext footgun', async () => {
    expect((await lint(fixture('create-context.bad.tsx'), 'app/[locale]/[store]/page.tsx')).join('\n')).toMatch(/malva\/no-puck-in-server/);
    expect((await lint(fixture('create-context.bad.tsx'), 'lib/contentools/puck.ts')).join('\n')).toMatch(/Server Component/);
  });
  it('Puck value imports are fine in use client files, type imports everywhere', async () => {
    expect(await lint(`'use client';\n${fixture('create-context.bad.tsx')}`, 'components/contentools/ContentoolsPage.tsx')).toEqual([]);
    expect(await lint("import type { PuckData } from '@commercetools-demo/puck-types';\nexport type D = PuckData;\n", 'lib/contentools/puck.ts')).toEqual([]);
    expect(await lint("import { type PuckData } from '@commercetools-demo/puck-types';\nexport type D = PuckData;\n", 'lib/contentools/puck.ts')).toEqual([]);
  });
});
