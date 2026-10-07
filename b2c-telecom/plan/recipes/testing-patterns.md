# Testing patterns (Vitest + Testing Library) — copy these

All examples are TypeScript. Test files live next to the code. Never call the real commercetools API; mock `@/lib/ct/*`.

## 1. Pure functions
```ts
import { describe, it, expect } from 'vitest';
import { unitPrice } from '@/lib/pricing';

describe('unitPrice', () => {
  it('500 g pack: per-kg price', () => {
    const r = unitPrice({ centAmount: 240, currencyCode: 'EUR' }, { value: 500, unit: 'g', label: '500 g' });
    expect(r).toEqual({ money: { centAmount: 480, currencyCode: 'EUR' }, per: 'kg' });
  });
});
```

## 2. Route handlers (Node environment)
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() , updateSession: vi.fn() }));
vi.mock('@/lib/ct/cart', () => ({ getCart: vi.fn() }));

import { GET } from './route';
import { getSession } from '@/lib/session';
import { getCart } from '@/lib/ct/cart';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/cart', () => {
  it('no cart id: returns { cart: null }', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await GET(new Request('http://localhost/api/cart') as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cart: null });
    expect(getCart).not.toHaveBeenCalled();
  });
});
```
POST bodies: `new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({...}) })`. Route handlers that read the `cookies()` store: mock `next/headers`:
```ts
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n === 'malva-session' ? { value: token } : undefined) }),
  headers: async () => new Headers({ 'x-pathname': '/en-US/account/orders' }),
}));
```

## 3. Async Server Components
Call the component as a function, then render the returned element:
```tsx
import { render, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ShopPage from './page';

vi.mock('@/lib/ct/search', () => ({ searchProducts: vi.fn().mockResolvedValue({ products: [], total: 0, page: 1, pageSize: 24, facets: { categories: [], priceBands: [], availability: { inStock: 0, outOfStock: 0 } } }) }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/session', () => ({ getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));

it('shows the empty state', async () => {
  const ui = await ShopPage({ searchParams: Promise.resolve({ category: 'nope' }), params: Promise.resolve({ locale: 'en-US' }) });
  renderWithProviders(ui);
  expect(screen.getByRole('heading', { name: /nothing under those terms/i })).toBeInTheDocument();
});
```
Pages that call `notFound()`: mock `next/navigation` with `notFound: () => { throw new Error('NOT_FOUND') }` and `await expect(Page(...)).rejects.toThrow('NOT_FOUND')`.

## 4. Client hooks with SWR
```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ cart: null }), { status: 200 })));
const { result } = renderHook(() => useCart(), { wrapper });
await waitFor(() => expect(result.current.data).toBeNull());
```
Mutation errors: `fetch` resolves `new Response(JSON.stringify({ error: 'INSUFFICIENT_STOCK', available: 3 }), { status: 409 })` and assert the thrown `ApiError` has `status 409` and `data.available === 3`.

## 5. next-intl and navigation
- Components using `useTranslations` / `Link` from `@/i18n/routing`: always render through `renderWithProviders(ui, { locale })`.
- Mock the router when asserting navigation:
```ts
const replace = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({ ...(await orig<typeof import('@/i18n/routing')>()), useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/shop' }));
```
- `next/font/google` and `server-only` are stubbed globally (C-03, B-02).

## 6. Time
Use `vi.useFakeTimers()` and `vi.setSystemTime(new Date('2026-10-12T09:00:00Z'))`; always restore with `vi.useRealTimers()` in `afterEach`. Inject clocks (`now: () => Date`) into services (slots) instead of faking globals where possible.

## 7. What not to do
No snapshot tests of whole pages; no real network; no `any`; no sleeping (`await new Promise(r => setTimeout…)`) — use `waitFor`/fake timers.
