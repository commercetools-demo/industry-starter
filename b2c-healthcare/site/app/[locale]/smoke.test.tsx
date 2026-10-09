import { createTranslator } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (namespace: string) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'shell' }),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<object>()), notFound: () => notFound() }));

import TokensPage from './%5Ftokens/page';

const params = Promise.resolve({ locale: 'en-US' });

// The home route itself (formerly the bootstrap placeholder) is covered by home.test.tsx.
describe('storefront-project-bootstrap › Bootstrap smoke test', () => {
  beforeEach(() => {
    notFound.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
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
