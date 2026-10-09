import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen } from '@/test/utils';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

import AccountLayout, * as layoutModule from './layout';

beforeEach(() => {
  getSession.mockReset();
  setPathname('/en-US/account');
});

describe('design-account-area: account layout', () => {
  it('Caching: the area is rendered per request, never statically', () => {
    expect(layoutModule.dynamic).toBe('force-dynamic');
  });

  it('signed in: the shell wraps the page', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    renderWithProviders(<>{await AccountLayout({ children: <p>patient data</p> })}</>);
    expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
    expect(screen.getByText('patient data')).toBeInTheDocument();
  });

  it('Session no longer valid: sign-in prompt, no shell and no patient data', async () => {
    getSession.mockResolvedValue({});
    renderWithProviders(<>{await AccountLayout({ children: <p>patient data</p> })}</>);
    expect(screen.queryByText('patient data')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Account navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });
});
