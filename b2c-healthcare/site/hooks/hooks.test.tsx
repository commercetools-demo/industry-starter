import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { Linter } from 'eslint';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import tseslint from 'typescript-eslint';
import { describe, expect, it, vi } from 'vitest';
import { restrictionConfigs } from '@/eslint/restrictions.mjs';
import { KEY_ACCOUNT, KEY_ADDRESSES, KEY_CART, KEY_CART_DETAILS } from '@/lib/cache-keys';
import { useAccount } from './use-account';
import { useCart } from './use-cart';
import { clearPatientState, useClearPatientState } from './sign-out';

const wrapperWith = (fallback: Record<string, unknown>) => {
  const cache = new Map();
  const provider = () => cache;
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ fallback, provider }}>{children}</SWRConfig>;
  };
};

describe('storefront-data-loading: placeholder hooks', () => {
  it('useCart and useAccount read the fallback and call no endpoint', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const fallback = { [KEY_CART]: { id: 'k', version: 1, itemCount: 2, currencyCode: 'USD' }, [KEY_ACCOUNT]: { id: 'c1' } };
    const wrapper = wrapperWith(fallback);
    expect(renderHook(() => useCart(), { wrapper }).result.current.data).toEqual(fallback[KEY_CART]);
    expect(renderHook(() => useAccount(), { wrapper }).result.current.data).toEqual({ id: 'c1' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('storefront-data-loading: Cache keys and invalidation', () => {
  it('Sign-out: KEY_ACCOUNT, KEY_CART and KEY_CART_DETAILS are cleared client-side without revalidation', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined);
    await clearPatientState(mutate);
    expect(mutate).toHaveBeenCalledWith(KEY_ACCOUNT, null, { revalidate: false });
    expect(mutate).toHaveBeenCalledWith(KEY_CART, null, { revalidate: false });
    expect(mutate).toHaveBeenCalledWith(KEY_ADDRESSES, null, { revalidate: false });
    expect(mutate).toHaveBeenCalledWith(KEY_CART_DETAILS, null, { revalidate: false });
    expect(mutate).toHaveBeenCalledTimes(4);
  });

  it('Sign-out: after the hook callback runs, the cached cart and account are null, not the layout fallback', async () => {
    const cache = new Map<string, { data?: unknown }>();
    const fallback = { [KEY_CART]: { id: 'old' }, [KEY_ACCOUNT]: { id: 'c1' } };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SWRConfig value={{ fallback, provider: () => cache as never }}>{children}</SWRConfig>
    );
    const { result } = renderHook(() => ({ cart: useCart(), account: useAccount(), clear: useClearPatientState() }), { wrapper });
    expect(result.current.cart.data).toEqual({ id: 'old' });
    await act(async () => {
      await result.current.clear();
    });
    expect(cache.get(KEY_CART)?.data).toBeNull();
    expect(cache.get(KEY_ACCOUNT)?.data).toBeNull();
    expect(result.current.cart.data).toBeNull();
    expect(result.current.account.data).toBeNull();
  });
});

const root = resolve(__dirname, '..');
const linter = new Linter({ configType: 'flat', cwd: root });
const config = [
  { files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: tseslint.parser } },
  ...restrictionConfigs,
] as Linter.Config[];
const lint = (filename: string, code: string) => linter.verify(code, config, { filename: join(root, filename) });

describe('storefront-data-loading: No endpoint calls in components', () => {
  it('a component calling fetch(/api/...) directly fails lint', () => {
    expect(lint('components/ui/Cart.tsx', "export const f = () => fetch('/api/cart');\n")).not.toEqual([]);
    expect(lint('components/ui/Cart.tsx', 'export const f = (id: string) => fetch(`/api/cart/${id}`);\n')).not.toEqual([]);
  });

  it('a hook using a path constant from lib/api-paths passes lint', () => {
    const code = "import { API_CART } from '@/lib/api-paths';\nexport const load = () => fetch(API_CART);\n";
    expect(lint('hooks/use-cart-data.ts', code)).toEqual([]);
  });

  it('no file under hooks/, context/ or components/ contains a literal fetch of /api', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          if (/fetch\(\s*[`'"]\/api\//.test(readFileSync(full, 'utf8'))) offenders.push(full);
        }
      }
    };
    for (const d of ['hooks', 'context', 'components']) walk(join(root, d));
    expect(offenders).toEqual([]);
  });
});
