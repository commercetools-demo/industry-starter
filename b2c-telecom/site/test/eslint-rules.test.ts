// @vitest-environment node
import path from 'node:path';
import { ESLint } from 'eslint';

const SITE = path.resolve(__dirname, '..');
const RULES = new Set(['no-restricted-imports', 'no-restricted-syntax', 'no-restricted-globals']);

const eslint = new ESLint({ cwd: SITE, overrideConfigFile: path.join(SITE, 'eslint.config.mjs') });

/** Messages of the layering rules only (other rules of the Next config are not under test here). */
async function lint(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(SITE, filePath) });
  return result.messages.filter((m) => m.ruleId !== null && RULES.has(m.ruleId)).map((m) => m.message);
}

describe('Client code imports a server module', () => {
  it('Client code imports a server module: a component importing @/lib/ct/cart errors', async () => {
    const messages = await lint("import { getCart } from '@/lib/ct/cart';\nexport const x = getCart;\n", 'components/ui/Probe.tsx');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('@/lib/types');
  });

  it('a hook importing jose errors', async () => {
    const messages = await lint("import { SignJWT } from 'jose';\nexport const x = SignJWT;\n", 'hooks/useProbe.ts');
    expect(messages).toHaveLength(1);
  });

  it('a context module importing @/lib/mappers/cart errors', async () => {
    const messages = await lint("import { mapCart } from '@/lib/mappers/cart';\nexport const x = mapCart;\n", 'context/Probe.tsx');
    expect(messages).toHaveLength(1);
  });

  it('a component importing next/headers errors', async () => {
    const messages = await lint("import { cookies } from 'next/headers';\nexport const x = cookies;\n", 'components/ui/Probe.tsx');
    expect(messages).toHaveLength(1);
  });

  it('a relative ../../lib/ct/cart import in a component errors', async () => {
    const messages = await lint("import { getCart } from '../../lib/ct/cart';\nexport const x = getCart;\n", 'components/ui/Probe.tsx');
    expect(messages).toHaveLength(1);
  });

  it('a server page may import @/lib/ct/cart', async () => {
    const messages = await lint("import { getCart } from '@/lib/ct/cart';\nexport const x = getCart;\n", 'app/[locale]/bundle/page.tsx');
    expect(messages).toEqual([]);
  });

  it('a second client builder import errors in lib/ct/other.ts but not in lib/ct/client.ts or scripts/seed/lib.ts', async () => {
    const code = "import { ClientBuilder } from '@commercetools/ts-client';\nexport const x = ClientBuilder;\n";
    expect(await lint(code, 'lib/ct/other.ts')).toHaveLength(1);
    expect(await lint(code, 'lib/ct/client.ts')).toEqual([]);
    expect(await lint(code, 'scripts/seed/lib.ts')).toEqual([]);
    expect(await lint(code, 'scripts/seed/other.ts')).toHaveLength(1);
  });

  it('the same server import in components/ui/x.test.tsx is allowed', async () => {
    const messages = await lint("import { getCart } from '@/lib/ct/cart';\nexport const x = getCart;\n", 'components/ui/x.test.tsx');
    expect(messages).toEqual([]);
  });
});

describe('Component imports a platform type', () => {
  it('Component imports a platform type: import type from @commercetools/platform-sdk errors and the message points to @/lib/types', async () => {
    const messages = await lint("import type { Cart } from '@commercetools/platform-sdk';\nexport type X = Cart;\n", 'components/bundle/Probe.tsx');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('@/lib/types');
  });

  it('import type from @/lib/ct/... in a component errors', async () => {
    const messages = await lint("import type { Session } from '@/lib/ct/session';\nexport type X = Session;\n", 'components/bundle/Probe.tsx');
    expect(messages).toHaveLength(1);
  });

  it('import type from @/lib/types in a component is fine', async () => {
    const messages = await lint("import type { Cart } from '@/lib/types';\nexport type X = Cart;\n", 'components/bundle/Probe.tsx');
    expect(messages).toEqual([]);
  });
});

