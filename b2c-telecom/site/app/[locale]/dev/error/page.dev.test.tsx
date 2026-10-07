const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound: () => notFound() }));

import DevErrorPage from './page.dev';

describe('dev error page', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('outside development it returns 404', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => DevErrorPage()).toThrow('NOT_FOUND');
  });

  it('in development it throws so the error boundary can be seen', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => DevErrorPage()).toThrow('boom-test');
    expect(notFound).not.toHaveBeenCalled();
  });
});
