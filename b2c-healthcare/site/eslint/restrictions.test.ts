import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { restrictionConfigs } from './restrictions.mjs';

const root = resolve(__dirname, '..');
const linter = new Linter({ configType: 'flat', cwd: root });
const config = [
  { files: ['**/*.ts', '**/*.tsx', '**/*.mjs'], languageOptions: { parser: tseslint.parser } },
  ...restrictionConfigs,
] as Linter.Config[];

function lint(filename: string, code: string): string[] {
  return linter
    .verify(code, config, { filename: join(root, filename) })
    .map((message) => `${message.ruleId ?? 'parse'}: ${message.message}`);
}

describe('storefront-project-bootstrap: Server-only boundary', () => {
  it('Server-only boundary: (a) a component importing lib/ct fails', () => {
    const problems = lint('components/ui/Thing.tsx', "import { ctClient } from '@/lib/ct/client';\nexport const x = ctClient;\n");
    expect(problems.join('\n')).toMatch(/no-restricted-imports/);
  });

  it('Server-only boundary: (a) a hook importing lib/session fails', () => {
    expect(lint('hooks/useThing.ts', "import { getSession } from '@/lib/session';\nexport const x = getSession;\n")).not.toEqual([]);
  });

  it("Server-only boundary: (a) a 'use client' file anywhere importing lib/ct or lib/session fails", () => {
    const code = "'use client';\nimport { getSession } from '../../lib/session';\nexport const x = getSession;\n";
    expect(lint('app/[locale]/thing.tsx', code).join('\n')).toMatch(/local\/no-server-import-in-client/);
  });

  it('Server-only boundary: type imports and lib/types are allowed in client code', () => {
    expect(lint('components/ui/Thing.tsx', "import type { Cart } from '@/lib/types';\nexport type X = Cart;\n")).toEqual([]);
    expect(lint('hooks/useThing.ts', "import type { Opts } from '@/lib/ct/client';\nexport type X = Opts;\n")).toEqual([]);
  });

  it('Server-only boundary: server code may import lib/ct', () => {
    expect(lint('app/api/x/route.ts', "import { ctClient } from '@/lib/ct/client';\nexport const x = ctClient;\n")).toEqual([]);
    expect(lint('app/[locale]/page.tsx', "import { ctClient } from '@/lib/ct/client';\nexport const x = ctClient;\n")).toEqual([]);
  });
});

describe('storefront-project-bootstrap: platform-sdk import restriction', () => {
  it('(b) platform-sdk outside lib/ct and lib/mappers fails', () => {
    const code = "import { Cart } from '@commercetools/platform-sdk';\nexport type X = Cart;\n";
    expect(lint('components/ui/Thing.tsx', code)).not.toEqual([]);
    expect(lint('app/api/x/route.ts', code)).not.toEqual([]);
  });

  it('(b) platform-sdk is allowed in lib/ct and lib/mappers, types only in lib/types.ts', () => {
    const value = "import { Cart } from '@commercetools/platform-sdk';\nexport type X = Cart;\n";
    const type = "import type { Cart } from '@commercetools/platform-sdk';\nexport type X = Cart;\n";
    expect(lint('lib/ct/cart.ts', value)).toEqual([]);
    expect(lint('lib/mappers/cart.ts', value)).toEqual([]);
    expect(lint('lib/types.ts', type)).toEqual([]);
    expect(lint('lib/types.ts', value)).not.toEqual([]);
  });
});

describe('storefront-project-bootstrap: locale-aware navigation', () => {
  it('(c) next/link in locale UI fails', () => {
    const code = "import Link from 'next/link';\nexport const x = Link;\n";
    expect(lint('components/layout/Nav.tsx', code)).not.toEqual([]);
    expect(lint('app/[locale]/page.tsx', code)).not.toEqual([]);
  });

  it('(c) next/navigation redirect and hooks fail, notFound is allowed', () => {
    expect(lint('app/[locale]/page.tsx', "import { redirect } from 'next/navigation';\nexport const x = redirect;\n")).not.toEqual([]);
    expect(lint('components/ui/Back.tsx', "import { useRouter } from 'next/navigation';\nexport const x = useRouter;\n")).not.toEqual([]);
    expect(lint('app/[locale]/page.tsx', "import { notFound } from 'next/navigation';\nexport const x = notFound;\n")).toEqual([]);
  });

  it('(c) the locale-aware module is fine', () => {
    expect(lint('components/layout/Nav.tsx', "import { Link } from '@/i18n/routing';\nexport const x = Link;\n")).toEqual([]);
  });
});

describe('storefront-project-bootstrap: fetch restrictions', () => {
  it("(d) literal fetch('/api/...') in components fails (string and template)", () => {
    expect(lint('components/ui/Thing.tsx', "export const f = () => fetch('/api/cart');\n")).not.toEqual([]);
    expect(lint('components/ui/Thing.tsx', 'export const f = (id: string) => fetch(`/api/cart/${id}`);\n')).not.toEqual([]);
  });

  it("(d) the literal '/api' fetch rule covers components, hooks and context only", () => {
    expect(lint('lib/utils.ts', "export const f = () => fetch('/api/cart');\n")).toEqual([]);
  });

  it('(d) fetch to a commercetools host fails anywhere', () => {
    const code = "export const f = () => fetch('https://api.europe-west1.gcp.commercetools.com/p/orders');\n";
    expect(lint('lib/utils.ts', code)).not.toEqual([]);
    expect(lint('app/api/x/route.ts', code)).not.toEqual([]);
    expect(lint('hooks/useX.ts', 'export const f = (k: string) => fetch(`https://auth.commercetools.com/${k}`);\n')).not.toEqual([]);
  });

  it('(d) other fetches are fine', () => {
    expect(lint('lib/utils.ts', "export const f = () => fetch('https://example.org/x');\n")).toEqual([]);
  });
});

describe('storefront-project-bootstrap: client builder', () => {
  const code = "import { ClientBuilder } from '@commercetools/ts-client';\nexport const c = new ClientBuilder();\n";

  it('(e) new ClientBuilder( outside lib/ct/client.ts fails', () => {
    expect(lint('lib/ct/cart.ts', code).join('\n')).toMatch(/no-restricted-syntax/);
    expect(lint('app/api/x/route.ts', code).join('\n')).toMatch(/no-restricted-syntax/);
  });

  it('(e) new ClientBuilder( in lib/ct/client.ts is allowed', () => {
    expect(lint('lib/ct/client.ts', code)).toEqual([]);
  });
});

describe('storefront-project-bootstrap: Server-only modules guarded at build time', () => {
  function files(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  }

  it('every lib/ct/* and lib/session.* module imports server-only', () => {
    const modules = files(join(root, 'lib', 'ct'))
      .concat([join(root, 'lib', 'session.ts')].filter(existsSync))
      .filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path));
    const offenders = modules.filter((path) => !/^import ['"]server-only['"];?/m.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the server-only package is installed so the build can enforce the boundary', () => {
    expect(existsSync(join(root, 'node_modules', 'server-only', 'package.json'))).toBe(true);
  });
});