describe('Locale-aware navigation', () => {
  it('a default import of next/link errors', async () => {
    const messages = await lint("import Link from 'next/link';\nexport const x = Link;\n", 'components/ui/Probe.tsx');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('@/i18n/routing');
  });

  it('Link from @/i18n/routing is fine', async () => {
    const messages = await lint("import { Link } from '@/i18n/routing';\nexport const x = Link;\n", 'components/ui/Probe.tsx');
    expect(messages).toEqual([]);
  });

  it('useRouter from next/navigation errors', async () => {
    const messages = await lint("import { useRouter } from 'next/navigation';\nexport const x = useRouter;\n", 'components/ui/Probe.tsx');
    expect(messages).toHaveLength(1);
  });

  it('redirect from next/navigation errors in a page', async () => {
    const messages = await lint("import { redirect } from 'next/navigation';\nexport const x = redirect;\n", 'app/[locale]/page.tsx');
    expect(messages).toHaveLength(1);
  });

  it('notFound, useSearchParams and useParams from next/navigation are allowed', async () => {
    const code = "import { notFound, useSearchParams, useParams } from 'next/navigation';\nexport const x = [notFound, useSearchParams, useParams];\n";
    expect(await lint(code, 'components/ui/Probe.tsx')).toEqual([]);
  });

  it('redirect() inside try/catch errors', async () => {
    const code = "import { redirect } from '@/i18n/routing';\nexport function go() {\n  try {\n    redirect({ href: '/', locale: 'en-US' });\n  } catch {\n    return null;\n  }\n}\n";
    const messages = await lint(code, 'lib/ct/other.ts');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('unstable_rethrow');
  });

  it('notFound() inside try/catch errors', async () => {
    const code = "import { notFound } from 'next/navigation';\nexport function go() {\n  try {\n    notFound();\n  } catch {\n    return null;\n  }\n}\n";
    expect(await lint(code, 'app/[locale]/x/helper.ts')).toHaveLength(1);
  });

  it('redirect() outside try/catch is fine', async () => {
    const code = "import { redirect } from '@/i18n/routing';\nexport function go() {\n  redirect({ href: '/', locale: 'en-US' });\n}\n";
    expect(await lint(code, 'lib/ct/other.ts')).toEqual([]);
  });

  it('unstable_rethrow inside the catch is fine', async () => {
    const code = "import { unstable_rethrow } from 'next/navigation';\nexport function go() {\n  try {\n    return 1;\n  } catch (error) {\n    unstable_rethrow(error);\n    return null;\n  }\n}\n";
    expect(await lint(code, 'lib/ct/other.ts')).toEqual([]);
  });

  it('i18n/navigation.ts may import next/link and next/navigation', async () => {
    const code = "import Link from 'next/link';\nimport { useRouter, redirect } from 'next/navigation';\nexport const x = [Link, useRouter, redirect];\n";
    expect(await lint(code, 'i18n/navigation.ts')).toEqual([]);
  });
});

describe('Raw commercetools fetch', () => {
  const literal = "export const load = () => fetch('https://api.us-central1.gcp.commercetools.com/x');\n";
  const template = 'const project = "p";\nexport const load = () => fetch(`https://api.us-central1.gcp.commercetools.com/${project}`);\n';

  it('a fetch to commercetools (string and template literal) is flagged in lib/ct/other.ts', async () => {
    expect(await lint(literal, 'lib/ct/other.ts')).toHaveLength(1);
    expect(await lint(template, 'lib/ct/other.ts')).toHaveLength(1);
  });

  it('a fetch to commercetools is allowed in lib/ct/checkout.ts and scripts/seed/x.ts', async () => {
    expect(await lint(literal, 'lib/ct/checkout.ts')).toEqual([]);
    expect(await lint(template, 'lib/ct/checkout.ts')).toEqual([]);
    expect(await lint(literal, 'scripts/seed/x.ts')).toEqual([]);
  });

  it('redirect() inside try/catch still errors in lib/ct/checkout.ts and scripts', async () => {
    const code = "import { redirect } from '@/i18n/routing';\nexport function go() {\n  try {\n    redirect({ href: '/', locale: 'en-US' });\n  } catch {\n    return null;\n  }\n}\n";
    expect(await lint(code, 'lib/ct/checkout.ts')).toHaveLength(1);
    expect(await lint(code, 'scripts/seed/x.ts')).toHaveLength(1);
  });
});

describe('Mutable user state loaded through the client layer', () => {
  const inline = "export const load = () => fetch('/api/cart');\n";
  const inlineTemplate = 'export const load = (id: string) => fetch(`/api/cart/${id}`);\n';

  it("Mutable user state loaded through the client layer: fetch('/api/cart') inside components errors, inside hooks is allowed", async () => {
    expect(await lint(inline, 'components/offers/x.tsx')).toHaveLength(1);
    expect(await lint(inlineTemplate, 'components/offers/x.tsx')).toHaveLength(1);
    expect(await lint(inline, 'hooks/useCart.ts')).toEqual([]);
    expect(await lint(inlineTemplate, 'hooks/useCart.ts')).toEqual([]);
  });

  it('a component fetch to a non-API URL is not flagged by the inline rule', async () => {
    expect(await lint("export const load = () => fetch('/healthz');\n", 'components/offers/x.tsx')).toEqual([]);
  });
});

describe('Catalog page loaded on the server', () => {
  const page = 'app/[locale]/shop/[slug]/page.tsx';

  it('Catalog page loaded on the server: a page.tsx that is a client module or fetches /api errors', async () => {
    const client = "'use client';\n\nexport default function Page() {\n  return null;\n}\n";
    const clientMessages = await lint(client, page);
    expect(clientMessages).toHaveLength(1);
    expect(clientMessages[0]).toContain('Server Components');

    const fetching = "export default async function Page() {\n  await fetch('/api/offers');\n  return null;\n}\n";
    expect(await lint(fetching, page)).toHaveLength(1);
  });

  it('a layout.tsx that is a client module errors', async () => {
    expect(await lint("'use client';\n\nexport default function Layout() {\n  return null;\n}\n", 'app/[locale]/layout.tsx')).toHaveLength(1);
  });

  it('a plain async page is fine', async () => {
    const code = 'export default async function Page() {\n  const data = await Promise.resolve(1);\n  return data;\n}\n';
    expect(await lint(code, page)).toEqual([]);
  });

  it('error.tsx and global-error.tsx may be client modules', async () => {
    const client = "'use client';\n\nexport default function ErrorPage() {\n  return null;\n}\n";
    expect(await lint(client, 'app/[locale]/error.tsx')).toEqual([]);
    expect(await lint(client, 'app/global-error.tsx')).toEqual([]);
  });
});
