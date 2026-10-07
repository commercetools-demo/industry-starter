import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), usePathname: () => '/shop/phone-plans', useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import { SaveToListButton } from './SaveToListButton';

let sessionKind: 'customer' | 'anonymous';
let calls: Array<{ url: string; method: string; body: unknown }>;
let addStatus: number;

beforeEach(() => {
  sessionKind = 'customer';
  addStatus = 200;
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (url === '/api/auth/session') return new Response(JSON.stringify({ session: { kind: sessionKind, hasCart: false } }), { status: 200 });
      if (url === '/api/account/lists' && (init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ lists: [{ id: 'l1', name: 'Home setup', lineCount: 1, updatedAt: 'x' }] }), { status: 200 });
      if (url === '/api/account/lists' && init?.method === 'POST') return new Response(JSON.stringify({ list: { id: 'l2', name: 'Office', lines: [] } }), { status: 201 });
      if (url.endsWith('/lines')) {
        return addStatus === 200 ? new Response(JSON.stringify({ list: { id: 'l1', name: 'Home setup', lines: [] } }), { status: 200 }) : new Response(JSON.stringify({ error: { code: 'LIST_FULL', message: 'full' } }), { status: addStatus });
      }
      return new Response(JSON.stringify({ lists: [] }), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('SaveToListButton', () => {
  it('anonymous: "Save for later" links to sign-in and returns to this page afterwards', async () => {
    sessionKind = 'anonymous';
    renderWithProviders(<SaveToListButton offerKey="malva-offer-x" />);
    const link = await screen.findByRole('link', { name: 'Save for later' });
    expect(link).toHaveAttribute('href', `/en-US/login?returnTo=${encodeURIComponent('/en-US/shop/phone-plans')}`);
    expect(calls.some((call) => call.url.startsWith('/api/account'))).toBe(false);
  });

  it('signed in: choosing a list saves the offer variant and confirms with a toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaveToListButton offerKey="malva-offer-x" variantId={2} />);
    await user.click(await screen.findByRole('button', { name: 'Save to list' }));
    await user.click(await screen.findByLabelText('Home setup'));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/account/lists/l1/lines')?.body).toEqual({ offerKey: 'malva-offer-x', variantId: 2 }));
    expect(await screen.findByText('Saved to Home setup')).toBeInTheDocument();
  });

  it('says so when the list is full', async () => {
    const user = userEvent.setup();
    addStatus = 422;
    renderWithProviders(<SaveToListButton offerKey="malva-offer-x" />);
    await user.click(await screen.findByRole('button', { name: 'Save to list' }));
    await user.click(await screen.findByLabelText('Home setup'));
    expect(await screen.findByText('This list is full (25 items).')).toBeInTheDocument();
  });

  it('"New list…" creates a list and saves the offer in it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaveToListButton offerKey="malva-offer-x" />);
    await user.click(await screen.findByRole('button', { name: 'Save to list' }));
    await user.click(await screen.findByRole('button', { name: 'New list…' }));
    await user.type(screen.getByLabelText('List name'), 'Office');
    await user.click(screen.getByRole('button', { name: 'Create list' }));
    await waitFor(() => expect(calls.some((call) => call.url === '/api/account/lists/l2/lines')).toBe(true));
    expect(await screen.findByText('Saved to Office')).toBeInTheDocument();
  });
});
