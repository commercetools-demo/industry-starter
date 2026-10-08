import { createTranslator } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (namespace: string) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'shell' }),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<object>()), notFound: () => notFound() }));
const tryProjectKey = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/ct/health', () => ({ tryProjectKey: () => tryProjectKey() }));

import LocaleHome from './page';
import TokensPage from './%5Ftokens/page';

const params = Promise.resolve({ locale: 'en-US' });

describe('storefront-project-bootstrap › Bootstrap smoke test', () => {
  beforeEach(() => {
    tryProjectKey.mockReset();
    notFound.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Placeholder renders: token-styled elements and a message from messages/en-US.json', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { container } = renderWithProviders(await LocaleHome({ params }));
    expect(screen.getByRole('heading', { level: 1, name: messages.shell.smoke.title })).toBeInTheDocument();
    expect(screen.getByText(messages.shell.smoke.lead)).toBeInTheDocument();
    // Styled only through design tokens (Tailwind utilities backed by the token theme).
    expect(container.querySelector('.bg-surface.rounded-lg.shadow-sm')).not.toBeNull();
    expect(screen.getByRole('link', { name: messages.shell.nav.remote })).toHaveClass('bg-action', 'text-action-label');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\d+px/);
    // The page renders no <main>: the layout provides it.
    expect(container.querySelector('main')).toBeNull();
  });

  it('outside development the page does not call commercetools and shows no project line', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { container } = renderWithProviders(await LocaleHome({ params }));
    expect(tryProjectKey).not.toHaveBeenCalled();
    expect(container.querySelector('[data-project-key]')).toBeNull();
    expect(screen.queryByRole('link', { name: messages.shell.smoke.tokenSheet })).toBeNull();
  });

  it('development: shows the project key when the connection works', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    tryProjectKey.mockResolvedValue('spec-test-b2c-healthcare');
    renderWithProviders(await LocaleHome({ params }));
    expect(screen.getByText('Connected project: spec-test-b2c-healthcare')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.shell.smoke.tokenSheet })).toHaveAttribute('href', '/en-US/_tokens');
  });

  it('development: degrades to a neutral line when credentials are missing', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    tryProjectKey.mockResolvedValue(null);
    renderWithProviders(await LocaleHome({ params }));
    expect(screen.getByText(messages.shell.smoke.projectUnavailable)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('the token sheet renders in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { container } = renderWithProviders(await TokensPage({ params }));
    expect(container.querySelector('[data-scale="brand"]')).not.toBeNull();
  });

  it('Not shipped: the _tokens page is a 404 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(TokensPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
