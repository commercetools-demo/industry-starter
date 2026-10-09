import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });
async function messages(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.severity === 2).map((m) => m.message);
}

describe('malva-project-bootstrap › Lint rules enforced', () => {
  it('client code cannot import server-only modules', async () => {
    const m = await messages("'use client';\nimport { x } from '@/lib/ct/client';\nexport const a = x;\n", 'app/[locale]/thing.tsx');
    expect(m.join('\n')).toMatch(/must not import server-only code/);
    expect((await messages("'use client';\nimport { s } from '@/lib/session';\nexport const a = s;\n", 'hooks/use-x.ts')).join('\n')).toMatch(/server-only/);
  });
  it('components and hooks cannot import @/lib/ct or @/lib/session even without the directive', async () => {
    expect((await messages("import { x } from '@/lib/ct/stores';\nexport const a = x;\n", 'components/ui/a.tsx')).join('\n')).toMatch(/Server-only code must not be imported/);
  });
  it('server components may import server code', async () => {
    expect(await messages("import { x } from '@/lib/ct/stores';\nexport default function P() { return x; }\n", 'app/[locale]/page.tsx')).toEqual([]);
  });
  it('the SDK is only allowed in lib/ct and lib/mappers', async () => {
    expect((await messages("import { Product } from '@commercetools/platform-sdk';\nexport type P = Product;\n", 'components/service/a.tsx')).join('\n')).toMatch(/only allowed in lib\/ct/);
    expect((await messages("import type { Product } from '@commercetools/platform-sdk';\nexport type P = Product;\n", 'lib/utils.ts')).join('\n')).toMatch(/only allowed in lib\/ct/);
    expect(await messages("import type { Product } from '@commercetools/platform-sdk';\nexport type P = Product;\n", 'lib/mappers/service.ts')).toEqual([]);
    expect(await messages("import { ClientBuilder } from '@commercetools/ts-client';\nexport const b = ClientBuilder;\n", 'lib/ct/client.ts')).toEqual([]);
  });
  it('locale UI must not use next/link or next/navigation redirects', async () => {
    expect((await messages("import Link from 'next/link';\nexport const L = Link;\n", 'components/layout/nav.tsx')).join('\n')).toMatch(/Link from '@\/i18n\/routing'/);
    expect((await messages("import { redirect } from 'next/navigation';\nexport const r = redirect;\n", 'app/[locale]/x/page.tsx')).join('\n')).toMatch(/redirect, useRouter and usePathname/);
    expect(await messages("import { notFound } from 'next/navigation';\nexport const r = notFound;\n", 'app/[locale]/x/page.tsx')).toEqual([]);
  });
  it('no fetch against a commercetools host', async () => {
    expect((await messages("export const r = () => fetch('https://api.europe-west1.gcp.commercetools.com/p/products');\n", 'lib/utils.ts')).join('\n')).toMatch(/Never call a commercetools host/);
    expect((await messages('export const r = (p: string) => fetch(`https://api.us-central1.gcp.commercetools.com/${p}`);\n', 'hooks/use-x.ts')).join('\n')).toMatch(/Never call a commercetools host/);
    expect(await messages("export const r = () => fetch('/api/cart');\n", 'hooks/use-cart.ts')).toEqual([]);
  });
  it('layouts must not read the session, cookies or headers', async () => {
    expect((await messages("import { cookies } from 'next/headers';\nexport default async function L() { await cookies(); return null; }\n", 'app/[locale]/layout.tsx')).join('\n')).toMatch(/Layouts must not/);
    expect((await messages("import { getSession } from '@/lib/session';\nexport default async function L() { await getSession(); return null; }\n", 'app/layout.tsx')).join('\n')).toMatch(/Layouts must not/);
    expect(await messages("export default function L() { return null; }\n", 'app/[locale]/layout.tsx')).toEqual([]);
    expect((await messages("import { cookies } from 'next/headers';\nexport default async function P() { await cookies(); return null; }\n", 'app/[locale]/account/page.tsx')).join('\n')).not.toMatch(/Layouts must not/);
  });
});
