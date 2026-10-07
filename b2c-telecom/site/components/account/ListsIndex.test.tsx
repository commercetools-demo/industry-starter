import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

const push = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

import { ListsIndex } from './ListsIndex';

let cart: unknown;
let calls: Array<{ url: string; method: string; body: unknown }>;
beforeEach(() => {
  push.mockClear();
  calls = [];
  cart = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (url === '/api/cart') return new Response(JSON.stringify({ cart }), { status: 200 });
      if (url === '/api/account/lists' && init?.method === 'POST') return new Response(JSON.stringify({ list: { id: 'new-list', name: 'Home setup', lines: [] } }), { status: 201 });
      return new Response(JSON.stringify({ lists: [] }), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('ListsIndex', () => {
  it('No lists yet: stated plainly with a path to create a first list from the current bundle', async () => {
    renderWithProviders(<ListsIndex initial={[]} />);
    expect(screen.getByText('You have no saved lists yet.')).toBeInTheDocument();
    expect(screen.getByText('A list keeps offers you want to come back to. Start one from the bundle you are building now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save my bundle as a list' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse plans' })).toHaveAttribute('href', '/en-US/shop/phone-plans');
  });

  it('disables the create button with a reason while the bundle is empty', async () => {
    renderWithProviders(<ListsIndex initial={[]} />);
    expect(screen.getByRole('button', { name: 'Save my bundle as a list' })).toBeDisabled();
    expect(screen.getByText('Your bundle is empty.')).toBeInTheDocument();
  });

  it('creates a list from the bundle and opens it', async () => {
    const user = userEvent.setup();
    cart = { id: 'c1', lines: [{ id: 'a' }, { id: 'b' }] };
    renderWithProviders(<ListsIndex initial={[]} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save my bundle as a list' })).toBeEnabled());
    expect(screen.queryByText('Your bundle is empty.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save my bundle as a list' }));
    await user.type(screen.getByLabelText('List name'), 'Home setup');
    await user.click(screen.getByRole('button', { name: 'Create list' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/lists/new-list'));
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ name: 'Home setup', fromCart: true });
  });

  it('refuses an empty name without sending anything', async () => {
    const user = userEvent.setup();
    cart = { id: 'c1', lines: [{ id: 'a' }] };
    renderWithProviders(<ListsIndex initial={[]} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save my bundle as a list' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save my bundle as a list' }));
    await user.click(screen.getByRole('button', { name: 'Create list' }));
    expect(screen.getByText('Enter a name of up to 60 characters.')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('lists existing lists with their count and a link, and offers "New list"', () => {
    renderWithProviders(<ListsIndex initial={[{ id: 'l1', name: 'Home setup', lineCount: 2, updatedAt: '2026-10-07T10:00:00Z' }]} />);
    expect(screen.getByRole('link', { name: 'Home setup' })).toHaveAttribute('href', '/en-US/account/lists/l1');
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument();
  });
});
