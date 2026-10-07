// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkBoundaries } from './check-boundaries.mjs';

let dir: string;

function write(rel: string, content: string) {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'boundaries-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const SERVER_MODULE = "import 'server-only';\nexport const getCart = () => 1;\n";

describe('check-boundaries', () => {
  it('a clean project reports nothing', () => {
    write('lib/ct/cart.ts', SERVER_MODULE);
    write('lib/ct/env-core.ts', 'export const env = 1;\n');
    write('lib/mappers/cart.ts', "import 'server-only';\nimport type { Cart } from '@commercetools/platform-sdk';\nexport type X = Cart;\n");
    write('lib/types.ts', 'export type Money = { centAmount: number };\n');
    write('lib/fetcher.ts', "export const fetcher = (url: string) => fetch('/api/x' + url);\n");
    write('hooks/useCart.ts', "export const useCart = () => fetch('/api/cart');\n");
    write('components/ui/A.tsx', "import type { Money } from '@/lib/types';\nexport const A = (m: Money) => m;\n");
    write('app/[locale]/page.tsx', "import { getCart } from '@/lib/ct/cart';\nexport default async function Page() {\n  return getCart();\n}\n");
    write('app/[locale]/error.tsx', "'use client';\nexport default function E() {\n  return null;\n}\n");
    write('app/global-error.tsx', "'use client';\nexport default function E() {\n  return null;\n}\n");
    write('components/ui/A.test.tsx', "import { getCart } from '@/lib/ct/cart';\nfetch('/api/x');\nexport const t = getCart;\n");
    write('test/helper.ts', "import { getCart } from '@/lib/ct/cart';\nexport const t = getCart;\n");
    expect(checkBoundaries(dir)).toEqual([]);
  });

  it('Client code imports a server module: transitive reach through a helper is reported with the chain', () => {
    write('lib/ct/cart.ts', SERVER_MODULE);
    write('lib/format.ts', "import { getCart } from './ct/cart';\nexport const format = getCart;\n");
    write('components/ui/A.tsx', "import { format } from '@/lib/format';\nexport const A = format;\n");
    expect(checkBoundaries(dir)).toEqual([
      'boundary: components/ui/A.tsx -> lib/format.ts -> lib/ct/cart.ts (client code reaches a server-only module)',
    ]);
  });

  it('a direct relative import from a client file and a use client file outside components are reported', () => {
    write('lib/ct/cart.ts', SERVER_MODULE);
    write('components/ui/A.tsx', "import { getCart } from '../../lib/ct/cart';\nexport const A = getCart;\n");
    write('lib/widget.tsx', "'use client';\nimport { getCart } from '@/lib/ct/cart';\nexport const W = getCart;\n");
    const problems = checkBoundaries(dir);
    expect(problems).toContain('boundary: components/ui/A.tsx -> lib/ct/cart.ts (client code reaches a server-only module)');
    expect(problems).toContain('boundary: lib/widget.tsx -> lib/ct/cart.ts (client code reaches a server-only module)');
  });

  it('a client file reaching a server-only package is reported', () => {
    write('components/ui/A.tsx', "import { SignJWT } from 'jose';\nexport const A = SignJWT;\n");
    write('hooks/useX.ts', "import { cookies } from 'next/headers';\nexport const x = cookies;\n");
    const problems = checkBoundaries(dir);
    expect(problems).toContain('boundary: components/ui/A.tsx -> jose (client code reaches a server-only module)');
    expect(problems).toContain('boundary: hooks/useX.ts -> next/headers (client code reaches a server-only module)');
  });

  it('a server page importing a server module is not a client reach', () => {
    write('lib/ct/cart.ts', SERVER_MODULE);
    write('app/[locale]/bundle/page.tsx', "import { getCart } from '@/lib/ct/cart';\nexport default getCart;\n");
    expect(checkBoundaries(dir)).toEqual([]);
  });

  it('a lib/ct or lib/mappers file without the server-only marker is reported', () => {
    write('lib/ct/cart.ts', 'export const getCart = 1;\n');
    write('lib/mappers/cart.ts', 'export const mapCart = 1;\n');
    write('lib/ct/env-core.ts', 'export const env = 1;\n');
    expect(checkBoundaries(dir)).toEqual([
      "boundary: lib/ct/cart.ts is missing import 'server-only'",
      "boundary: lib/mappers/cart.ts is missing import 'server-only'",
    ]);
  });

  it('a lib file importing next/headers or the SDK without the marker is reported', () => {
    write('lib/session.ts', "import { cookies } from 'next/headers';\nexport const s = cookies;\n");
    write('lib/other.ts', "import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';\nexport const o = createApiBuilderFromCtpClient;\n");
    const problems = checkBoundaries(dir);
    expect(problems).toContain("boundary: lib/session.ts imports next/headers without import 'server-only'");
    expect(problems).toContain("boundary: lib/other.ts imports @commercetools/platform-sdk without import 'server-only'");
  });

  it('SDK only in the server layer: an import in app/ is reported even when type-only', () => {
    write('app/[locale]/x/page.tsx', "import type { Cart } from '@commercetools/platform-sdk';\nexport default function P(props: { c: Cart }) {\n  return props;\n}\n");
    expect(checkBoundaries(dir)).toEqual([
      'boundary: app/[locale]/x/page.tsx imports @commercetools/platform-sdk (only lib/ct and lib/mappers may)',
    ]);
  });

  it('Catalog page loaded on the server: a client page.tsx is reported', () => {
    write('app/[locale]/shop/[slug]/page.tsx', "'use client';\nexport default function P() {\n  return null;\n}\n");
    write('app/[locale]/layout.tsx', "'use client';\nexport default function L() {\n  return null;\n}\n");
    const problems = checkBoundaries(dir);
    expect(problems).toHaveLength(2);
    expect(problems).toContain('boundary: app/[locale]/layout.tsx is a client module (pages are Server Components)');
    expect(problems).toContain('boundary: app/[locale]/shop/[slug]/page.tsx is a client module (pages are Server Components)');
  });

  it('Mutable user state loaded through the client layer: inline /api fetch outside hooks is reported', () => {
    write('components/offers/Card.tsx', "export const load = () => fetch('/api/cart');\n");
    write('lib/other.ts', 'export const load = (id: string) => fetch(`/api/cart/${id}`);\n');
    write('hooks/useCart.ts', "export const load = () => fetch('/api/cart');\n");
    write('lib/fetcher.ts', "export const load = () => fetch('/api/cart');\n");
    const problems = checkBoundaries(dir);
    expect(problems).toHaveLength(2);
    expect(problems).toContain('boundary: components/offers/Card.tsx fetches /api inline (use a hook)');
    expect(problems).toContain('boundary: lib/other.ts fetches /api inline (use a hook)');
  });

  it('imports inside comments are ignored', () => {
    write('lib/ct/cart.ts', SERVER_MODULE);
    write('components/ui/A.tsx', "// import { getCart } from '@/lib/ct/cart';\n/* import { x } from 'jose'; */\nexport const A = 1;\n");
    expect(checkBoundaries(dir)).toEqual([]);
  });

  it('handles multi-line, re-export and dynamic imports', () => {
    write('lib/ct/cart.ts', SERVER_MODULE);
    write('components/ui/A.tsx', "export { getCart } from '@/lib/ct/cart';\n");
    write('components/ui/B.tsx', "import {\n  getCart,\n} from '@/lib/ct/cart';\nexport const B = getCart;\n");
    write('components/ui/C.tsx', "export const C = () => import('@/lib/ct/cart');\n");
    expect(checkBoundaries(dir)).toHaveLength(3);
  });
});
