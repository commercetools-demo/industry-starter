import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedAccountLayout from './layout';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
let pathname: string | null = '/en-US/account/orders';
vi.mock('next/headers', () => ({ headers: async () => new Headers(pathname ? { 'x-pathname': pathname } : {}) }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
const redirect = vi.fn((arg: { href: string; locale: string }) => {
  throw new Error(`REDIRECT ${arg.locale} ${arg.href}`);
});
vi.mock('@/i18n/routing', () => ({ redirect: (arg: { href: string; locale: string }) => redirect(arg) }));

const params = Promise.resolve({ locale: 'en-US' });

beforeEach(() => {
  vi.clearAllMocks();
  pathname = '/en-US/account/orders';
});

describe('(protected) account layout', () => {
  it('Anonymous visits orders: redirected to sign-in with the return path', async () => {
    getSession.mockResolvedValue({});
    await expect(ProtectedAccountLayout({ children: <span>secret</span>, params })).rejects.toThrow(
      `REDIRECT en-US /account/sign-in?redirect=${encodeURIComponent('/en-US/account/orders')}`,
    );
  });

  it('Anonymous without an x-pathname header: returns to the account page', async () => {
    pathname = null;
    getSession.mockResolvedValue({ cartId: 'c' });
    await expect(ProtectedAccountLayout({ children: null, params })).rejects.toThrow(
      `REDIRECT en-US /account/sign-in?redirect=${encodeURIComponent('/en-US/account')}`,
    );
  });

  it('Signed in: renders the children', async () => {
    getSession.mockResolvedValue({ customerId: 'cust-1' });
    render(await ProtectedAccountLayout({ children: <span>orders list</span>, params }));
    expect(screen.getByText('orders list')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
