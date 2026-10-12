import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = path.resolve(import.meta.dirname, '..');
const eslint = new ESLint({ cwd, overrideConfigFile: path.join(cwd, 'eslint.config.mjs') });
const fixture = (name) => readFileSync(path.join(cwd, 'eslint', 'fixtures', name), 'utf8');

async function messages(name, filePath) {
  const [result] = await eslint.lintText(fixture(name), { filePath: path.join(cwd, filePath) });
  return result.messages;
}
const text = (msgs) => msgs.map((m) => `${m.ruleId}: ${m.message}`).join('\n');

describe('ESLint rules', () => {
  it('Single client', async () => {
    expect(text(await messages('single-client.bad.tsx', 'lib/ct/other.ts'))).toMatch(/no-restricted-syntax: new ClientBuilder\(\) is allowed only in lib\/ct\/client\.ts/);
    expect(text(await messages('single-client.bad.tsx', 'app/api/x/route.ts'))).toMatch(/new ClientBuilder\(\)/);
    // good: the one allowed file
    expect(await messages('single-client.bad.tsx', 'lib/ct/client.ts')).toEqual([]);
  });

  it('No raw HTTP to commercetools', async () => {
    const bad = text(await messages('raw-commercetools-http.bad.tsx', 'lib/foo.ts'));
    expect(bad.match(/no-raw-commercetools-http/g)).toHaveLength(3);
    expect(text(await messages('raw-commercetools-http.bad.tsx', 'app/api/x/route.ts'))).toMatch(/no-raw-commercetools-http/);
    expect(text(await messages('raw-commercetools-http.bad.tsx', 'components/Foo.tsx'))).toMatch(/no-raw-commercetools-http/);
    // good: the client file, and the Import API module
    expect(await messages('raw-commercetools-http.bad.tsx', 'lib/ct/client.ts')).toEqual([]);
    expect(await messages('raw-commercetools-http.bad.tsx', 'lib/import/import-api.ts')).toEqual([]);
  });

  it('SDK outside lib/ct', async () => {
    expect(text(await messages('sdk-outside-lib-ct.bad.tsx', 'lib/foo.ts'))).toMatch(/no-restricted-imports.*lib\/ct\/\*\* and lib\/mappers/);
    expect(text(await messages('sdk-outside-lib-ct.bad.tsx', 'components/Foo.tsx'))).toMatch(/no-restricted-imports/);
    // good
    expect(await messages('sdk-outside-lib-ct.bad.tsx', 'lib/ct/carts.ts')).toEqual([]);
    expect(await messages('sdk-outside-lib-ct.bad.tsx', 'lib/mappers/cart.ts')).toEqual([]);
  });

  it('Hook-only fetching', async () => {
    const bad = text(await messages('hook-only-fetching.bad.tsx', 'components/Cart.tsx'));
    expect(bad.match(/hook-only fetching/g)).toHaveLength(2);
    expect(text(await messages('hook-only-fetching.bad.tsx', 'app/[locale]/page.tsx'))).toMatch(/hook-only fetching/);
    // good: hooks may fetch
    expect(await messages('hook-only-fetching.bad.tsx', 'hooks/useCart.ts')).toEqual([]);
  });

  it('Locale-aware navigation only', async () => {
    const bad = text(await messages('locale-aware-navigation.bad.tsx', 'components/Nav.tsx'));
    expect(bad).toMatch(/next\/link/);
    expect(bad).toMatch(/redirect/);
    expect(text(await messages('locale-aware-navigation.bad.tsx', 'app/[locale]/page.tsx'))).toMatch(/locale-aware navigation only/);
    // good: routing module, notFound and useSearchParams stay allowed
    expect(await messages('locale-aware-navigation.good.tsx', 'components/Nav.tsx')).toEqual([]);
    expect(await messages('locale-aware-navigation.good.tsx', 'app/[locale]/page.tsx')).toEqual([]);
  });

  it('createContext footgun', async () => {
    expect(text(await messages('create-context-footgun.bad.tsx', 'app/[locale]/page.tsx'))).toMatch(/malva\/no-puck-in-server: Value import from '@commercetools-demo\/puck-page-manager'/);
    expect(text(await messages('create-context-footgun.bad.tsx', 'lib/contentools/puck.tsx'))).toMatch(/no-puck-in-server/);
    // good: behind 'use client', plus import type
    expect(await messages('create-context-footgun.good.tsx', 'app/[locale]/store/ContentoolsWrapper.tsx')).toEqual([]);
  });

  it('Admin client fence', async () => {
    const bad = text(await messages('admin-client-fence.bad.tsx', 'app/api/orders/route.ts'));
    expect(bad).toMatch(/admin client is importable only from app\/api\/seller/);
    expect(bad).toMatch(/provisioning client is importable only from app\/api\/auth\/register/);
    expect(text(await messages('admin-client-fence.bad.tsx', 'components/Foo.tsx'))).toMatch(/admin client/);
    expect(text(await messages('admin-client-fence.good.tsx', 'lib/ct/carts.ts'))).toMatch(/admin client/);
    // good: the allowed folders
    expect(await messages('admin-client-fence.good.tsx', 'app/api/seller/prices/route.ts')).toEqual([]);
    expect(await messages('admin-client-fence.good.tsx', 'lib/ct/seller/prices.ts')).toEqual([]);
    expect(await messages('admin-client-fence.good.tsx', 'lib/contentools/jwt.ts')).toEqual([]);
    const register = text(await messages('admin-client-fence.bad.tsx', 'app/api/auth/register/route.ts'));
    expect(register).toMatch(/admin client/);
    expect(register).not.toMatch(/provisioning client is importable/);
  });
});
