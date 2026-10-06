// @vitest-environment node
import path from 'node:path';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: __dirname, overrideConfigFile: path.join(__dirname, 'eslint.config.mjs') });

async function messages(code: string, file: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(__dirname, file) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports' || m.ruleId === 'no-restricted-syntax');
}

describe('layering rules (B-03)', () => {
  it('Client importing server code: a component importing @/lib/ct/cart errors', async () => {
    expect(await messages("import { getCart } from '@/lib/ct/cart';\nexport const x = getCart;\n", 'components/ui/x.tsx')).toHaveLength(1);
  });
  it('a hook importing the session module errors', async () => {
    expect(await messages("import { getSession } from '@/lib/session';\nexport const x = getSession;\n", 'hooks/useX.ts')).toHaveLength(1);
  });
  it('SDK types in a component: importing @commercetools/platform-sdk errors', async () => {
    expect(await messages("import type { Cart } from '@commercetools/platform-sdk';\nexport type X = Cart;\n", 'components/product/x.tsx')).toHaveLength(1);
  });
  it('app types from @/lib/types are fine in components', async () => {
    expect(await messages("import type { Cart } from '@/lib/types';\nexport type X = Cart;\n", 'components/ui/x.tsx')).toHaveLength(0);
  });
  it('a second ClientBuilder import errors, lib/ct/client.ts may have it', async () => {
    const code = "import { ClientBuilder } from '@commercetools/ts-client';\nexport const b = ClientBuilder;\n";
    expect(await messages(code, 'lib/ct/other.ts')).toHaveLength(1);
    expect(await messages(code, 'lib/ct/client.ts')).toHaveLength(0);
    expect(await messages(code, 'scripts/seed/lib.ts')).toHaveLength(0);
  });
});

describe('navigation idioms (B-04)', () => {
  it('next/link default import errors; @/i18n/routing is fine', async () => {
    expect(await messages("import Link from 'next/link';\nexport const L = Link;\n", 'components/ui/x.tsx')).toHaveLength(1);
    expect(await messages("import { Link } from '@/i18n/routing';\nexport const L = Link;\n", 'components/ui/x.tsx')).toHaveLength(0);
  });
  it('useRouter from next/navigation errors; notFound and useSearchParams are allowed', async () => {
    expect(await messages("import { useRouter } from 'next/navigation';\nexport const r = useRouter;\n", 'components/ui/x.tsx')).toHaveLength(1);
    expect(await messages("import { notFound, useSearchParams, useParams } from 'next/navigation';\nexport const r = [notFound, useSearchParams, useParams];\n", 'components/ui/x.tsx')).toHaveLength(0);
  });
  it('Redirect in try block: redirect() inside try with catch errors, outside is fine', async () => {
    const bad = "import { redirect } from '@/i18n/routing';\nexport function f() {\n  try {\n    redirect({ href: '/', locale: 'en-US' });\n  } catch (e) {\n    throw e;\n  }\n}\n";
    const ok = "import { redirect } from '@/i18n/routing';\nexport function f() {\n  redirect({ href: '/', locale: 'en-US' });\n}\n";
    expect(await messages(bad, 'app/[locale]/page.tsx')).toHaveLength(1);
    expect(await messages(ok, 'app/[locale]/page.tsx')).toHaveLength(0);
  });
  it('unstable_rethrow inside catch is fine', async () => {
    const code = "import { unstable_rethrow } from 'next/navigation';\nexport function f() {\n  try {\n    g();\n  } catch (e) {\n    unstable_rethrow(e);\n  }\n}\ndeclare function g(): void;\n";
    expect(await messages(code, 'app/[locale]/page.tsx')).toHaveLength(0);
  });
  it('i18n/** may import the raw navigation modules', async () => {
    expect(await messages("import Link from 'next/link';\nexport const L = Link;\n", 'i18n/navigation.ts')).toHaveLength(0);
  });
});

describe('fetch rules (B-05)', () => {
  it('raw commercetools fetch (string and template literal) is flagged outside lib/ct/checkout-session.ts', async () => {
    const str = "export const a = () => fetch('https://api.us-central1.gcp.commercetools.com/x');\n";
    const tpl = 'export const a = (p: string) => fetch(`https://api.us-central1.gcp.commercetools.com/${p}`);\n';
    expect(await messages(str, 'lib/ct/cart.ts')).toHaveLength(1);
    expect(await messages(tpl, 'lib/ct/cart.ts')).toHaveLength(1);
    expect(await messages(str, 'lib/ct/checkout-session.ts')).toHaveLength(0);
  });
  it("fetch('/api/cart') is flagged in components, allowed in hooks", async () => {
    const code = "export const a = () => fetch('/api/cart');\n";
    const tpl = 'export const a = (id: string) => fetch(`/api/cart/${id}`);\n';
    expect(await messages(code, 'components/ui/x.tsx')).toHaveLength(1);
    expect(await messages(tpl, 'components/ui/x.tsx')).toHaveLength(1);
    expect(await messages(code, 'hooks/useCart.ts')).toHaveLength(0);
  });
});
