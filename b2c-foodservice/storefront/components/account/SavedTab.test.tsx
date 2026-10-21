import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import SavedTab from '@/components/account/SavedTab';
import { useSavedItems } from '@/hooks/useSavedItems';
import { nav, renderShell, stubFetch } from '@/test/shell';
import type { ProductSummary, SavedItem } from '@/lib/types';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const pid = (n: number) => `3f1c2a9e-7a1b-4c53-9d0e-${String(n).padStart(12, '0')}`;
const card = (n: number): ProductSummary =>
  ({
    id: pid(n), slug: `p${n}`, sku: `SKU-${n}`, name: `Product ${n}`, categoryName: 'Pods', imageAlt: '', badge: null,
    price: { from: { centAmount: 1000 + n, currencyCode: 'USD' }, fromIsRange: false }, requiredChoice: null, rating: null, availability: null,
  }) as ProductSummary;
const item = (n: number, withCard = true): SavedItem => ({ productId: pid(n), variantId: null, lineItemId: `l${n}`, addedAt: '2026-10-01T00:00:00.000Z', name: `Saved ${n}`, product: withCard ? card(n) : null });
const list = (items: SavedItem[]) => ({ list: { id: 'sl1', version: 1, items } });
const ids = (items: SavedItem[]) => ({ list: { id: 'sl1', version: 1, items: items.map((i) => ({ ...i, product: null })) } });

beforeEach(() => {
  nav.pathname = '/account/saved';
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

// stubFetch matches by prefix in key order, so the longer paths go first.
const routes = (items: SavedItem[], extra: Record<string, (init?: RequestInit) => unknown> = {}) => ({
  '/api/shopping-lists/add-to-cart': () => ({}),
  '/api/shopping-lists?view=ids': () => ids(items),
  '/api/auth/me': () => ({ customer }),
  '/api/cart/count': () => ({ count: 0 }),
  '/api/shopping-lists': () => list(items),
  ...extra,
});

describe('Saved tab', () => {
  it('shows a card per saved product with the price from the product read', async () => {
    stubFetch(routes([item(1), item(2)]));
    renderShell(<SavedTab />);
    const grid = await screen.findByTestId('saved-grid');
    await waitFor(() => expect(within(grid).getAllByTestId('product-card')).toHaveLength(2));
    expect(within(grid).getAllByTestId('product-card')[0]).toHaveAttribute('data-price', '1001');
  });

  it('No lists yet: a plain empty state with Browse, and no from-bag button for an empty bag', async () => {
    stubFetch(routes([], { '/api/shopping-lists': () => ({ list: null }), '/api/shopping-lists?view=ids': () => ({ list: null }) }));
    renderShell(<SavedTab />);
    expect(await screen.findByText('Nothing saved yet. Tap the heart on any product.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/shop');
    expect(screen.queryByRole('button', { name: 'Save items from my bag' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add all to bag' })).toBeNull();
  });

  it('No lists yet with a bag: Save items from my bag posts fromCart and the list appears', async () => {
    let saved: SavedItem[] = [];
    const { calls } = stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/cart/count': () => ({ count: 3 }),
      '/api/shopping-lists?view=ids': () => ids(saved),
      '/api/shopping-lists': (init) => {
        if (init?.method === 'POST') {
          saved = [item(1)];
          return list(saved);
        }
        return saved.length ? list(saved) : { list: null };
      },
    });
    renderShell(<SavedTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Save items from my bag' }));
    await waitFor(() => expect(screen.getAllByTestId('product-card')).toHaveLength(1));
    expect(JSON.parse(String(calls.find((c) => c.init?.method === 'POST')?.init?.body))).toEqual({ fromCart: true });
  });

  it('Remove: the heart off leaves the grid at once', async () => {
    let saved = [item(1), item(2)];
    const { calls } = stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/cart/count': () => ({ count: 0 }),
      '/api/shopping-lists?view=ids': () => ids(saved),
      '/api/shopping-lists?productId=': (init) => {
        if (init?.method === 'DELETE') saved = saved.filter((i) => i.productId !== pid(1));
        return ids(saved);
      },
      '/api/shopping-lists': () => list(saved),
    });
    renderShell(<SavedTab />);
    const grid = await screen.findByTestId('saved-grid');
    await waitFor(() => expect(within(grid).getAllByTestId('product-card')).toHaveLength(2));
    await userEvent.click(within(grid).getByRole('button', { name: /Product 1/, pressed: true }));
    await waitFor(() => expect(within(screen.getByTestId('saved-grid')).getAllByTestId('product-card')).toHaveLength(1));
    expect(calls.some((c) => c.init?.method === 'DELETE' && c.url === `/api/shopping-lists?productId=${pid(1)}`)).toBe(true);
  });

  it('removing the last item shows the empty state', async () => {
    let saved = [item(1)];
    stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/cart/count': () => ({ count: 0 }),
      '/api/shopping-lists?view=ids': () => ids(saved),
      '/api/shopping-lists?productId=': () => {
        saved = [];
        return ids(saved);
      },
      '/api/shopping-lists': () => list(saved),
    });
    renderShell(<SavedTab />);
    await userEvent.click(await screen.findByRole('button', { name: /Product 1/, pressed: true }));
    expect(await screen.findByText('Nothing saved yet. Tap the heart on any product.')).toBeInTheDocument();
  });

  it('List converted in one operation: Add all to bag toasts the count and leaves the list as it is', async () => {
    const { calls } = stubFetch(
      routes([item(1), item(2)], {
        '/api/shopping-lists/add-to-cart': () => ({
          added: [{ sku: 'SKU-1', name: 'Product 1', quantity: 1, fulfilment: 'delivery' }, { sku: 'SKU-2', name: 'Product 2', quantity: 1, fulfilment: 'delivery' }],
          skipped: [], cart: { id: 'c', version: 1, count: 2, lines: [] },
        }),
        '/api/cart': () => ({ cart: null }),
      }),
    );
    renderShell(<SavedTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add all to bag' }));
    expect(await screen.findByText('2 items added to your bag.')).toBeInTheDocument();
    expect(calls.filter((c) => c.init?.method === 'POST' && c.url === '/api/shopping-lists/add-to-cart')).toHaveLength(1);
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false);
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
  });

  it('Line no longer purchasable: the excluded one is named with its reason in a dialog', async () => {
    stubFetch(
      routes([item(1), item(2)], {
        '/api/shopping-lists/add-to-cart': () => ({
          added: [{ sku: 'SKU-1', name: 'Product 1', quantity: 1, fulfilment: 'delivery' }],
          skipped: [{ productId: pid(2), name: 'Product 2', reason: 'out_of_stock' }],
          cart: { id: 'c', version: 1, count: 1, lines: [] },
        }),
        '/api/cart': () => ({ cart: null }),
      }),
    );
    renderShell(<SavedTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add all to bag' }));
    const dialog = await screen.findByRole('dialog', { name: 'These items could not be added' });
    expect(within(dialog).getByTestId('skipped-lines')).toHaveTextContent('Product 2');
    expect(within(dialog).getByTestId('skipped-lines')).toHaveTextContent('Out of stock');
  });

  it('a product that is gone is listed as no longer available with a Remove button', async () => {
    stubFetch(routes([item(1), item(2, false)]));
    renderShell(<SavedTab />);
    const gone = await screen.findByTestId('saved-gone');
    expect(gone).toHaveTextContent('Saved 2');
    expect(gone).toHaveTextContent('No longer available');
    expect(within(gone).getByRole('button', { name: 'Remove from saved' })).toBeInTheDocument();
  });

  it('a failing list read is this panel only, with Try again', async () => {
    stubFetch(routes([], { '/api/shopping-lists': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }) }));
    renderShell(<SavedTab />);
    expect(await screen.findByTestId('panel-error')).toHaveTextContent('Saved is unavailable right now.');
  });
});

