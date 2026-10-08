import { NextIntlClientProvider } from 'next-intl';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { API_AUTH_LOGOUT } from '@/lib/api-paths';
import { KEY_ACCOUNT, KEY_ADDRESSES, KEY_CART } from '@/lib/cache-keys';
import messages from '@/messages/en-US.json';
import { setPathname } from '@/test/navigation-mock';
import { render, screen, waitFor, within } from '@testing-library/react';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));
const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => router,
}));

import { AccountShell } from './AccountShell';

let cache: Map<string, unknown>;
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en-US" messages={messages}>
      <SWRConfig value={{ provider: () => cache as never, dedupingInterval: 0 }}>
        <ToastProvider>{children}</ToastProvider>
      </SWRConfig>
    </NextIntlClientProvider>
  );
}
const renderShell = () => render(<AccountShell><p>page body</p></AccountShell>, { wrapper: Wrapper });

beforeEach(() => {
  cache = new Map();
  Object.values(router).forEach((fn) => fn.mockReset());
});
afterEach(() => vi.unstubAllGlobals());

describe('design-account-area: Account layout and navigation', () => {
  it('lists every registered item and marks the one for the current route', () => {
    setPathname('/en-US/account/labs/LAB-50302');
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Account navigation' });
    const names = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(['Overview', 'Lab tests', 'Appointments', 'Orders', 'My medicines', 'Auto-refill', 'Payment methods', 'Addresses', 'Profile']);
    const current = within(nav).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Lab tests']);
    expect(current[0]?.className).toContain('bg-action');
  });

  it('the overview is active only on /account itself', () => {
    setPathname('/en-US/account');
    renderShell();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveAttribute('aria-current');
  });

  it('links go to the account routes (locale-aware) and the content renders next to the navigation', () => {
    setPathname('/en-US/account/addresses');
    renderShell();
    expect(screen.getByRole('link', { name: 'Addresses' })).toHaveAttribute('href', '/en-US/account/addresses');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/en-US/account/profile');
    expect(screen.getByText('page body')).toBeInTheDocument();
  });

  it('stacks below 900 px: a one-column grid that becomes 240 px + content only from the nav breakpoint', () => {
    setPathname('/en-US/account');
    const { container } = renderShell();
    const grid = container.querySelector('[data-account-shell] > div');
    expect(grid?.className).toContain('nav:grid-cols-[240px_1fr]');
    expect(grid?.className).not.toMatch(/(^|\s)grid-cols-/);
  });

  it('Sign out: ends the session, clears the patient keys and goes to /login', async () => {
    setPathname('/en-US/account');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(fetchMock).toHaveBeenCalledWith(API_AUTH_LOGOUT, { method: 'POST' });
    for (const key of [KEY_ACCOUNT, KEY_CART, KEY_ADDRESSES]) expect(cache.get(key)).toMatchObject({ data: null });
  });

  it('Sign out failing keeps the patient on the page and says so', async () => {
    setPathname('/en-US/account');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('status')).toHaveTextContent('We could not sign you out. Please try again.');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });
});
