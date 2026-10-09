import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen } from '@/test/utils';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

import ProtectedLayout from './layout';

const renderLayout = async () => renderWithProviders(<>{await ProtectedLayout({ children: <p>patient data</p> })}</>);

beforeEach(() => {
  getSession.mockReset();
  setPathname('/en-US/cart');
});

describe('account-sign-in: protected-route wiring', () => {
  it('signed out: the children (patient data) are not rendered, the prompt links to sign-in with this route as next', async () => {
    getSession.mockResolvedValue({});
    await renderLayout();
    expect(screen.queryByText('patient data')).not.toBeInTheDocument();
    expect(screen.getByText('Sign in to view your cart.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Sign in' });
    const href = link.getAttribute('href') ?? '';
    expect(decodeURIComponent(href)).toContain('/login');
    expect(new URL(href, 'http://x.test').searchParams.get('next')).toBe('/en-US/cart');
  });

  it('the reason follows the route; an unlisted route uses the account reason', async () => {
    getSession.mockResolvedValue({});
    setPathname('/en-US/prescriptions');
    const first = await renderLayout();
    expect(screen.getByText('Sign in to look up your prescriptions.')).toBeInTheDocument();
    first.unmount();
    setPathname('/en-US/something-else');
    await renderLayout();
    expect(screen.getByText('Sign in to open your account.')).toBeInTheDocument();
  });

  it('signed in: the children render and no prompt appears', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    await renderLayout();
    expect(screen.getByText('patient data')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});