function Probe() {
  const { ids: saved, toggle, isSaved } = useSavedItems();
  return (
    <>
      <p data-testid="ids">{[...saved].join(',')}</p>
      <p data-testid="a">{String(isSaved('a'))}</p>
      <button onClick={() => toggle('3f1c2a9e-7a1b-4c53-9d0e-0000000000aa')}>toggle</button>
    </>
  );
}

describe('useSavedItems', () => {
  it('signed out it keeps using sessionStorage and never calls the server', async () => {
    const { calls } = stubFetch({ '/api/auth/me': () => ({ customer: null }) });
    renderShell(<Probe />);
    await waitFor(() => expect(calls.some((c) => c.url === '/api/auth/me')).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('ids')).toHaveTextContent('3f1c2a9e-7a1b-4c53-9d0e-0000000000aa');
    expect(window.sessionStorage.getItem('mcf-saved')).toContain('0000000000aa');
    expect(calls.some((c) => c.url.startsWith('/api/shopping-lists'))).toBe(false);
  });

  it('Merge of guest saved ids: signed in, the guest ids are posted once and removed from the browser', async () => {
    window.sessionStorage.setItem('mcf-saved', JSON.stringify([pid(1), pid(2)]));
    const merged = [item(1), item(2)];
    const { calls } = stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/shopping-lists?view=ids': () => ({ list: null }),
      '/api/shopping-lists': (init) => (init?.method === 'POST' ? ids(merged) : { list: null }),
    });
    renderShell(
      <>
        <Probe />
        <Probe />
      </>,
    );
    await waitFor(() => expect(screen.getAllByTestId('ids')[0]).toHaveTextContent(`${pid(1)},${pid(2)}`));
    const posts = calls.filter((c) => c.init?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0].init?.body))).toEqual({ merge: [pid(1), pid(2)] });
    expect(window.sessionStorage.getItem('mcf-saved')).toBe('[]');
  });

  it('signed in, a toggle posts and is optimistic', async () => {
    const { calls } = stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/shopping-lists?view=ids': () => ({ list: null }),
      '/api/shopping-lists': (init) =>
        init?.method === 'POST' ? ids([{ ...item(1), productId: '3f1c2a9e-7a1b-4c53-9d0e-0000000000aa' }]) : { list: null },
    });
    renderShell(<Probe />);
    await waitFor(() => expect(calls.some((c) => c.url === '/api/shopping-lists?view=ids')).toBe(true));
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
    });
    await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent('0000000000aa'));
    expect(JSON.parse(String(calls.find((c) => c.init?.method === 'POST')?.init?.body))).toEqual({ productId: '3f1c2a9e-7a1b-4c53-9d0e-0000000000aa' });
  });

  it('a refused toggle returns the heart to its real state', async () => {
    stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/shopping-lists?view=ids': () => ({ list: null }),
      '/api/shopping-lists': (init) => (init?.method === 'POST' ? Response.json({ error: { code: 'list_full', message: 'x' } }, { status: 409 }) : { list: null }),
    });
    renderShell(<Probe />);
    await waitFor(() => expect(screen.getByTestId('ids')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent(''));
  });
});
