import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLastResetLink } from '@/lib/dev-stub';
import DevResetLinkPage from './page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));

const params = Promise.resolve({ locale: 'en-US' });

beforeEach(() => {
  (globalThis as { __devResetLinks?: Map<string, string> }).__devResetLinks = new Map();
});
afterEach(() => vi.unstubAllEnvs());

describe('dev reset-link page', () => {
  it('outside development it is a 404', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(DevResetLinkPage({ params })).rejects.toThrow('NOT_FOUND');
  });

  it('in test (not development) it is also a 404', async () => {
    await expect(DevResetLinkPage({ params })).rejects.toThrow('NOT_FOUND');
  });

  it('in development it shows the last stored link', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    setLastResetLink('a@b.co', 'http://localhost:3000/en-US/account/reset-password?token=abc');
    render(await DevResetLinkPage({ params }));
    expect(screen.getByRole('link')).toHaveAttribute('href', 'http://localhost:3000/en-US/account/reset-password?token=abc');
  });

  it('in development without a link it says so', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(await DevResetLinkPage({ params }));
    expect(screen.getByText(/no reset link/i)).toBeInTheDocument();
  });
});
