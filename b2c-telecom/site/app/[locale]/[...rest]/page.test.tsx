const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound: () => notFound() }));

import CatchAll from './page';

describe('[locale] catch-all', () => {
  it('Address resolves to nothing: unmatched locale URL calls notFound', () => {
    expect(() => CatchAll()).toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
