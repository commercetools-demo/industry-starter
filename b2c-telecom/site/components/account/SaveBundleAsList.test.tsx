import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), usePathname: () => '/bundle', useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import { SaveBundleAsList } from './SaveBundleAsList';

let sessionKind: 'customer' | 'anonymous';
let calls: Array<{ url: string; method: string; body: unknown }>;

beforeEach(() => {
  sessionKind = 'customer';
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (url === '/api/auth/session') return new Response(JSON.stringify({ session: { kind: sessionKind, hasCart: true } }), { status: 200 });
      return new Response(JSON.stringify({ list: { id: 'l9', name: 'Home setup', lines: [] }, lists: [] }), { status: 201 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('SaveBundleAsList', () => {
  it('anonymous: sends the visitor to sign-in and back to My bundle', async () => {
    sessionKind = 'anonymous';
    renderWithProviders(<SaveBundleAsList />);
    expect(await screen.findByRole('link', { name: 'Save for later' })).toHaveAttribute('href', `/en-US/login?returnTo=${encodeURIComponent('/en-US/bundle')}`);
  });

  it('signed in: asks for a name, creates the list from the bundle and links to it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaveBundleAsList />);
    await user.click(await screen.findByRole('button', { name: 'Save bundle as list' }));
    await user.type(screen.getByLabelText('List name'), 'Home setup');
    await user.click(screen.getByRole('button', { name: 'Create list' }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ name: 'Home setup', fromCart: true }));
    expect(await screen.findByText('Saved to Home setup')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saved lists' })).toHaveAttribute('href', '/en-US/account/lists/l9');
    expect(await screen.findByRole('button', { name: 'Save bundle as list' })).toBeInTheDocument();
  });
});
